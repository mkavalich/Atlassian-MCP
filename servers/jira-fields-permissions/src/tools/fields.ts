import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { JiraApiClient } from '../api/client.js';
import {
  createCustomFieldSchema,
  updateCustomFieldSchema,
  deleteCustomFieldSchema,
  getFieldsPaginatedSchema,
} from '../validation/schemas.js';
import {
  createCustomFieldInputSchema,
  updateCustomFieldInputSchema,
  deleteCustomFieldInputSchema,
  getFieldsPaginatedInputSchema,
} from '../validation/input-schemas.js';
import { JiraField } from '../types/index.js';
import { logger } from '../utils/logger.js';


export async function registerFieldTools(server: McpServer, apiClient: JiraApiClient) {
  // Tool: getFieldsPaginated
  server.registerTool(
    'get_fields_paginated',
    {
      title: 'Get Fields (Paginated)',
      description: '🔍 DISCOVERY TOOL: Primary discovery method for field operations. Use this first to find available field IDs before using other field management tools. Returns comprehensive list with IDs, names, and key properties needed for subsequent operations.',
      inputSchema: getFieldsPaginatedInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = getFieldsPaginatedSchema.parse(params);

        // Build query parameters
        const queryParams = new URLSearchParams();

        if (validatedParams.query) {
          queryParams.append('query', validatedParams.query);
        }

        if (validatedParams.type && validatedParams.type.length > 0) {
          validatedParams.type.forEach(type => {
            queryParams.append('type', type);
          });
        }

        if (validatedParams.orderBy) {
          queryParams.append('orderBy', validatedParams.orderBy);
        }

        if (validatedParams.expand) {
          queryParams.append('expand', validatedParams.expand);
        }

        queryParams.append('startAt', validatedParams.startAt.toString());
        queryParams.append('maxResults', validatedParams.maxResults.toString());

        const response = await apiClient.makeRequest<{
          startAt: number;
          maxResults: number;
          total: number;
          values: JiraField[];
        }>({
          method: 'GET',
          path: `/field/search?${queryParams.toString()}`,
        });

        if (response.success && response.data) {
          const fields = response.data.values;

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                fields,
                startAt: response.data.startAt,
                maxResults: response.data.maxResults,
                total: response.data.total,
                count: fields.length,
                breakdown: {
                  custom: fields.filter(f => f.isCustom).length,
                  system: fields.filter(f => !f.isCustom).length,
                },
                pagination: {
                  hasMore: response.data.startAt + fields.length < response.data.total,
                  nextStartAt: response.data.startAt + fields.length,
                },
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get fields');
      } catch (error: any) {
        logger.error('Failed to get fields', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_FIELDS_ERROR',
                message: error.message,
                details: error.details,
                suggestion: error.suggestion || 'Check your query parameters and ensure you have proper Jira permissions',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: createCustomField
  server.registerTool(
    'create_custom_field',
    {
      title: 'Create Custom Field',
      description: '🆕 CREATE: Creates a new custom field in Jira with specified configuration. After creation, use the returned ID with other field management tools. Related tools: "get_fields_paginated", "update_custom_field".',
      inputSchema: createCustomFieldInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = createCustomFieldSchema.parse(params);
        
        const response = await apiClient.makeRequest<JiraField>({
          method: 'POST',
          path: '/field',
          data: {
            name: validatedParams.name,
            description: validatedParams.description,
            type: validatedParams.type,
            searcherKey: validatedParams.searcherKey,
          },
        });

        if (response.success && response.data) {
          logger.info('Custom field created successfully', { 
            fieldId: response.data.id,
            fieldName: response.data.name 
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                field: response.data,
                message: `Custom field '${response.data.name}' created successfully`,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to create custom field');
      } catch (error: any) {
        logger.error('Failed to create custom field', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'CREATE_CUSTOM_FIELD_ERROR',
                message: error.message,
                details: error.details,
                suggestion: error.suggestion || 'Ensure you have Jira Administrator permissions and the field type is valid',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: updateCustomField
  server.registerTool(
    'update_custom_field',
    {
      title: 'Update Custom Field',
      description: '⚠️ PREREQUISITE: Use "get_fields_paginated" first to find valid field IDs. Updates the name or description of a custom field. If you get "Field not found" errors, the field likely doesn\'t exist - use the discovery tool to find valid IDs first.',
      inputSchema: updateCustomFieldInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = updateCustomFieldSchema.parse(params);
        const { fieldId, ...updateData } = validatedParams;

        const response = await apiClient.makeRequest<JiraField>({
          method: 'PUT',
          path: `/field/${fieldId}`,
          data: updateData,
        });

        if (response.success) {
          logger.info('Custom field updated successfully', {
            fieldId: fieldId,
            fieldName: updateData.name || 'unchanged'
          });

          // PUT may return 204 No Content, so response.data might be empty
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                fieldId: fieldId,
                updatedFields: updateData,
                field: response.data || null,
                message: `Custom field '${fieldId}' updated successfully`,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to update custom field');
      } catch (error: any) {
        logger.error('Failed to update custom field', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'UPDATE_CUSTOM_FIELD_ERROR',
                message: error.message,
                details: error.details,
                suggestion: error.suggestion,
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: deleteCustomField
  server.registerTool(
    'delete_custom_field',
    {
      title: 'Delete Custom Field',
      description: '⚠️ PREREQUISITE: Use "get_fields_paginated" first to find valid field IDs. Deletes a custom field from Jira. If you get "Field not found" errors, the field likely doesn\'t exist - use the discovery tool to find valid IDs first.',
      inputSchema: deleteCustomFieldInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
      },
    },
    async (params) => {
      try {
        const validatedParams = deleteCustomFieldSchema.parse(params);
        
        logger.warn('Custom field deletion requested', { 
          fieldId: validatedParams.fieldId 
        });

        const response = await apiClient.makeRequest<void>({
          method: 'DELETE',
          path: `/field/${validatedParams.fieldId}`,
        });

        if (response.success) {
          logger.info('Custom field deleted successfully', { 
            fieldId: validatedParams.fieldId 
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Custom field '${validatedParams.fieldId}' deleted successfully`,
                warning: 'This action cannot be undone. All data associated with this field has been removed.',
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to delete custom field');
      } catch (error: any) {
        logger.error('Failed to delete custom field', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'DELETE_CUSTOM_FIELD_ERROR',
                message: error.message,
                details: error.details,
                suggestion: error.suggestion || 'Verify the field exists and is not a system field',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Field tools registered successfully (logging disabled for MCP compatibility)
}