import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { JiraApiClient } from '../api/client.js';
import { getFieldScreensSchema } from '../validation/schemas.js';
import { getFieldScreensInputSchema } from '../validation/input-schemas.js';
import { JiraFieldScreenRef } from '../types/index.js';
import { enumerateCustomFields, classifyFieldId } from '../api/field-enumeration.js';
import { logger } from '../utils/logger.js';
import { JiraApiError, sanitizeErrorMessage } from '../utils/errors.js';

/**
 * Hard stop for the /screens walk. Hitting it throws to the handler's error
 * path. `/field/{id}/screens` honors up to 100 rows/page (unlike /field/search's
 * 50 cap), so the page size comes from the validated `maxResults` (default 100).
 */
const SCREENS_MAX_PAGES = 200;

/** A caught error's `code`, when it is a JiraApiError-shaped throw. */
function errorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && typeof (error as { code?: unknown }).code === 'string'
    ? (error as { code: string }).code
    : undefined;
}

/** Message for a gate verdict reached after a /screens 404. */
function verdictMessage(verdict: 'SYSTEM_FIELD' | 'FIELD_NOT_FOUND' | 'UNVERIFIABLE', fieldId: string): string {
  switch (verdict) {
    case 'SYSTEM_FIELD':
      return `'${fieldId}' is a Jira system field, not a custom field; the /field/{id}/screens endpoint returned a 404 for it. A system field and a nonexistent field return a byte-identical 404, so this is distinguished via the field enumeration, not the 404 alone.`;
    case 'FIELD_NOT_FOUND':
      return `'${fieldId}' does not exist as a custom field or a system field on this instance, verified against a COMPLETE field enumeration; the /screens endpoint 404s for it.`;
    case 'UNVERIFIABLE':
      return `The custom-field enumeration is incomplete, so whether '${fieldId}' exists cannot be verified. The /screens 404 is not interpreted as a genuine result on a partial enumeration.`;
  }
}

