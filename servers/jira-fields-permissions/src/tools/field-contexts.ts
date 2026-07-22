import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { JiraApiClient } from '../api/client.js';
import {
  getCustomFieldContextsSchema,
  getFieldProjectMappingSchema,
  createCustomFieldContextSchema,
  updateCustomFieldContextSchema,
  deleteCustomFieldContextSchema,
  getCustomFieldOptionsSchema,
  createCustomFieldOptionsSchema,
} from '../validation/schemas.js';
import {
  getCustomFieldContextsInputSchema,
  getFieldProjectMappingInputSchema,
  createCustomFieldContextInputSchema,
  updateCustomFieldContextInputSchema,
  deleteCustomFieldContextInputSchema,
  getCustomFieldOptionsInputSchema,
  createCustomFieldOptionsInputSchema,
  // REMOVED: getCustomFieldOptionsGuidedInputSchema - Cloud API limitation
} from '../validation/input-schemas.js';
import {
  JiraCustomFieldContext,
  JiraCustomFieldOption,
  JiraFieldContextProjectMappingRow,
  JiraFieldProjectMapping,
} from '../types/index.js';
import {
  enumerateCustomFields,
  classifyFieldId,
  type CustomFieldRecord,
} from '../api/field-enumeration.js';
import { logger } from '../utils/logger.js';
import { sanitizeErrorMessage } from '../utils/errors.js';

/** `/field/{id}/context/projectmapping` page size (paginated on total/isLast). */
const MAPPING_PAGE_SIZE = 50;
/** Hard stop for the per-field mapping walk. Hitting it throws to the per-field catch. */
const MAPPING_MAX_PAGES = 100;
/** `/project/search` page size for resolveGlobalToProjects. */
const PROJECT_PAGE_SIZE = 50;
/** Hard stop for the /project/search walk. Hitting it yields projects:null (never a truncated list). */
const PROJECT_MAX_PAGES = 200;

/** A caught error's `code`, when it is a JiraApiError-shaped throw. */
function errorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && typeof (error as { code?: unknown }).code === 'string'
    ? (error as { code: string }).code
    : undefined;
}

/** Message for a gate verdict that yields a per-field error rather than a mapping row. */
function verdictMessage(verdict: 'SYSTEM_FIELD' | 'FIELD_NOT_FOUND' | 'UNVERIFIABLE', fieldId: string): string {
  switch (verdict) {
    case 'SYSTEM_FIELD':
      return `'${fieldId}' is a Jira system field, not a custom field. The project-mapping endpoint exists only for custom fields; a system field and a nonexistent field return a byte-identical 404, so this is rejected via the field enumeration rather than reported as a field with no projects.`;
    case 'FIELD_NOT_FOUND':
      return `'${fieldId}' does not exist as a custom field or a system field on this instance, verified against a COMPLETE field enumeration.`;
    case 'UNVERIFIABLE':
      return `The custom-field enumeration is incomplete, so whether '${fieldId}' is a custom field cannot be verified. No negative verdict is issued on a partial enumeration.`;
  }
}

const UNVERIFIABLE_MAPPING_REASON =
  '/field/{id}/context/projectmapping returns 404 for this field even though it exists in /field; ' +
  'association is not verifiable via the context endpoints.';

