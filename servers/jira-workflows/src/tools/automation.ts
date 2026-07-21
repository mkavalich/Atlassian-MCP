import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { JiraApiClient } from '../api/client.js';
import {
  getAutomationRulesSchema,
  getAutomationRuleDetailsSchema,
  getAutomationTemplatesSchema,
  createAutomationRuleSchema,
  updateAutomationRuleSchema,
  enableDisableAutomationRuleSchema,
} from '../validation/schemas.js';
import {
  getAutomationRulesInputSchema,
  getAutomationRuleDetailsInputSchema,
  getAutomationTemplatesInputSchema,
  getAutomationComponentTypesInputSchema,
  createAutomationRuleInputSchema,
  updateAutomationRuleInputSchema,
  enableDisableAutomationRuleInputSchema,
} from '../validation/input-schemas.js';
import {
  JiraAutomationRule,
  JiraAutomationTemplate,
} from '../types/index.js';
import { logger } from '../utils/logger.js';
import { sanitizeErrorMessage } from '../utils/errors.js';
import {
  resolveComponentType,
  getDefaultValue,
  TRIGGER_TYPES,
  ACTION_TYPES,
  CONDITION_TYPES,
  BRANCH_TYPES,
  type ComponentTypeEntry,
  type ComponentCategory,
} from './automation-component-types.js';
import { toolExamples } from '../validation/tool-examples.js';

/**
 * Pulls the opaque `cursor` value out of an Automation API `links.next`, which
 * has the form "?cursor=<opaque>&limit=50".
 *
 * Returns null when there is no next link. Never throws and never invents a
 * cursor: a malformed link yields null, which surfaces as hasMore/nextCursor
 * disagreeing rather than as a silently truncated walk.
 */
