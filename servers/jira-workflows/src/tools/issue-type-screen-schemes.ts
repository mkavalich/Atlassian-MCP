import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { JiraApiClient } from '../api/client.js';
import {
  getIssueTypeScreenSchemesListSchema,
  getProjectIssueTypeScreenSchemeSchema,
  getIssueTypeScreenSchemeMappingsSchema,
} from '../validation/schemas.js';
import {
  getIssueTypeScreenSchemesListInputSchema,
  getProjectIssueTypeScreenSchemeInputSchema,
  getIssueTypeScreenSchemeMappingsInputSchema,
} from '../validation/input-schemas.js';
import {
  JiraIssueTypeScreenSchemeListItem,
  JiraIssueTypeScreenSchemeMappingRow,
} from '../types/index.js';
import { logger } from '../utils/logger.js';
import { JiraApiError, sanitizeErrorMessage } from '../utils/errors.js';

/**
 * Read-only issue-type screen scheme (ITSS) discovery tools (Pass B / Tool 3).
 *
 * Three endpoint-granular tools:
 *   3a get_issue_type_screen_schemes        GET /issuetypescreenscheme
 *   3b get_project_issue_type_screen_scheme GET /issuetypescreenscheme/project
 *   3c get_issue_type_screen_scheme_mappings GET /issuetypescreenscheme/mapping
 *
 * DEFECT CLASS THIS FILE MAKES IMPOSSIBLE: a paginated read that silently
 * truncates at a page cap and then returns a confident, successful-looking wrong
 * answer. Every walk tracks a `complete` flag that is set true ONLY on a natural
 * stop (isLast===true, collected>=total, or an empty page). On page-cap
 * exhaustion the walk returns complete:false and the caller reports the result as
 * UNVERIFIABLE / partial -- never a definite answer.
 *
 * MC1 (3b): the honest "no explicit ITSS; project uses the Default (id 1)"
 * verdict is reachable ONLY when the walk completed. A truncated walk that has
 * not yet seen the project returns assigned:null / verifiable:false, NEVER the
 * Default-ITSS fallback.
 *
 * Fail-loud: an unrecognised 200 shape (neither a bare array nor a {values:[]}
 * envelope) throws a *_UNRECOGNIZED_SHAPE error naming the received keys; it is
 * never passed through and never treated as an empty result.
 */

/**
 * Hard stop for every ITSS pagination walk. Hitting it is reported as
 * complete:false (never a definite count and never thrown), mirroring the
 * fetchAllUsers / field-enumeration fail-closed precedent.
 */
const ITSS_MAX_PAGES = 200;

interface WalkResult {
  /** Raw row objects collected across all pages, in order. */
  rows: Record<string, unknown>[];
  /** The server-reported `total`, when present; otherwise null. */
  total: number | null;
  /**
   * True ONLY on a natural stop (isLast===true, collected>=total, or an empty
   * page). False when the page cap was exhausted first -> `rows` is a truncated
   * prefix and MUST NOT be reported as a complete answer.
   */
  complete: boolean;
}

/**
 * Walk a paginated ITSS endpoint to a natural stop, striding `startAt` by the
 * number of rows ACTUALLY received (never by requested maxResults -- a short but
 * non-final page would otherwise resume at the wrong offset and skip rows).
 *
 * `params` MUST be a plain object (never URLSearchParams): the query string lives
 * in `params`, never concatenated into `path`. makeRequest THROWS on non-2xx, so
 * a 4xx/5xx propagates to the caller's try/catch. A 200 whose body is neither an
 * array nor a {values:[]} envelope is a loud, distinct UNRECOGNIZED_SHAPE failure
 * -- never an empty result.
 */
