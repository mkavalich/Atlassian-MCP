import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { JiraApiClient } from '../api/client.js';
import {
  getFieldConfigurationsSchema,
  createFieldConfigurationSchema,
  updateFieldConfigurationSchema,
  getFieldConfigurationSchemesSchema,
  createFieldConfigurationSchemeSchema,
} from '../validation/schemas.js';
import {
  getFieldConfigurationsInputSchema,
  createFieldConfigurationInputSchema,
  updateFieldConfigurationInputSchema,
  getFieldConfigurationSchemesInputSchema,
  createFieldConfigurationSchemeInputSchema,
} from '../validation/input-schemas.js';
import {
  JiraFieldConfiguration,
  JiraFieldConfigurationScheme
} from '../types/index.js';
import { logger } from '../utils/logger.js';

export async function registerFieldConfigurationTools(server: McpServer, apiClient: JiraApiClient) {
  // Tool: getFieldConfigurations
  server.registerTool(
    'get_field_configurations',
    {
      title: 'Get Field Configurations',
      description: '🔍 DISCOVERY TOOL: Primary discovery method for field configuration operations. Use this first to find available field configuration IDs before using other field configuration management tools. Returns comprehensive list with IDs, names, and key properties needed for subsequent operations.',
      inputSchema: getFieldConfigurationsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = getFieldConfigurationsSchema.parse(params);

        const queryParams: any = {};
        if (validatedParams.startAt !== 0) queryParams.startAt = validatedParams.startAt;
        if (validatedParams.maxResults !== 50) queryParams.maxResults = validatedParams.maxResults;

        const response = await apiClient.makeRequest<{ values: JiraFieldConfiguration[]; total: number; startAt: number; maxResults: number }>({
          method: 'GET',
          path: '/fieldconfiguration',
          params: Object.keys(queryParams).length > 0 ? queryParams : undefined,
        });

        if (response.success && response.data) {
          const fieldConfigurations = response.data.values || response.data;

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                fieldConfigurations,
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

        throw new Error('Failed to retrieve field configurations');
      } catch (error: any) {
        logger.error('Failed to get field configurations', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_FIELD_CONFIGURATIONS_ERROR',
                message: error.message,
                details: error.details,
                suggestion: error.suggestion || 'Ensure you have permission to view field configurations',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: createFieldConfiguration
  server.registerTool(
    'create_field_configuration',
    {
      title: 'Create Field Configuration',
      description: '🆕 CREATE: Creates a new field configuration with specified name and description. After creation, use the returned ID with other field configuration management tools. Related tools: "get_field_configurations", "update_field_configuration".',
      inputSchema: createFieldConfigurationInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = createFieldConfigurationSchema.parse(params);
        
        const requestData: any = {
          name: validatedParams.name,
        };
        
        if (validatedParams.description !== undefined) {
          requestData.description = validatedParams.description;
        }

        const response = await apiClient.makeRequest<JiraFieldConfiguration>({
          method: 'POST',
          path: '/fieldconfiguration',
          data: requestData,
        });

        if (response.success && response.data) {
          logger.info('Field configuration created successfully', { 
            configId: response.data.id,
            configName: response.data.name 
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                fieldConfiguration: response.data,
                message: `Field configuration '${response.data.name}' created successfully with ID ${response.data.id}`,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to create field configuration');
      } catch (error: any) {
        logger.error('Failed to create field configuration', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'CREATE_FIELD_CONFIGURATION_ERROR',
                message: error.message,
                details: error.details,
                suggestion: error.suggestion || 'Ensure you have Jira Administrator permissions',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: updateFieldConfiguration
  server.registerTool(
    'update_field_configuration',
    {
      title: 'Update Field Configuration',
      description: '⚠️ PREREQUISITE: Use "get_field_configurations" first to find valid field configuration IDs. Updates an existing field configuration name and/or description. If you get "Field configuration not found" errors, the configuration likely doesn\'t exist - use the discovery tool to find valid IDs first.',
      inputSchema: updateFieldConfigurationInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = updateFieldConfigurationSchema.parse(params);
        
        const updateData: any = {};
        if (validatedParams.name) updateData.name = validatedParams.name;
        if (validatedParams.description !== undefined) updateData.description = validatedParams.description;

        const response = await apiClient.makeRequest<JiraFieldConfiguration>({
          method: 'PUT',
          path: `/fieldconfiguration/${validatedParams.id}`,
          data: updateData,
        });

        // PUT may return 204 No Content (success with no body) or 200 with data
        if (response.success) {
          logger.info('Field configuration updated successfully', {
            configId: validatedParams.id,
            configName: response.data?.name || updateData.name
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                fieldConfiguration: response.data || { id: validatedParams.id, ...updateData },
                message: `Field configuration ${validatedParams.id} updated successfully`,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to update field configuration');
      } catch (error: any) {
        logger.error('Failed to update field configuration', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'UPDATE_FIELD_CONFIGURATION_ERROR',
                message: error.message,
                details: error.details,
                suggestion: error.suggestion || 'Ensure the field configuration exists and you have admin permissions',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: getFieldConfigurationSchemes
  server.registerTool(
    'get_field_configuration_schemes',
    {
      title: 'Get Field Configuration Schemes',
      description: '🔍 DISCOVERY TOOL: Primary discovery method for field configuration scheme operations. Use this first to find available field configuration scheme IDs before using other management tools. Returns comprehensive list with IDs, names, and key properties needed for subsequent operations.',
      inputSchema: getFieldConfigurationSchemesInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = getFieldConfigurationSchemesSchema.parse(params);

        const queryParams: any = {};
        if (validatedParams.startAt !== 0) queryParams.startAt = validatedParams.startAt;
        if (validatedParams.maxResults !== 50) queryParams.maxResults = validatedParams.maxResults;

        const response = await apiClient.makeRequest<{ values: JiraFieldConfigurationScheme[]; total: number; startAt: number; maxResults: number }>({
          method: 'GET',
          path: '/fieldconfigurationscheme',
          params: Object.keys(queryParams).length > 0 ? queryParams : undefined,
        });

        if (response.success && response.data) {
          const fieldConfigurationSchemes = response.data.values || response.data;

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                fieldConfigurationSchemes,
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

        throw new Error('Failed to retrieve field configuration schemes');
      } catch (error: any) {
        logger.error('Failed to get field configuration schemes', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_FIELD_CONFIGURATION_SCHEMES_ERROR',
                message: error.message,
                details: error.details,
                suggestion: error.suggestion || 'Ensure you have permission to view field configuration schemes',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: createFieldConfigurationScheme
  server.registerTool(
    'create_field_configuration_scheme',
    {
      title: 'Create Field Configuration Scheme',
      description: '🆕 CREATE: Creates a new field configuration scheme with mappings between issue types and field configurations. After creation, use the returned ID with other field configuration scheme management tools. Related tools: "get_field_configuration_schemes", "get_field_configurations".',
      inputSchema: createFieldConfigurationSchemeInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = createFieldConfigurationSchemeSchema.parse(params);
        
        const requestData: any = {
          name: validatedParams.name,
        };
        
        if (validatedParams.description !== undefined) {
          requestData.description = validatedParams.description;
        }
        
        if (validatedParams.fieldConfigurationMappings !== undefined) {
          requestData.fieldConfigurationMappings = validatedParams.fieldConfigurationMappings;
        }

        const response = await apiClient.makeRequest<JiraFieldConfigurationScheme>({
          method: 'POST',
          path: '/fieldconfigurationscheme',
          data: requestData,
        });

        if (response.success && response.data) {
          logger.info('Field configuration scheme created successfully', { 
            schemeId: response.data.id,
            schemeName: response.data.name 
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                fieldConfigurationScheme: response.data,
                message: `Field configuration scheme '${response.data.name}' created successfully with ID ${response.data.id}`,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to create field configuration scheme');
      } catch (error: any) {
        logger.error('Failed to create field configuration scheme', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'CREATE_FIELD_CONFIGURATION_SCHEME_ERROR',
                message: error.message,
                details: error.details,
                suggestion: error.suggestion || 'Ensure you have Jira Administrator permissions and valid field configuration IDs',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Field configuration tools registered successfully (logging disabled for MCP compatibility)
}