export function extractCursor(next: string | null | undefined): string | null {
  if (!next) return null;
  const match = /[?&]cursor=([^&]+)/.exec(next);
  if (!match || !match[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export async function registerAutomationTools(server: McpServer, apiClient: JiraApiClient) {
  // Tool: get_automation_rules (Discovery Tool - 🔍)
  server.registerTool(
    'get_automation_rules',
    {
      title: 'Get Automation Rules',
      description: '🔍 DISCOVERY TOOL: Lists automation rules (uuid, name, state, author). Each rule\'s `uuid` is the identifier for "get_automation_rule_details", which returns the full trigger and components. Pagination is cursor-based: pass `limit`, then feed `nextCursor` back as `cursor`. The Jira Automation API supports no server-side filtering - name/enabled/author/project filters are rejected rather than silently ignored, so filter client-side on the returned rules.',
      inputSchema: getAutomationRulesInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        // Rejects includeDetails and every server-side filter with a message
        // naming the working alternative. GET /rule returns 404 with a zero-byte
        // body, so there is no listing endpoint that can carry rule details.
        const validatedParams = getAutomationRulesSchema.parse(params);

        // `limit` and `cursor` are the only parameters this API honours.
        const requestParams: Record<string, string | number> = {};
        if (validatedParams.limit !== undefined) requestParams.limit = validatedParams.limit;
        if (validatedParams.cursor !== undefined) requestParams.cursor = validatedParams.cursor;

        const response = await apiClient.makeAutomationRequest<{
          data: JiraAutomationRule[];
          links?: { self?: string | null; next?: string | null; prev?: string | null };
        }>({
          method: 'GET',
          path: '/rule/summary',
          params: requestParams,
        });

        if (response.success && response.data) {
          const rules = response.data.data || [];
          const links = response.data.links;

          // `links.next` looks like "?cursor=<opaque>&limit=50" and is the ONLY
          // continuation signal this API emits.
          const nextCursor = extractCursor(links?.next);

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                rules: rules,
                // No `total`: the Automation API returns no total, count, size or
                // isLast anywhere in the response. The previous code emitted the
                // length of the current page under the name `total`, which made a
                // partial page look like the complete rule set, and derived
                // hasMore from it as `n > startAt + n` -- structurally false for
                // every permitted input.
                count: rules.length,
                nextCursor: nextCursor,
                hasMore: Boolean(links?.next),
                detailsIncluded: false,
                endpoint: '/rule/summary',
                usage_guidance:
                  'Rules are identified by `uuid`. Pass one to get_automation_rule_details ' +
                  'for its full trigger and components. If hasMore is true, call again with ' +
                  'cursor set to nextCursor.',
              }, null, 2),
            }],
          };
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: 'Failed to retrieve automation rules',
              rules: [],
              count: 0,
            }, null, 2),
          }],
        };
      } catch (error) {
        logger.error('Failed to get automation rules', { error: error instanceof Error ? error.message : String(error) });

        // Enhanced error handling for permission issues
        let errorMessage = error instanceof Error ? sanitizeErrorMessage(error.message) : 'Unknown error occurred';
        let userGuidance = '';

        if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
          userGuidance = ' Note: You may need "Administer Jira" or "Project Administrator" permissions to access automation rules. Contact your Jira administrator if needed.';
        } else if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
          userGuidance = ' Note: Automation features may not be available in your Jira instance or may require additional licensing.';
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: errorMessage + userGuidance,
              rules: [],
              count: 0,
            }, null, 2),
          }],
        };
      }
    }
  );

  // Tool: get_automation_rule_details (Discovery Tool - 🔍)
  server.registerTool(
    'get_automation_rule_details',
    {
      title: 'Get Automation Rule Details',
      description: '🔍 DISCOVERY TOOL: ⚠️ PREREQUISITE: Use "get_automation_rules" first to find valid rule IDs. If get_automation_rules returns an empty list, no rules exist yet - create one in Jira UI or with create_automation_rule first. Returns NOT_FOUND if the rule ID doesn\'t exist.',
      inputSchema: getAutomationRuleDetailsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = getAutomationRuleDetailsSchema.parse(params);

        const response = await apiClient.makeAutomationRequest<JiraAutomationRule>({
          method: 'GET',
          path: `/rule/${validatedParams.ruleId}`,
          params: {
            expand: validatedParams.expand,
          },
        });

        if (response.success && response.data) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                rule: response.data,
                ruleId: validatedParams.ruleId,
                metadata: {
                  executionTime: response.metadata?.executionTime,
                  rateLimitInfo: response.metadata?.rateLimitInfo,
                },
              }, null, 2),
            }],
          };
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: `Failed to retrieve automation rule details for rule ID: ${validatedParams.ruleId}`,
              ruleId: validatedParams.ruleId,
            }, null, 2),
          }],
        };
      } catch (error) {
        logger.error('Failed to get automation rule details', { error: error instanceof Error ? error.message : String(error) });

        // Enhanced error handling for specific issues
        let errorMessage = error instanceof Error ? sanitizeErrorMessage(error.message) : 'Unknown error occurred';
        let userGuidance = '';

        if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
          userGuidance = ' Note: The rule ID may not exist or may have been deleted. Use "get_automation_rules" to find valid rule IDs.';
        } else if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
          userGuidance = ' Note: You may need "Administer Jira" or "Project Administrator" permissions to view detailed rule configurations.';
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: errorMessage + userGuidance,
              ruleId: params.ruleId,
            }, null, 2),
          }],
        };
      }
    }
  );

  // Tool: get_automation_templates (Discovery Tool - 🔍)
  server.registerTool(
    'get_automation_templates',
    {
      title: 'Get Automation Templates',
      description: '🔍 DISCOVERY TOOL: Retrieves available automation rule templates that can be used as starting points for creating new rules. Templates provide pre-configured triggers, conditions, and actions for common automation scenarios.',
      inputSchema: getAutomationTemplatesInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = getAutomationTemplatesSchema.parse(params);

        // GET /template/search returns {links, data} -- NOT {values, total}.
        // Reading `.values` yielded undefined, `|| []` turned that into an empty
        // list, and `.total || templates.length` turned it into 0, so the tool
        // reported {count:0, total:0, hasMore:false} against 50 real templates
        // under success:true. The repair is to read the correct key; defaulting
        // to [] is what made a parsing failure look like an empty instance.
        const response = await apiClient.makeAutomationRequest<{
          data: JiraAutomationTemplate[];
          links?: { self?: string | null; next?: string | null; prev?: string | null };
        }>({
          method: 'GET',
          path: '/template/search',
          params: {
            ...(validatedParams.category !== undefined ? { category: validatedParams.category } : {}),
            ...(validatedParams.maxResults !== undefined ? { limit: validatedParams.maxResults } : {}),
          },
        });

        if (response.success && response.data) {
          const templates = response.data.data;

          // A missing `data` key means the response shape changed. Say so rather
          // than reporting an empty template catalogue.
          if (!Array.isArray(templates)) {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error:
                    'Unexpected response shape from /template/search: expected a `data` array. ' +
                    'Refusing to report an empty template list, which would be indistinguishable ' +
                    'from an instance that genuinely has no templates.',
                  partialFailure: true,
                  templates: null,
                  count: null,
                }, null, 2),
              }],
              isError: true,
            };
          }

          const links = response.data.links;

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                templates: templates,
                // No `total`: this API returns no count of the full catalogue.
                count: templates.length,
                nextCursor: extractCursor(links?.next),
                hasMore: Boolean(links?.next),
              }, null, 2),
            }],
          };
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: 'Failed to retrieve automation templates',
              templates: [],
              count: 0,
            }, null, 2),
          }],
        };
      } catch (error) {
        logger.error('Failed to get automation templates', { error: error instanceof Error ? error.message : String(error) });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? sanitizeErrorMessage(error.message) : 'Unknown error occurred',
              templates: [],
              count: 0,
            }, null, 2),
          }],
        };
      }
    }
  );

  // Tool: get_automation_component_types (Discovery Tool - 🔍)
  server.registerTool(
    'get_automation_component_types',
    {
      title: 'Get Automation Component Types',
      description: '🔍 DISCOVERY TOOL: Returns all available automation component types (triggers, actions, conditions, branches) with their friendly names, API identifiers, descriptions, and default value schemas. Use this BEFORE create_automation_rule to discover what types are available and what value structure each type requires.',
      inputSchema: getAutomationComponentTypesInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const category = (params as any).category as ComponentCategory | undefined;

        const TYPE_MAPS: Record<string, Record<string, ComponentTypeEntry>> = {
          TRIGGER: TRIGGER_TYPES,
          ACTION: ACTION_TYPES,
          CONDITION: CONDITION_TYPES,
          BRANCH: BRANCH_TYPES,
        };

        const categories = category ? { [category]: TYPE_MAPS[category] } : TYPE_MAPS;
        const result: Record<string, Record<string, { apiType: string; description: string; defaultValue: unknown }>> = {};

        for (const [cat, typeMap] of Object.entries(categories)) {
          if (!typeMap) continue;
          result[cat] = {};
          for (const [name, entry] of Object.entries(typeMap)) {
            result[cat][name] = {
              apiType: entry.apiType,
              description: entry.description,
              defaultValue: entry.defaultValue,
            };
          }
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              componentTypes: result,
              usage: {
                note: 'Use the friendly name (e.g., ISSUE_CREATED) or apiType (e.g., jira.issue.event.trigger:created) as the "type" field in create_automation_rule.',
                autoPopulate: 'If you omit the "value" field, the defaultValue shown here is auto-populated. Override specific fields as needed.',
                example: {
                  trigger: { type: 'ISSUE_CREATED' },
                  components: [{ type: 'LOG_ACTION', value: 'Issue {{issue.key}} created' }],
                },
              },
            }, null, 2),
          }],
        };
      } catch (error) {
        logger.error('Failed to get automation component types', { error: error instanceof Error ? error.message : String(error) });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? sanitizeErrorMessage(error.message) : 'Unknown error occurred',
            }, null, 2),
          }],
        };
      }
    }
  );

  // Tool: create_automation_rule (Management Tool - ⚙️)
  server.registerTool(
    'create_automation_rule',
    {
      title: 'Create Automation Rule',
      description: '⚙️ MANAGEMENT TOOL: Creates a new automation rule. Use get_automation_component_types first to discover available types and their value schemas. Requires authorAccountId (get from get_automation_rules). If value is omitted, verified defaults are auto-populated.',
      inputSchema: createAutomationRuleInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
      examples: toolExamples['create_automation_rule'],
    },
    async (params) => {
      try {
        // Handle both old schema (actions) and new schema (components)
        // This allows backwards compatibility while schema cache updates
        const rawParams = params as any;

        // Transform old format to new format if needed
        if (rawParams.actions && !rawParams.components) {
          // Old format: actions with simplified types
          // Transform to new format: components with raw API types
          rawParams.components = rawParams.actions.map((action: any) => ({
            component: 'ACTION',
            schemaVersion: 1,
            type: action.type, // Will be simplified type, may fail at API level
            value: action.configuration || {},
            conditions: [],
            children: [],
          }));
        }

        // Transform old trigger format if it uses simplified types
        if (rawParams.trigger && !rawParams.trigger.component) {
          rawParams.trigger = {
            component: 'TRIGGER',
            schemaVersion: 1,
            type: rawParams.trigger.type,
            value: rawParams.trigger.configuration || {},
            conditions: [],
          };
        }

        // Resolve friendly type names to raw API identifiers
        if (rawParams.trigger?.type) {
          try {
            rawParams.trigger.type = resolveComponentType('TRIGGER', rawParams.trigger.type);
          } catch (e) {
            // If resolution fails, pass through unchanged (let API validate)
            logger.warn('Trigger type resolution failed, passing through', { type: rawParams.trigger.type, error: (e as Error).message });
          }
        }
        if (rawParams.components && Array.isArray(rawParams.components)) {
          for (const comp of rawParams.components) {
            if (comp.type) {
              const category = comp.component === 'CONDITION' ? 'CONDITION'
                : comp.component === 'CONDITION_BLOCK' ? 'CONDITION_BLOCK'
                : comp.component === 'BRANCH' ? 'BRANCH'
                : 'ACTION';
              try {
                comp.type = resolveComponentType(category, comp.type);
              } catch (e) {
                logger.warn('Component type resolution failed, passing through', { type: comp.type, component: comp.component, error: (e as Error).message });
              }
            }
          }
        }
        if (rawParams.conditions && Array.isArray(rawParams.conditions)) {
          for (const cond of rawParams.conditions) {
            if (cond.type) {
              try {
                cond.type = resolveComponentType('CONDITION', cond.type);
              } catch (e) {
                logger.warn('Condition type resolution failed, passing through', { type: cond.type, error: (e as Error).message });
              }
            }
          }
        }

        // Auto-populate missing value fields from verified default schemas
        // This allows callers to specify just the type and get a working rule
        if (rawParams.trigger?.type && !rawParams.trigger.value) {
          const defaultVal = getDefaultValue('TRIGGER', rawParams.trigger.type);
          if (defaultVal !== undefined) {
            rawParams.trigger.value = defaultVal;
            logger.info('Auto-populated trigger value from defaults', { type: rawParams.trigger.type });
          }
        }
        if (rawParams.components && Array.isArray(rawParams.components)) {
          for (const comp of rawParams.components) {
            if (comp.type && !comp.value) {
              const category = comp.component === 'CONDITION' ? 'CONDITION'
                : comp.component === 'CONDITION_BLOCK' ? 'CONDITION'
                : comp.component === 'BRANCH' ? 'BRANCH'
                : 'ACTION';
              const defaultVal = getDefaultValue(category, comp.type);
              if (defaultVal !== undefined) {
                comp.value = defaultVal;
                logger.info('Auto-populated component value from defaults', { type: comp.type, component: comp.component });
              }
            }
          }
        }
        if (rawParams.conditions && Array.isArray(rawParams.conditions)) {
          for (const cond of rawParams.conditions) {
            if (cond.type && !cond.value) {
              const defaultVal = getDefaultValue('CONDITION', cond.type);
              if (defaultVal !== undefined) {
                cond.value = defaultVal;
                logger.info('Auto-populated condition value from defaults', { type: cond.type });
              }
            }
          }
        }

        const validatedParams = createAutomationRuleSchema.parse(rawParams);

        // Build the rule payload in raw Atlassian API format
        // IMPORTANT: API expects {rule: {...}, connections: []} wrapper per official docs:
        // https://developer.atlassian.com/cloud/automation/rest/api-group-rule-management/
        // CRITICAL: authorAccountId is REQUIRED - discovered via API testing (CREATE fails without it)
        const ruleData: any = {
          name: validatedParams.name,
          description: validatedParams.description,
          state: validatedParams.state ?? 'ENABLED',
          authorAccountId: validatedParams.authorAccountId,
          actor: validatedParams.actor ?? {
            type: 'ACCOUNT_ID',
            actor: validatedParams.authorAccountId, // Default actor to author if not specified
          },
          trigger: validatedParams.trigger,
          components: validatedParams.components,
          canOtherRuleTrigger: validatedParams.canOtherRuleTrigger ?? false,
          notifyOnError: validatedParams.notifyOnError ?? 'FIRSTERROR',
          labels: validatedParams.labels ?? [],
          writeAccessType: 'UNRESTRICTED',
          collaborators: [],
        };

        // Add project scoping via ARIs if provided
        if (validatedParams.ruleScopeARIs && validatedParams.ruleScopeARIs.length > 0) {
          ruleData.ruleScopeARIs = validatedParams.ruleScopeARIs;
        }

        // Add top-level conditions if provided (usually nested in trigger/components)
        if (validatedParams.conditions && validatedParams.conditions.length > 0) {
          ruleData.conditions = validatedParams.conditions;
        }

        // Wrap in required {rule: {...}, connections: []} format per Atlassian API spec
        const requestBody = {
          rule: ruleData,
          connections: [],
        };

        const response = await apiClient.makeAutomationRequest<JiraAutomationRule>({
          method: 'POST',
          path: '/rule',
          data: requestBody,
        });

        if (response.success && response.data) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                rule: response.data,
                message: `Automation rule "${response.data.name}" created successfully`,
                metadata: {
                  executionTime: response.metadata?.executionTime,
                  rateLimitInfo: response.metadata?.rateLimitInfo,
                },
              }, null, 2),
            }],
          };
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: 'Failed to create automation rule',
            }, null, 2),
          }],
        };
      } catch (error: any) {
        logger.error('Failed to create automation rule', { error: error instanceof Error ? error.message : String(error) });

        // Enhanced error extraction for JiraApiError and other error types
        let errorMessage = 'Unknown error occurred';
        let errorCode = 'UNKNOWN_ERROR';
        let suggestion = '';

        if (error instanceof Error) {
          errorMessage = error.message;
          if ('code' in error) errorCode = (error as any).code;
          if ('suggestion' in error) suggestion = (error as any).suggestion;
        } else if (typeof error === 'object' && error !== null) {
          errorMessage = error.message || error.error || JSON.stringify(error);
          errorCode = error.code || 'UNKNOWN_ERROR';
          suggestion = error.suggestion || '';
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: sanitizeErrorMessage(errorMessage),
              errorCode,
              suggestion: suggestion || 'Check your permissions and rule configuration',
            }, null, 2),
          }],
        };
      }
    }
  );

  // Tool: update_automation_rule (Management Tool - ⚙️)
  server.registerTool(
    'update_automation_rule',
    {
      title: 'Update Automation Rule',
      description: '⚙️ MANAGEMENT TOOL: ⚠️ PREREQUISITE: Use "get_automation_rules" first to find valid rule IDs. If no rules exist (empty list returned), you cannot use this tool - create a rule first. The API requires complete rule objects, so this tool fetches the current rule and merges your updates.',
      inputSchema: updateAutomationRuleInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
      examples: toolExamples['update_automation_rule'],
    },
    async (params) => {
      try {
        const validatedParams = updateAutomationRuleSchema.parse(params);

        // IMPORTANT: Atlassian Automation API requires COMPLETE rule objects for PUT
        // First, fetch the current rule to get its full configuration
        const getResponse = await apiClient.makeAutomationRequest<{ rule: any; connections: any[] }>({
          method: 'GET',
          path: `/rule/${validatedParams.ruleId}`,
        });

        if (!getResponse.success || !getResponse.data?.rule) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: `Failed to fetch current rule configuration for rule ID: ${validatedParams.ruleId}`,
              }, null, 2),
            }],
          };
        }

        // Get the current rule and connections
        const currentRule = getResponse.data.rule;
        const connections = getResponse.data.connections || [];

        // Merge updates into the current rule
        if (validatedParams.name !== undefined) currentRule.name = validatedParams.name;
        if (validatedParams.description !== undefined) currentRule.description = validatedParams.description;
        if (validatedParams.enabled !== undefined) currentRule.state = validatedParams.enabled ? 'ENABLED' : 'DISABLED';

        // Merge trigger if provided (resolve type + auto-populate value)
        if (validatedParams.trigger) {
          const trigger = validatedParams.trigger as any;
          if (trigger.type) {
            try {
              trigger.type = resolveComponentType('TRIGGER', trigger.type);
            } catch { /* pass through raw type */ }
            if (!trigger.value) {
              const defaultVal = getDefaultValue('TRIGGER', trigger.type);
              if (defaultVal !== undefined) {
                trigger.value = typeof defaultVal === 'string' ? defaultVal : JSON.parse(JSON.stringify(defaultVal));
              }
            }
          }
          currentRule.trigger = trigger;
        }

        // Merge actions if provided (resolve types + auto-populate values)
        if (validatedParams.actions) {
          currentRule.components = (validatedParams.actions as any[]).map((action) => {
            if (action.type) {
              try {
                action.type = resolveComponentType('ACTION', action.type);
              } catch { /* pass through raw type */ }
              if (!action.value) {
                const defaultVal = getDefaultValue('ACTION', action.type);
                if (defaultVal !== undefined) {
                  action.value = typeof defaultVal === 'string' ? defaultVal : JSON.parse(JSON.stringify(defaultVal));
                }
              }
            }
            // Ensure component field is set
            if (!action.component) action.component = 'ACTION';
            return action;
          });
        }

        // Merge conditions if provided (resolve types + auto-populate values)
        if (validatedParams.conditions) {
          // Conditions go into the trigger's conditions array
          const resolvedConditions = (validatedParams.conditions as any[]).map((condition) => {
            if (condition.type) {
              try {
                condition.type = resolveComponentType('CONDITION', condition.type);
              } catch { /* pass through raw type */ }
              if (!condition.value) {
                const defaultVal = getDefaultValue('CONDITION', condition.type);
                if (defaultVal !== undefined) {
                  condition.value = typeof defaultVal === 'string' ? defaultVal : JSON.parse(JSON.stringify(defaultVal));
                }
              }
            }
            if (!condition.component) condition.component = 'CONDITION';
            return condition;
          });
          if (currentRule.trigger) {
            currentRule.trigger.conditions = resolvedConditions;
          }
        }

        // Wrap in required {rule: {...}, connections: [...]} format
        const requestBody = {
          rule: currentRule,
          connections: connections,
        };

        const response = await apiClient.makeAutomationRequest<JiraAutomationRule>({
          method: 'PUT',
          path: `/rule/${validatedParams.ruleId}`,
          data: requestBody,
        });

        if (response.success && response.data) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                rule: response.data,
                message: `Automation rule "${response.data.name}" updated successfully`,
                metadata: {
                  executionTime: response.metadata?.executionTime,
                  rateLimitInfo: response.metadata?.rateLimitInfo,
                },
              }, null, 2),
            }],
          };
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: 'Failed to update automation rule',
            }, null, 2),
          }],
        };
      } catch (error: any) {
        logger.error('Failed to update automation rule', { error: error instanceof Error ? error.message : String(error) });

        // Enhanced error extraction for JiraApiError and other error types
        let errorMessage = 'Unknown error occurred';
        let errorCode = 'UNKNOWN_ERROR';
        let userGuidance = '';

        // Extract error details from JiraApiError or standard Error
        if (error && typeof error === 'object') {
          errorCode = error.code || 'UNKNOWN_ERROR';

          // Try to get a meaningful error message
          if (error.message && !error.message.includes('[object Object]')) {
            errorMessage = error.message;
          } else if (error.details) {
            // Extract from JiraApiError.details (the raw API response)
            const details = error.details;
            if (details.errorMessages && Array.isArray(details.errorMessages)) {
              errorMessage = details.errorMessages.join('; ');
            } else if (details.errors && typeof details.errors === 'object') {
              errorMessage = Object.entries(details.errors)
                .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
                .join('; ');
            } else if (details.message) {
              errorMessage = details.message;
            } else {
              errorMessage = JSON.stringify(details);
            }
          } else if (error.message) {
            errorMessage = error.message;
          }
        } else if (error instanceof Error) {
          errorMessage = error.message;
        }

        if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
          userGuidance = ' Note: The rule ID may not exist or may have been deleted. Use "get_automation_rules" to find valid rule IDs.';
        } else if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
          userGuidance = ' Note: You may need "Administer Jira" or "Project Administrator" permissions to update automation rules.';
        } else if (errorMessage.includes('400') || errorMessage.includes('Bad Request')) {
          userGuidance = ' Note: Check that the rule configuration is valid. Verify trigger and action configurations match the expected format.';
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: sanitizeErrorMessage(errorMessage) + userGuidance,
              errorCode,
            }, null, 2),
          }],
        };
      }
    }
  );

  // Tool: enable_disable_automation_rule (Management Tool - ⚙️)
  server.registerTool(
    'enable_disable_automation_rule',
    {
      title: 'Enable/Disable Automation Rule',
      description: '⚙️ MANAGEMENT TOOL: ⚠️ PREREQUISITE: Use "get_automation_rules" first to find valid rule IDs. If no rules exist (empty list returned), you cannot use this tool - create a rule first. Returns NOT_FOUND if the rule ID is invalid.',
      inputSchema: enableDisableAutomationRuleInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = enableDisableAutomationRuleSchema.parse(params);

        const response = await apiClient.makeAutomationRequest<void>({
          method: 'PUT',
          path: `/rule/${validatedParams.ruleId}/state`,
          data: {
            value: validatedParams.enabled ? 'ENABLED' : 'DISABLED',
          },
        });

        if (response.success) {
          const action = validatedParams.enabled ? 'enabled' : 'disabled';
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                ruleId: validatedParams.ruleId,
                message: `Automation rule ${action} successfully`,
                metadata: {
                  executionTime: response.metadata?.executionTime,
                  rateLimitInfo: response.metadata?.rateLimitInfo,
                },
              }, null, 2),
            }],
          };
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: 'Failed to update automation rule status',
            }, null, 2),
          }],
        };
      } catch (error) {
        logger.error('Failed to enable/disable automation rule', { error: error instanceof Error ? error.message : String(error) });

        // Enhanced error handling for enable/disable issues
        let errorMessage = error instanceof Error ? sanitizeErrorMessage(error.message) : 'Unknown error occurred';
        let userGuidance = '';

        if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
          userGuidance = ' Note: The rule ID may not exist or may have been deleted. Use "get_automation_rules" to find valid rule IDs.';
        } else if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
          userGuidance = ' Note: You may need "Administer Jira" or "Project Administrator" permissions to enable/disable automation rules.';
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: errorMessage + userGuidance,
            }, null, 2),
          }],
        };
      }
    }
  );

}