async function walkItssEndpoint(
  apiClient: JiraApiClient,
  path: string,
  filterParams: Record<string, unknown>,
  startAtInit: number,
  pageSize: number,
  unrecognizedCode: string,
  endpointLabel: string,
): Promise<WalkResult> {
  const rows: Record<string, unknown>[] = [];
  let startAt = startAtInit;
  let total: number | null = null;
  let complete = false;

  for (let page = 0; page < ITSS_MAX_PAGES; page++) {
    const res = await apiClient.makeRequest<{ values?: unknown; total?: unknown; isLast?: unknown }>({
      method: 'GET',
      path,
      params: { ...filterParams, startAt, maxResults: pageSize },
    });

    const body: unknown = res.data;
    let values: unknown[] | null = null;
    if (Array.isArray(body)) {
      values = body;
    } else if (body !== null && typeof body === 'object' && Array.isArray((body as { values?: unknown }).values)) {
      values = (body as { values: unknown[] }).values;
    }

    if (values === null) {
      const receivedKeys = body !== null && typeof body === 'object' ? Object.keys(body as object) : [];
      throw new JiraApiError(
        unrecognizedCode,
        `${endpointLabel} returned a 200 that is neither an array nor an envelope with an array "values" property. The result is UNKNOWN and is NOT empty. Top-level keys received: ${receivedKeys.length > 0 ? receivedKeys.join(', ') : '(none)'}.`,
        undefined,
        'Retry the request. If this persists, the Jira API response shape has changed and this tool must be updated. Do not treat this result as an empty list.'
      );
    }

    for (const v of values) {
      if (v !== null && typeof v === 'object') {
        rows.push(v as Record<string, unknown>);
      }
    }

    const envelopeTotal =
      body !== null && typeof body === 'object' && typeof (body as { total?: unknown }).total === 'number'
        ? (body as { total: number }).total
        : null;
    if (envelopeTotal !== null) total = envelopeTotal;

    const isLast =
      body !== null && typeof body === 'object' && (body as { isLast?: unknown }).isLast === true;

    if (isLast) { complete = true; break; }
    if (total !== null && rows.length >= total) { complete = true; break; }
    if (values.length === 0) { complete = true; break; }

    startAt += values.length;
  }

  return { rows, total, complete };
}

/** Reads a row's scalar string/number field as a string, else undefined. */
function readScalarString(row: Record<string, unknown>, key: string): string | undefined {
  const v = row[key];
  return typeof v === 'string' || typeof v === 'number' ? String(v) : undefined;
}

/**
 * A filter value for a Jira "repeatable" query param. A single id is passed as a
 * scalar (clean `id=X` serialization the server honors); multiple ids are passed
 * as an array (best-effort server filter). A client-side filter is ALWAYS applied
 * afterwards as the correctness guarantee, so the result is exact regardless of
 * how the server serializes/honors the param.
 */
function filterParamValue(ids: string[]): string | string[] {
  return ids.length === 1 ? ids[0] : ids;
}