export async function registerFieldScreenTools(server: McpServer, apiClient: JiraApiClient) {
  // Walk /field/{id}/screens on isLast/total, striding by rows received. This
  // endpoint honors maxResults up to 100. makeRequest THROWS on non-2xx, so a
  // 404 propagates to the handler's catch; a 200 whose `values` is a non-array
  // is a loud, distinct unrecognized-shape failure (never an empty screen list).
  const fetchAllScreens = async (
    fieldId: string,
    startAtInit: number,
    pageSize: number
  ): Promise<{ screens: JiraFieldScreenRef[]; total: number | null }> => {
    const screens: JiraFieldScreenRef[] = [];
    let startAt = startAtInit;
    let total: number | null = null;
    for (let page = 0; page < SCREENS_MAX_PAGES; page++) {
      const res = await apiClient.makeRequest<{ values?: unknown[]; total?: number; isLast?: boolean }>({
        method: 'GET',
        path: `/field/${fieldId}/screens`,
        // Plain object, never URLSearchParams: the shared cache key is built from
        // Object.keys(params) and fails CLOSED to one entry otherwise.
        params: { startAt, maxResults: pageSize },
      });
      const body = res.data;
      const values = Array.isArray(body?.values) ? body.values : null;
      if (values === null) {
        const receivedKeys = body !== null && typeof body === 'object' ? Object.keys(body as object) : [];
        throw new JiraApiError(
          'GET_FIELD_SCREENS_UNRECOGNIZED_SHAPE',
          `/field/${fieldId}/screens returned a 200 whose "values" is not an array. The screen list is UNKNOWN and is NOT empty. Top-level keys received: ${receivedKeys.length > 0 ? receivedKeys.join(', ') : '(none)'}.`,
          undefined,
          'Retry the request. If this persists, the Jira API response shape has changed and this tool must be updated. Do not treat this result as a field with no screens.'
        );
      }
      for (const v of values) {
        const row = v as { id?: unknown; name?: unknown; description?: unknown };
        if (row && (typeof row.id === 'string' || typeof row.id === 'number')) {
          screens.push({
            id: String(row.id),
            name: typeof row.name === 'string' ? row.name : undefined,
            description: typeof row.description === 'string' ? row.description : undefined,
          });
        }
      }
      if (typeof body?.total === 'number') total = body.total;
      if (body?.isLast === true) break;
      if (total !== null && screens.length >= total) break;
      if (values.length === 0) break;
      startAt += values.length;
    }
    return { screens, total };
  };

  // Tool: getFieldScreens (Discovery Tool - 🔍)
  server.registerTool(
    'get_field_screens',
    {
      title: 'Get Field Screens',
      description: '🔍 DISCOVERY TOOL: Lists the screens a field appears on, via /field/{id}/screens, paginated to completion. A 200 with total:0 is a GENUINE "this field is on no screens" (onNoScreens:true, verifiable:true) and is the ONLY path that returns an empty screens array. A field that is a known custom field (confirmed against the union enumeration) but whose /screens endpoint returns 404 is reported as SCREENS_UNAVAILABLE with verifiable:false - never as an empty screens list. A 404 for a system field or a nonexistent id is classified via the enumeration with a distinct code.',
      inputSchema: getFieldScreensInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params) => {
      let fieldId = '';
      try {
        const validatedParams = getFieldScreensSchema.parse(params);
        fieldId = validatedParams.fieldId;

        try {
          const { screens, total } = await fetchAllScreens(fieldId, validatedParams.startAt, validatedParams.maxResults);
          const onNoScreens = screens.length === 0;
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                fieldId,
                screens,
                total: total ?? screens.length,
                count: screens.length,
                onNoScreens,
                verifiable: true,
                usage_guidance: onNoScreens
                  ? 'This field is on no screens. onNoScreens:true with verifiable:true is a GENUINE zero from a 200 total:0 - not conflated with a 404.'
                  : `This field appears on ${screens.length} screen(s).`,
              }, null, 2),
            }],
          };
        } catch (error: unknown) {
          const code = errorCode(error);
          if (code === 'NOT_FOUND') {
            // /screens 404: lazily enumerate to distinguish a locked known-custom
            // field from a system field or a nonexistent id. A system field and a
            // nonexistent field return a byte-identical 404, so the 404 alone is
            // never interpreted.
            const enumeration = await enumerateCustomFields(apiClient);
            const fc = classifyFieldId(enumeration, fieldId);
            if (fc.custom) {
              // MC2: a known custom field whose /screens endpoint 404s ->
              // SCREENS_UNAVAILABLE. NEVER screens:[] (that is reserved for a real
              // 200 total:0), NEVER onNoScreens:true.
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    fieldId,
                    screens: null,
                    total: null,
                    onNoScreens: false,
                    verifiable: false,
                    error: {
                      code: 'SCREENS_UNAVAILABLE',
                      message: `'${fieldId}' is a known custom field, but /field/${fieldId}/screens returned 404. Its screens are UNAVAILABLE via this endpoint (commonly a locked or managed field); this is not a genuine "on no screens" result.`,
                      suggestion: 'The field exists; the /screens endpoint is not serviceable for it. Do not treat this as an empty screen list.',
                    },
                  }, null, 2),
                }],
                isError: true,
              };
            }
            // fc.custom === false: SYSTEM_FIELD / FIELD_NOT_FOUND / UNVERIFIABLE.
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  fieldId,
                  screens: null,
                  total: null,
                  onNoScreens: false,
                  verifiable: false,
                  error: {
                    code: fc.verdict,
                    message: verdictMessage(fc.verdict, fieldId),
                  },
                }, null, 2),
              }],
              isError: true,
            };
          }
          // Any other error (5xx, network, unrecognized 200 shape) -> outer catch.
          throw error;
        }
      } catch (error: any) {
        logger.error('Failed to get field screens', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              fieldId: fieldId || undefined,
              screens: null,
              verifiable: false,
              error: {
                code: error.code || 'GET_FIELD_SCREENS_ERROR',
                message: sanitizeErrorMessage(error.message),
                details: error.details,
                suggestion: error.suggestion || 'Use "get_fields_paginated" to find valid field IDs. A 404 for a known custom field is reported as SCREENS_UNAVAILABLE, never as an empty screen list.',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Field screen tools registered successfully (logging disabled for MCP compatibility)
}
