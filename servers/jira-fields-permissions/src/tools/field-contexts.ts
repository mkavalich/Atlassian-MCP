import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { JiraApiClient } from '../api/client.js';
import {
  getCustomFieldContextsSchema,
  createCustomFieldContextSchema,
  updateCustomFieldContextSchema,
  deleteCustomFieldContextSchema,
  getCustomFieldOptionsSchema,
  createCustomFieldOptionsSchema,
} from '../validation/schemas.js';
import {
  getCustomFieldContextsInputSchema,
  createCustomFieldContextInputSchema,
  updateCustomFieldContextInputSchema,
  deleteCustomFieldContextInputSchema,
  getCustomFieldOptionsInputSchema,
  createCustomFieldOptionsInputSchema,
  // REMOVED: getCustomFieldOptionsGuidedInputSchema - Cloud API limitation
} from '../validation/input-schemas.js';
import {
  JiraCustomFieldContext,
  JiraCustomFieldOption
} from '../types/index.js';
import { logger } from '../utils/logger.js';
import { sanitizeErrorMessage } from '../utils/errors.js';

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
          const contexts = response.data.values || response.data;
          const count = contexts.length || 0;

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