export async function registerFieldContextTools(server: McpServer, apiClient: JiraApiClient) {
  // Tool: getCustomFieldContexts
  server.registerTool(
    'get_custom_field_contexts',
    {
      title: 'Get Custom Field Contexts',
      description: '🔍 DISCOVERY TOOL: Always use this first before working with field options. Discovers all available context IDs for a custom field. Use the returned context IDs with "get_custom_field_options". If no contexts are returned, create one with "create_custom_field_context".',
      inputSchema: getCustomFieldContextsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = getCustomFieldContextsSchema.parse(params);

        const queryParams: any = {};
        if (validatedParams.startAt !== 0) queryParams.startAt = validatedParams.startAt;
        if (validatedParams.maxResults !== 50) queryParams.maxResults = validatedParams.maxResults;

        const response = await apiClient.makeRequest<{ values: JiraCustomFieldContext[]; total: number; startAt: number; maxResults: number }>({
          method: 'GET',
          path: `/field/${validatedParams.fieldId}/context`,
          params: Object.keys(queryParams).length > 0 ? queryParams : undefined,
        });

        if (response.success && response.data) {
          // The API returns EITHER a bare array of contexts OR a paginated
          // envelope { values, total, startAt, maxResults }. Resolve the union
          // explicitly and handle both arms.
          //
          // The previous `response.data.values || response.data` was wrong in
          // two ways. (a) When the envelope arrives WITHOUT `values`, the
          // fallback handed back the envelope object, `.length` was undefined
          // and `|| 0` reported `count: 0` -- an absent property rendered
          // indistinguishable from a genuine empty list. (b) On the bare-array
          // arm, `data.values` resolves to Array.prototype.values (the
          // iterator METHOD, which is truthy), so `contexts` became a function
          // with `.length === 0` that JSON.stringify drops entirely: the tool
          // returned success:true, count:0 and no contexts at all while the
          // API had returned rows. Array.isArray is therefore checked FIRST.
          const raw: unknown = response.data;
          let contexts: JiraCustomFieldContext[] | null = null;
          if (Array.isArray(raw)) {
            contexts = raw as JiraCustomFieldContext[];
          } else if (
            raw !== null &&
            typeof raw === 'object' &&
            Array.isArray((raw as { values?: unknown }).values)
          ) {
            contexts = (raw as { values: JiraCustomFieldContext[] }).values;
          }

          if (contexts === null) {
            // Unknown is NOT zero. Fail loudly rather than fabricate a count.
            const receivedKeys =
              raw !== null && typeof raw === 'object' ? Object.keys(raw as object) : [];
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  partialFailure: true,
                  customFieldContexts: null,
                  count: null,
                  pagination: null,
                  error: {
                    code: 'GET_CUSTOM_FIELD_CONTEXTS_UNRECOGNIZED_SHAPE',
                    message: `Jira returned a response for /field/${validatedParams.fieldId}/context that is neither an array of contexts nor an envelope with an array "values" property. The number of contexts is UNKNOWN and is NOT zero. Top-level keys received: ${receivedKeys.length > 0 ? receivedKeys.join(', ') : '(none)'}.`,
                    suggestion: 'Retry the request. If this persists, the Jira API response shape has changed and this tool must be updated. Do not treat this result as an empty context list.',
                  },
                }, null, 2),
              }],
              isError: true,
            };
          }

          const count = contexts.length;

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                customFieldContexts: contexts,
                pagination: {
                  startAt: response.data.startAt || 0,
                  maxResults: response.data.maxResults || 50,
                  total: response.data.total || count,
                },
                count: count,
                usage_guidance: count > 0
                  ? `Found ${count} context(s). Use context IDs with "get_custom_field_options" to retrieve options.`
                  : `No contexts found for field ${validatedParams.fieldId}. Create one with "create_custom_field_context" before adding options.`
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to retrieve custom field contexts');
      } catch (error: any) {
        logger.error('Failed to get custom field contexts', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_CUSTOM_FIELD_CONTEXTS_ERROR',
                message: sanitizeErrorMessage(error.message),
                details: error.details,
                suggestion: error.suggestion || 'Ensure the custom field exists and you have permission to view its contexts',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: getFieldProjectMapping (Discovery Tool - 🔍)
  server.registerTool(
    'get_field_project_mapping',
    {
      title: 'Get Field Project Mapping',
      description: '🔍 DISCOVERY TOOL: Maps custom fields to the projects they apply to via field context project mappings. Custom fields are enumerated from a UNION of /field and /field/search (both paginated to completion) so no negative verdict is ever issued from a truncated list. A field on a GLOBAL context applies to EVERY project and is reported as allProjects:true - never as an empty project list. A project-scoped field whose mapping endpoint returns a 200 reports its REAL project ids. A field that exists but returns a byte-identical 404 from the mapping endpoint is reported as verifiable:false (UNVERIFIABLE), labeled project-scoped-jpd for Jira Product Discovery fields - never as "not a custom field" and never as 0 projects. System fields and nonexistent ids are rejected via the enumeration with distinct codes.',
      inputSchema: getFieldProjectMappingInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = getFieldProjectMappingSchema.parse(params);

        // The structural cure: enumerate custom fields from the UNION of both
        // field endpoints, each paginated to a real isLast/total. classifyFieldId
        // forbids any negative verdict unless the enumeration is complete.
        const enumeration = await enumerateCustomFields(apiClient);

        const mappings: JiraFieldProjectMapping[] = [];
        const errors: { fieldId: string; code: string; message: string }[] = [];
        let partialFailure = false;

        // Walk /project/search on isLast/total, striding by rows received, only
        // if asked to expand a global context. A page-cap hit yields null (never
        // a truncated list) -- fixes the parked unpaginated single-call defect.
        const resolveAllProjectIds = async (): Promise<string[] | null> => {
          const ids: string[] = [];
          let startAt = 0;
          let total: number | null = null;
          for (let page = 0; page < PROJECT_MAX_PAGES; page++) {
            let body: { values?: { id?: string | number }[]; total?: number; isLast?: boolean } | undefined;
            try {
              const res = await apiClient.makeRequest<{ values?: { id?: string | number }[]; total?: number; isLast?: boolean }>({
                method: 'GET',
                path: '/project/search',
                params: { startAt, maxResults: PROJECT_PAGE_SIZE },
              });
              body = res.data;
            } catch {
              return null; // first-or-later page failure: unknown, never an empty/truncated list
            }
            const values = Array.isArray(body?.values) ? body.values : null;
            if (values === null) return null;
            for (const p of values) {
              if (p && p.id !== undefined && p.id !== null) ids.push(String(p.id));
            }
            if (typeof body?.total === 'number') total = body.total;
            if (body?.isLast === true) return ids;
            if (total !== null && ids.length >= total) return ids;
            if (values.length === 0) return ids;
            startAt += values.length;
          }
          return null; // page cap hit before a terminal signal -> truncated -> null
        };

        // Paginate /field/{id}/context/projectmapping on total/isLast, striding by
        // rows received. makeRequest THROWS on non-2xx, so a 404 propagates to the
        // per-field catch below; a 200 whose `values` is a non-array is a loud,
        // distinct unrecognized-shape failure (never treated as an empty result).
        const fetchProjectMappingRows = async (fieldId: string): Promise<JiraFieldContextProjectMappingRow[]> => {
          const rows: JiraFieldContextProjectMappingRow[] = [];
          let startAt = 0;
          let total: number | null = null;
          for (let page = 0; page < MAPPING_MAX_PAGES; page++) {
            const res = await apiClient.makeRequest<{ values?: JiraFieldContextProjectMappingRow[]; total?: number; isLast?: boolean }>({
              method: 'GET',
              path: `/field/${fieldId}/context/projectmapping`,
              // Plain object, never URLSearchParams: the shared cache key is built
              // from Object.keys(params) and fails CLOSED to one entry otherwise,
              // serving one field's mapping page for another field's query.
              params: { startAt, maxResults: MAPPING_PAGE_SIZE },
            });
            const body = res.data;
            const values = Array.isArray(body?.values) ? body.values : null;
            if (values === null) {
              const receivedKeys = body !== null && typeof body === 'object' ? Object.keys(body as object) : [];
              // Loud, distinct code -- NOT a 404, NOT an empty projects list.
              throw new Error(
                `GET_FIELD_PROJECT_MAPPING_UNRECOGNIZED_SHAPE: /field/${fieldId}/context/projectmapping returned a 200 whose "values" is not an array. The mapping is UNKNOWN and is NOT empty. Top-level keys received: ${receivedKeys.length > 0 ? receivedKeys.join(', ') : '(none)'}.`
              );
            }
            rows.push(...values);
            if (typeof body?.total === 'number') total = body.total;
            if (body?.isLast === true) break;
            if (total !== null && rows.length >= total) break;
            if (values.length === 0) break;
            startAt += values.length;
          }
          return rows;
        };

        // Resolve the site's project list only if asked to expand a global context.
        let allProjectIds: string[] | null = null;
        if (validatedParams.resolveGlobalToProjects) {
          const resolved = await resolveAllProjectIds();
          if (resolved === null) {
            partialFailure = true;
            errors.push({
              fieldId: '*',
              code: 'PROJECT_LIST_UNAVAILABLE',
              message: 'Could not enumerate projects to expand global contexts; projects reported as null, never as an empty or truncated list.',
            });
          } else {
            allProjectIds = resolved;
          }
        }

        const scopeHint = (record: CustomFieldRecord): { id: string }[] =>
          record.scopeProjectId ? [{ id: record.scopeProjectId }] : [];

        for (const fieldId of validatedParams.fieldIds) {
          const fc = classifyFieldId(enumeration, fieldId);

          if (!fc.custom) {
            // SYSTEM_FIELD / FIELD_NOT_FOUND / UNVERIFIABLE via the gate. No mappings row.
            partialFailure = true;
            errors.push({ fieldId, code: fc.verdict, message: verdictMessage(fc.verdict, fieldId) });
            continue;
          }

          const record = fc.record;

          // MC3 attempt-then-catch: ALWAYS call the mapping endpoint for a
          // known-custom field and classify ON THE RESULT. Never route on
          // scopeType==='PROJECT' and skip the endpoint. The per-field try/catch
          // guarantees one field's 404 never aborts the batch.
          try {
            const rows = await fetchProjectMappingRows(fieldId);

            const isGlobal = rows.some((r) => r.isGlobalContext === true);
            const scopedIds = rows
              .filter((r) => r.isGlobalContext !== true && typeof r.projectId === 'string')
              .map((r) => r.projectId as string);
            const unresolvedRows = rows.filter(
              (r) => r.isGlobalContext !== true && typeof r.projectId !== 'string'
            ).length;

            if (unresolvedRows > 0) partialFailure = true;

            if (isGlobal) {
              // A global context means EVERY project, never zero.
              mappings.push({
                fieldId,
                scope: 'global',
                allProjects: true,
                verifiable: true,
                projects: allProjectIds,
                projectCount: allProjectIds ? allProjectIds.length : null,
                projectsFromScope: scopeHint(record),
                unresolvedRows,
                contextCount: rows.length,
              });
            } else if (scopedIds.length > 0) {
              const unique = [...new Set(scopedIds)];
              mappings.push({
                fieldId,
                scope: 'project-scoped',
                allProjects: false,
                verifiable: true,
                projects: unique,
                projectCount: unresolvedRows > 0 ? null : unique.length,
                projectsFromScope: scopeHint(record),
                unresolvedRows,
                contextCount: rows.length,
              });
            } else {
              // 200 but neither global nor a usable projectId: unknown, not empty.
              mappings.push({
                fieldId,
                scope: 'unknown',
                allProjects: false,
                verifiable: false,
                projects: null,
                projectCount: null,
                projectsFromScope: scopeHint(record),
                unresolvedRows: unresolvedRows || rows.length,
                contextCount: rows.length,
              });
            }
          } catch (error: unknown) {
            const code = errorCode(error);
            if (code === 'NOT_FOUND') {
              // Byte-identical 404 for a field that DOES exist in /field:
              // UNVERIFIABLE, labeled by schema.custom. Never NOT_A_CUSTOM_FIELD,
              // never 0, never "does not exist".
              const isJpd = record.schemaCustom?.startsWith('jira.polaris:') === true;
              mappings.push({
                fieldId,
                scope: isJpd ? 'project-scoped-jpd' : 'project-scoped-unverifiable',
                allProjects: false,
                verifiable: false,
                projects: null,
                projectCount: null,
                projectsFromScope: scopeHint(record),
                unresolvedRows: 0,
                contextCount: 0,
                unverifiableReason: UNVERIFIABLE_MAPPING_REASON,
              });
            } else {
              // Any other error (5xx, network, unrecognized 200 shape): no
              // mappings row -- a fake-zero row is indistinguishable from a real
              // empty. Report loudly. An unrecognized 200 shape keeps its own
              // distinct code; every other failure normalizes to MAPPING_UNAVAILABLE.
              const isUnrecognizedShape =
                error instanceof Error && error.message.startsWith('GET_FIELD_PROJECT_MAPPING_UNRECOGNIZED_SHAPE');
              partialFailure = true;
              errors.push({
                fieldId,
                code: isUnrecognizedShape ? 'GET_FIELD_PROJECT_MAPPING_UNRECOGNIZED_SHAPE' : 'MAPPING_UNAVAILABLE',
                message: sanitizeErrorMessage(
                  error instanceof Error ? error.message : `Could not retrieve project mapping for '${fieldId}'.`
                ),
              });
            }
          }
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              mappings,
              count: mappings.length,
              errors,
              partialFailure,
              enumeration: {
                customFieldCount: enumeration.count,
                complete: enumeration.complete,
                warnings: enumeration.warnings,
              },
              usage_guidance:
                'scope:"global" with allProjects:true means the field applies to every project (projectCount is null unless resolveGlobalToProjects:true, never 0). ' +
                'scope:"project-scoped" carries the real project ids. verifiable:false (scope project-scoped-jpd / project-scoped-unverifiable) means the mapping endpoint returned a 404 for a field that DOES exist; consult projectsFromScope for the /field scope hint. ' +
                'A field is never reported as "not a custom field" from a truncated enumeration: enumeration.complete gates every negative verdict.',
            }, null, 2),
          }],
        };
      } catch (error: any) {
        logger.error('Failed to get field project mapping', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_FIELD_PROJECT_MAPPING_ERROR',
                message: sanitizeErrorMessage(error.message),
                details: error.details,
                suggestion: error.suggestion || 'Use "get_fields_paginated" with type:["custom"] to find valid custom field IDs',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: createCustomFieldContext
  server.registerTool(
    'create_custom_field_context',
    {
      title: 'Create Custom Field Context',
      description: '⚠️ KNOWN LIMITATION: Some system custom fields are "locked" and cannot have new contexts created. Returns VALIDATION_ERROR for locked fields. Use "get_fields_paginated" to find unlocked custom fields (type=custom).',
      inputSchema: createCustomFieldContextInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = createCustomFieldContextSchema.parse(params);
        
        const requestData: any = {
          name: validatedParams.name,
        };
        
        if (validatedParams.description !== undefined) {
          requestData.description = validatedParams.description;
        }
        
        if (validatedParams.projectIds && validatedParams.projectIds.length > 0) {
          requestData.projectIds = validatedParams.projectIds;
        }
        
        if (validatedParams.issueTypeIds && validatedParams.issueTypeIds.length > 0) {
          requestData.issueTypeIds = validatedParams.issueTypeIds;
        }

        const response = await apiClient.makeRequest<JiraCustomFieldContext>({
          method: 'POST',
          path: `/field/${validatedParams.fieldId}/context`,
          data: requestData,
        });

        if (response.success && response.data) {
          logger.info('Custom field context created successfully', { 
            fieldId: validatedParams.fieldId,
            contextId: response.data.id,
            contextName: response.data.name 
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                customFieldContext: response.data,
                message: `Custom field context '${response.data.name}' created successfully with ID ${response.data.id}`,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to create custom field context');
      } catch (error: any) {
        logger.error('Failed to create custom field context', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'CREATE_CUSTOM_FIELD_CONTEXT_ERROR',
                message: sanitizeErrorMessage(error.message),
                details: error.details,
                suggestion: error.suggestion || 'Ensure the custom field exists and you have Jira Administrator permissions',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: updateCustomFieldContext
  server.registerTool(
    'update_custom_field_context',
    {
      title: 'Update Custom Field Context',
      description: '⚠️ KNOWN LIMITATION: Some system custom fields are "locked" and their contexts cannot be modified. Returns VALIDATION_ERROR for locked fields. Use "get_custom_field_contexts" first to verify the context exists.',
      inputSchema: updateCustomFieldContextInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = updateCustomFieldContextSchema.parse(params);
        
        const updateData: any = {};
        if (validatedParams.name) updateData.name = validatedParams.name;
        if (validatedParams.description !== undefined) updateData.description = validatedParams.description;

        const response = await apiClient.makeRequest<JiraCustomFieldContext>({
          method: 'PUT',
          path: `/field/${validatedParams.fieldId}/context/${validatedParams.contextId}`,
          data: updateData,
        });

        // PUT may return 204 No Content (success with no body) or 200 with data
        if (response.success) {
          logger.info('Custom field context updated successfully', {
            fieldId: validatedParams.fieldId,
            contextId: validatedParams.contextId,
            contextName: response.data?.name || updateData.name
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                customFieldContext: response.data || { id: validatedParams.contextId, ...updateData },
                message: `Custom field context ${validatedParams.contextId} updated successfully`,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to update custom field context');
      } catch (error: any) {
        logger.error('Failed to update custom field context', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'UPDATE_CUSTOM_FIELD_CONTEXT_ERROR',
                message: sanitizeErrorMessage(error.message),
                details: error.details,
                suggestion: error.suggestion || 'Ensure the custom field and context exist and you have admin permissions',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: deleteCustomFieldContext
  server.registerTool(
    'delete_custom_field_context',
    {
      title: 'Delete Custom Field Context',
      description: '⚠️ KNOWN LIMITATION: Some system custom fields are "locked" and their contexts cannot be deleted. Returns VALIDATION_ERROR for locked fields. Use "get_custom_field_contexts" first to verify the context exists.',
      inputSchema: deleteCustomFieldContextInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
      },
    },
    async (params) => {
      try {
        const validatedParams = deleteCustomFieldContextSchema.parse(params);
        
        const response = await apiClient.makeRequest<void>({
          method: 'DELETE',
          path: `/field/${validatedParams.fieldId}/context/${validatedParams.contextId}`,
        });

        if (response.success) {
          logger.info('Custom field context deleted successfully', { 
            fieldId: validatedParams.fieldId,
            contextId: validatedParams.contextId 
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Custom field context ${validatedParams.contextId} deleted successfully`,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to delete custom field context');
      } catch (error: any) {
        logger.error('Failed to delete custom field context', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'DELETE_CUSTOM_FIELD_CONTEXT_ERROR',
                message: sanitizeErrorMessage(error.message),
                details: error.details,
                suggestion: error.suggestion || 'Ensure the custom field context exists, is not in use, and you have admin permissions',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: getCustomFieldOptions
  server.registerTool(
    'get_custom_field_options',
    {
      title: 'Get Custom Field Options',
      description: `⚠️ PREREQUISITES:
1. Use "get_custom_field_contexts" first to discover valid context IDs for the field
2. Field MUST be an options-based type. ONLY these field types support options:
   - Select List (single): schema.custom contains "customfieldtypes:select"
   - Select List (multi): schema.custom contains "customfieldtypes:multiselect"
   - Cascading Select: schema.custom contains "customfieldtypes:cascadingselect"
   - Radio Buttons: schema.custom contains "customfieldtypes:radiobuttons"
   - Checkboxes: schema.custom contains "customfieldtypes:multicheckboxes"

Fields like Text, Number, Date, User Picker do NOT support options and will return "field doesn't support options" error.

Use "get_fields_paginated" to check a field's schema.custom before calling this tool.`,
      inputSchema: getCustomFieldOptionsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = getCustomFieldOptionsSchema.parse(params);

        const queryParams: any = {};
        if (validatedParams.startAt !== 0) queryParams.startAt = validatedParams.startAt;
        if (validatedParams.maxResults !== 50) queryParams.maxResults = validatedParams.maxResults;

        const response = await apiClient.makeRequest<{ values: JiraCustomFieldOption[]; total: number; startAt: number; maxResults: number }>({
          method: 'GET',
          path: `/field/${validatedParams.fieldId}/context/${validatedParams.contextId}/option`,
          params: Object.keys(queryParams).length > 0 ? queryParams : undefined,
        });

        if (response.success && response.data) {
          const customFieldOptions = response.data.values || response.data;

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                customFieldOptions,
                pagination: {
                  startAt: response.data.startAt || 0,
                  maxResults: response.data.maxResults || 50,
                  total: response.data.total || (response.data.values ? response.data.values.length : 0),
                },
                count: response.data.values ? response.data.values.length : 0,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to retrieve custom field options');
      } catch (error: any) {
        logger.error('Failed to get custom field options', { error: error.message });

        // Enhanced error handling with actionable guidance
        let enhancedSuggestion = 'Ensure the custom field and context exist and you have permission to view options';
        let nextSteps: string[] = [];

        if (error.message?.includes("doesn't support options") || error.message?.includes('does not support options')) {
          enhancedSuggestion = `Field ${params.fieldId} does not support options. Only select lists, checkboxes, radio buttons, and cascading selects support options.`;
          nextSteps = [
            `1. Use "get_fields_paginated" to check the field's schema.custom property`,
            '2. Only these types support options: select, multiselect, cascadingselect, radiobuttons, multicheckboxes',
            '3. If you need a field with options, use "create_custom_field" with an appropriate type'
          ];
        } else if (error.message?.includes('not found') || error.message?.includes('NOT_FOUND')) {
          enhancedSuggestion = `Context ID ${params.contextId} not found for field ${params.fieldId}`;
          nextSteps = [
            `1. Use "get_custom_field_contexts" with fieldId "${params.fieldId}" to find available contexts`,
            '2. If no contexts exist, use "create_custom_field_context" to create one',
            '3. Then retry with a valid context ID from step 1'
          ];
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_CUSTOM_FIELD_OPTIONS_ERROR',
                message: sanitizeErrorMessage(error.message),
                details: error.details,
                suggestion: enhancedSuggestion,
                next_steps: nextSteps.length > 0 ? nextSteps : undefined,
                workflow_guidance: nextSteps.length > 0 ? `The proper workflow is: Field Discovery → Context Discovery → Options Retrieval` : undefined
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: createCustomFieldOptions
  server.registerTool(
    'create_custom_field_options',
    {
      title: 'Create Custom Field Options',
      description: `⚠️ PREREQUISITES:
1. Use "get_custom_field_contexts" first to discover valid context IDs for the field
2. Field MUST be an options-based type. ONLY these field types support options:
   - Select List (single): schema.custom contains "customfieldtypes:select"
   - Select List (multi): schema.custom contains "customfieldtypes:multiselect"
   - Cascading Select: schema.custom contains "customfieldtypes:cascadingselect"
   - Radio Buttons: schema.custom contains "customfieldtypes:radiobuttons"
   - Checkboxes: schema.custom contains "customfieldtypes:multicheckboxes"

Fields like Text, Number, Date, User Picker do NOT support options and will return "field doesn't support options" error.

Use "get_fields_paginated" to check a field's schema.custom before calling this tool.`,
      inputSchema: createCustomFieldOptionsInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = createCustomFieldOptionsSchema.parse(params);

        const response = await apiClient.makeRequest<{ options?: JiraCustomFieldOption[] }>({
          method: 'POST',
          path: `/field/${validatedParams.fieldId}/context/${validatedParams.contextId}/option`,
          data: {
            options: validatedParams.options,
          },
        });

        // Validate response structure - Jira should return created options
        if (response.success && response.data) {
          const createdOptions = response.data.options || [];

          // Check if options were actually created
          if (createdOptions.length === 0 && validatedParams.options.length > 0) {
            // API returned success but no options - this is unexpected
            logger.warn('API returned success but no options were created', {
              fieldId: validatedParams.fieldId,
              contextId: validatedParams.contextId,
              requestedCount: validatedParams.options.length,
              responseData: response.data
            });

            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: {
                    code: 'CREATE_OPTIONS_EMPTY_RESPONSE',
                    message: 'API returned success but no options were created',
                    suggestion: 'The field or context may not support options, or options may already exist',
                    next_steps: [
                      '1. Use "get_custom_field_options" to check if options already exist',
                      '2. Verify the field type supports options using "get_fields_paginated"',
                      '3. Check if the context ID is valid using "get_custom_field_contexts"'
                    ],
                    debugInfo: {
                      fieldId: validatedParams.fieldId,
                      contextId: validatedParams.contextId,
                      requestedOptions: validatedParams.options,
                      rawResponse: response.data
                    }
                  },
                }, null, 2),
              }],
              isError: true,
            };
          }

          logger.info('Custom field options created successfully', {
            fieldId: validatedParams.fieldId,
            contextId: validatedParams.contextId,
            requestedCount: validatedParams.options.length,
            createdCount: createdOptions.length
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                customFieldOptions: createdOptions,
                message: `${createdOptions.length} custom field option(s) created successfully`,
                fieldId: validatedParams.fieldId,
                contextId: validatedParams.contextId,
                suggested_next_steps: [
                  'Verify: Use "get_custom_field_options" to confirm options were added',
                  'Note: Options are now available for issues using this field context'
                ]
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to create custom field options: No response data returned');
      } catch (error: any) {
        logger.error('Failed to create custom field options', {
          error: error.message,
          fieldId: params.fieldId,
          contextId: params.contextId,
          code: error.code
        });

        // Enhanced error handling with actionable guidance
        let enhancedSuggestion = 'Ensure the custom field and context exist and you have admin permissions';
        let nextSteps: string[] = [];

        if (error.message?.includes("doesn't support options") || error.message?.includes('does not support options')) {
          enhancedSuggestion = `Field ${params.fieldId} does not support options. Only select lists, checkboxes, radio buttons, and cascading selects support options.`;
          nextSteps = [
            `1. Use "get_fields_paginated" to check the field's schema.custom property`,
            '2. Only these types support options: select, multiselect, cascadingselect, radiobuttons, multicheckboxes',
            '3. If you need a field with options, use "create_custom_field" with type like "com.atlassian.jira.plugin.system.customfieldtypes:select"'
          ];
        } else if (error.message?.includes('not found') || error.message?.includes('NOT_FOUND') || error.message?.includes('404')) {
          enhancedSuggestion = `Context ID ${params.contextId} not found for field ${params.fieldId}`;
          nextSteps = [
            `1. Use "get_custom_field_contexts" with fieldId "${params.fieldId}" to find available contexts`,
            '2. If no contexts exist, use "create_custom_field_context" to create one',
            '3. Then retry with a valid context ID from step 1'
          ];
        } else if (error.message?.includes('duplicate') || error.message?.includes('already exists')) {
          enhancedSuggestion = 'One or more option values already exist in this context';
          nextSteps = [
            '1. Use "get_custom_field_options" to see existing options',
            '2. Remove duplicate values from your options array',
            '3. Retry with only new option values'
          ];
        } else if (error.message?.includes('permission') || error.message?.includes('FORBIDDEN') || error.message?.includes('403')) {
          enhancedSuggestion = 'Insufficient permissions to create custom field options';
          nextSteps = [
            '1. Verify you have Jira Administrator permissions',
            '2. Contact your Jira administrator for access',
            '3. Retry the operation after permissions are granted'
          ];
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'CREATE_CUSTOM_FIELD_OPTIONS_ERROR',
                message: sanitizeErrorMessage(error.message),
                details: error.details,
                suggestion: enhancedSuggestion,
                next_steps: nextSteps.length > 0 ? nextSteps : undefined,
                related_tools: ['get_custom_field_contexts', 'get_custom_field_options', 'get_fields_paginated']
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // REMOVED: get_custom_field_options_guided - Cloud API limitation (aggregated queries not reliable)

  // Field context tools registered successfully (logging disabled for MCP compatibility)
}