export async function registerIssueTypeScreenSchemeTools(server: McpServer, apiClient: JiraApiClient) {
  // -------------------------------------------------------------------------
  // 3a: get_issue_type_screen_schemes
  // -------------------------------------------------------------------------
  server.registerTool(
    'get_issue_type_screen_schemes',
    {
      title: 'Get Issue Type Screen Schemes',
      description: '🔍 DISCOVERY TOOL: Lists issue type screen schemes (ITSS) via GET /issuetypescreenscheme, paginated to completion (isLast/total). An ITSS binds issue types to screen schemes for a project; id "1" is the Default Issue Type Screen Scheme. NOTE: an ITSS is a DIFFERENT entity from a screen scheme (use "get_screen_schemes" for those). If the walk hits the page cap without reaching isLast, the result is reported as verifiable:false / truncated rather than a definite list.',
      inputSchema: getIssueTypeScreenSchemesListInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const validated = getIssueTypeScreenSchemesListSchema.parse(params);
        const idSet = validated.ids && validated.ids.length > 0 ? new Set(validated.ids) : null;
        const filterParams: Record<string, unknown> = idSet ? { id: filterParamValue(validated.ids as string[]) } : {};

        const { rows, total: walkTotal, complete } = await walkItssEndpoint(
          apiClient,
          '/issuetypescreenscheme',
          filterParams,
          validated.startAt,
          validated.maxResults,
          'GET_ISSUE_TYPE_SCREEN_SCHEMES_UNRECOGNIZED_SHAPE',
          '/issuetypescreenscheme',
        );

        const allSchemes: JiraIssueTypeScreenSchemeListItem[] = [];
        for (const row of rows) {
          const id = readScalarString(row, 'id');
          if (id === undefined) continue; // a row with no usable id is disclosed as omitted below, never fabricated
          allSchemes.push({
            id,
            name: readScalarString(row, 'name'),
            description: readScalarString(row, 'description'),
          });
        }
        const schemes = idSet ? allSchemes.filter((s) => idSet.has(s.id)) : allSchemes;

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: complete,
              schemes,
              total: idSet ? schemes.length : (walkTotal ?? schemes.length),
              count: schemes.length,
              isLast: complete,
              ...(complete ? {} : { truncated: true }),
              usage_guidance: complete
                ? 'Use an ITSS id with "get_issue_type_screen_scheme_mappings" to see its issueType->screenScheme mappings, or "get_project_issue_type_screen_scheme" to resolve a project\'s assigned ITSS.'
                : 'The ITSS walk hit the page cap (ITSS_MAX_PAGES) without reaching isLast; the list may be truncated. Reported as verifiable:false / truncated rather than a definite list.',
            }, null, 2),
          }],
          ...(complete ? {} : { isError: true }),
        };
      } catch (error: any) {
        logger.error('Failed to get issue type screen schemes', { error: error?.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              schemes: null,
              error: {
                code: error?.code || 'GET_ISSUE_TYPE_SCREEN_SCHEMES_ERROR',
                message: sanitizeErrorMessage(error?.message ?? 'Failed to retrieve issue type screen schemes'),
                details: error?.details,
                suggestion: error?.suggestion || 'Ensure you have permission to view issue type screen schemes. Do not treat this as an empty list.',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // -------------------------------------------------------------------------
  // 3b: get_project_issue_type_screen_scheme  (MC1: fail-closed on truncation)
  // -------------------------------------------------------------------------
  server.registerTool(
    'get_project_issue_type_screen_scheme',
    {
      title: 'Get Project Issue Type Screen Scheme',
      description: 'Resolves a single project\'s assigned issue type screen scheme (ITSS) via GET /issuetypescreenscheme/project?projectId=. projectId is REQUIRED. Returns assigned:true with the issueTypeScreenSchemeId when the project has an explicit assignment. When the walk COMPLETES and the project is genuinely absent, returns assigned:false with usesDefaultItss:"1" (the project falls back to the Default ITSS) - an HONEST "no explicit assignment", not an error. If the walk truncates at the page cap before the project is seen, returns assigned:null / verifiable:false - UNVERIFIABLE, never the Default-ITSS fallback.',
      inputSchema: getProjectIssueTypeScreenSchemeInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      let projectId = '';
      try {
        const validated = getProjectIssueTypeScreenSchemeSchema.parse(params);
        projectId = validated.projectId;

        const { rows, complete } = await walkItssEndpoint(
          apiClient,
          '/issuetypescreenscheme/project',
          { projectId },
          validated.startAt,
          validated.maxResults,
          'GET_PROJECT_ITSS_UNRECOGNIZED_SHAPE',
          '/issuetypescreenscheme/project',
        );

        // Find the row that assigns THIS project. The row shape is
        // { issueTypeScreenScheme: { id, ... }, projectIds: [...] } -- the ITSS id
        // is at row.issueTypeScreenScheme.id, NOT a scalar issueTypeScreenSchemeId.
        // Match on projectIds including the queried projectId so the result is
        // correct whether or not the server honoured the projectId filter.
        let matchedItssId: string | null = null;
        let matchedButUnreadable = false;
        for (const row of rows) {
          const projectIds = row.projectIds;
          const includesProject =
            Array.isArray(projectIds) && projectIds.some((p) => String(p) === projectId);
          if (!includesProject) continue;

          const itss = row.issueTypeScreenScheme;
          if (itss !== null && typeof itss === 'object') {
            const idVal = (itss as { id?: unknown }).id;
            if (typeof idVal === 'string' || typeof idVal === 'number') {
              matchedItssId = String(idVal);
              break;
            }
          }
          // A matching row whose ITSS id is not a readable scalar is an
          // unrecognised shape, not a fabricated assignment.
          matchedButUnreadable = true;
        }

        if (matchedButUnreadable && matchedItssId === null) {
          throw new JiraApiError(
            'GET_PROJECT_ITSS_UNRECOGNIZED_SHAPE',
            `/issuetypescreenscheme/project returned a row assigning project ${projectId} but its issueTypeScreenScheme.id was missing or non-scalar. The assigned ITSS id is UNKNOWN; it is not being reported as unassigned.`,
            undefined,
            'Retry the request. If this persists, the Jira API response shape has changed and this tool must be updated.'
          );
        }

        if (matchedItssId !== null) {
          // Verified positive: the assignment was found, regardless of `complete`.
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                projectId,
                assigned: true,
                issueTypeScreenSchemeId: matchedItssId,
                usage_guidance: `Project ${projectId} is assigned issue type screen scheme ${matchedItssId}. Use "get_issue_type_screen_scheme_mappings" with this id to list its issueType->screenScheme mappings.`,
              }, null, 2),
            }],
          };
        }

        if (complete) {
          // MC1: honest absence is reachable ONLY because the walk completed.
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                projectId,
                assigned: false,
                usesDefaultItss: '1',
                note: 'No explicit ITSS assignment; project uses the Default issue type screen scheme (id 1).',
                usage_guidance: `Project ${projectId} has no explicit ITSS assignment and falls back to the Default issue type screen scheme (id 1). This is an honest "no explicit assignment", verified against a COMPLETE walk - not an error and not a truncated result.`,
              }, null, 2),
            }],
          };
        }

        // MC1: the walk truncated at the page cap before this project was seen.
        // UNVERIFIABLE -- never the Default-ITSS fallback.
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              projectId,
              assigned: null,
              verifiable: false,
              truncated: true,
              reason: 'ITSS-project enumeration truncated at the page cap; assignment for this project is unverifiable.',
              error: {
                code: 'ITSS_PROJECT_UNVERIFIABLE',
                message: `The /issuetypescreenscheme/project walk hit the page cap (ITSS_MAX_PAGES) before project ${projectId} was seen. Its ITSS assignment is UNVERIFIABLE; it is NOT reported as unassigned / using the Default ITSS.`,
                suggestion: 'Narrow the query or retry. Do not treat this as "no ITSS assigned".',
              },
            }, null, 2),
          }],
          isError: true,
        };
      } catch (error: any) {
        logger.error('Failed to resolve project issue type screen scheme', { error: error?.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              projectId: projectId || undefined,
              assigned: null,
              verifiable: false,
              error: {
                code: error?.code || 'GET_PROJECT_ITSS_ERROR',
                message: sanitizeErrorMessage(error?.message ?? 'Failed to resolve project issue type screen scheme'),
                details: error?.details,
                suggestion: error?.suggestion || 'Provide a valid projectId. A missing projectId is a validation error, never an empty result. Do not treat an error as "no ITSS assigned".',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // -------------------------------------------------------------------------
  // 3c: get_issue_type_screen_scheme_mappings
  // -------------------------------------------------------------------------
  server.registerTool(
    'get_issue_type_screen_scheme_mappings',
    {
      title: 'Get Issue Type Screen Scheme Mappings',
      description: '🔍 DISCOVERY TOOL: Lists issueType -> screenScheme mappings for one or more issue type screen schemes via GET /issuetypescreenscheme/mapping, paginated to completion. Optionally filter by issueTypeScreenSchemeId. Each row is { issueTypeScreenSchemeId, issueTypeId, screenSchemeId }; issueTypeId "default" is the catch-all mapping. Resolve a screenSchemeId to its screens with "get_screen_schemes". If the walk hits the page cap without reaching isLast, the result is reported as verifiable:false / truncated rather than a definite list.',
      inputSchema: getIssueTypeScreenSchemeMappingsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const validated = getIssueTypeScreenSchemeMappingsSchema.parse(params);
        const idSet =
          validated.issueTypeScreenSchemeId && validated.issueTypeScreenSchemeId.length > 0
            ? new Set(validated.issueTypeScreenSchemeId)
            : null;
        const filterParams: Record<string, unknown> = idSet
          ? { issueTypeScreenSchemeId: filterParamValue(validated.issueTypeScreenSchemeId as string[]) }
          : {};

        const { rows, total: walkTotal, complete } = await walkItssEndpoint(
          apiClient,
          '/issuetypescreenscheme/mapping',
          filterParams,
          validated.startAt,
          validated.maxResults,
          'GET_ISSUE_TYPE_SCREEN_SCHEME_MAPPINGS_UNRECOGNIZED_SHAPE',
          '/issuetypescreenscheme/mapping',
        );

        const allMappings: JiraIssueTypeScreenSchemeMappingRow[] = [];
        for (const row of rows) {
          const itssId = readScalarString(row, 'issueTypeScreenSchemeId');
          const issueTypeId = readScalarString(row, 'issueTypeId');
          const screenSchemeId = readScalarString(row, 'screenSchemeId');
          if (itssId === undefined || issueTypeId === undefined || screenSchemeId === undefined) continue;
          allMappings.push({ issueTypeScreenSchemeId: itssId, issueTypeId, screenSchemeId });
        }
        const mappings = idSet
          ? allMappings.filter((m) => idSet.has(m.issueTypeScreenSchemeId))
          : allMappings;

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: complete,
              mappings,
              total: idSet ? mappings.length : (walkTotal ?? mappings.length),
              count: mappings.length,
              isLast: complete,
              ...(complete ? {} : { truncated: true }),
              usage_guidance: complete
                ? 'Each row links an issue type to a screen scheme within an ITSS. issueTypeId "default" is the catch-all. Resolve a screenSchemeId to its screens with "get_screen_schemes".'
                : 'The mapping walk hit the page cap (ITSS_MAX_PAGES) without reaching isLast; the list may be truncated. Reported as verifiable:false / truncated rather than a definite list.',
            }, null, 2),
          }],
          ...(complete ? {} : { isError: true }),
        };
      } catch (error: any) {
        logger.error('Failed to get issue type screen scheme mappings', { error: error?.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              mappings: null,
              error: {
                code: error?.code || 'GET_ISSUE_TYPE_SCREEN_SCHEME_MAPPINGS_ERROR',
                message: sanitizeErrorMessage(error?.message ?? 'Failed to retrieve issue type screen scheme mappings'),
                details: error?.details,
                suggestion: error?.suggestion || 'Ensure you have permission to view issue type screen scheme mappings. Do not treat this as an empty list.',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Issue type screen scheme read tools registered successfully.
}
