import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { JiraApiClient } from '../api/client.js';
import {
  getScreenSchemesSchema,
  createScreenSchemeSchema,
  updateScreenSchemeSchema,
  getScreensSchema,
  createScreenSchema,
  updateScreenSchema,
  deleteScreenSchema,
  deleteScreenSchemeSchema,
  getScreenTabsSchema,
  createScreenTabSchema,
  updateScreenTabSchema,
  deleteScreenTabSchema,
  getScreenTabFieldsSchema,
  addFieldToScreenSchema,
  removeFieldFromScreenTabSchema,
  moveScreenTabFieldSchema,
  addFieldToDefaultScreenSchema,
  getScreenAvailableFieldsSchema,
  assignIssueTypeScreenSchemeToProjectSchema,
} from '../validation/schemas.js';
import {
  getScreenSchemesInputSchema,
  createScreenSchemeInputSchema,
  updateScreenSchemeInputSchema,
  getScreensInputSchema,
  createScreenInputSchema,
  updateScreenInputSchema,
  deleteScreenInputSchema,
  deleteScreenSchemeInputSchema,
  getScreenTabsInputSchema,
  createScreenTabInputSchema,
  updateScreenTabInputSchema,
  deleteScreenTabInputSchema,
  getScreenTabFieldsInputSchema,
  addFieldToScreenInputSchema,
  removeFieldFromScreenTabInputSchema,
  moveScreenTabFieldInputSchema,
  addFieldToDefaultScreenInputSchema,
  getScreenAvailableFieldsInputSchema,
  assignIssueTypeScreenSchemeToProjectInputSchema,
} from '../validation/input-schemas.js';
import { JiraScreenScheme } from '../types/index.js';
import { logger } from '../utils/logger.js';

export async function registerScreenTools(server: McpServer, apiClient: JiraApiClient) {
  // Tool: getScreenSchemes
  server.registerTool(
    'get_screen_schemes',
    {
      title: 'Get Screen Schemes',
      description: '🔍 DISCOVERY TOOL: Primary discovery method for screen scheme operations. Use this first to find available screen scheme IDs before using other screen scheme management tools. Returns comprehensive list with IDs, names, and key properties needed for subsequent operations.',
      inputSchema: getScreenSchemesInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = getScreenSchemesSchema.parse(params);

        const queryParams: any = {};
        if (validatedParams.startAt !== 0) queryParams.startAt = validatedParams.startAt;
        if (validatedParams.maxResults !== 50) queryParams.maxResults = validatedParams.maxResults;
        if (validatedParams.expand) queryParams.expand = validatedParams.expand;

        const response = await apiClient.makeRequest<{ values: JiraScreenScheme[]; total: number; startAt: number; maxResults: number }>({
          method: 'GET',
          path: '/screenscheme',
          params: Object.keys(queryParams).length > 0 ? queryParams : undefined,
        });

        if (response.success && response.data) {
          const screenSchemes = response.data.values || response.data;
          const count = response.data.values ? response.data.values.length : 0;

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                screenSchemes: screenSchemes,
                pagination: {
                  startAt: response.data.startAt || 0,
                  maxResults: response.data.maxResults || 50,
                  total: response.data.total || count,
                },
                count: count,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to retrieve screen schemes');
      } catch (error: any) {
        logger.error('Failed to get screen schemes', { error: error.message });
        
        let enhancedSuggestion = `Ensure you have permission to view screen schemes`;
        let nextSteps: string[] = [];
        let workflowGuidance: string | undefined;
        
        if (error.message?.includes('not found') || error.message?.includes('NOT_FOUND')) {
          enhancedSuggestion = `Screen schemes not accessible or none exist`;
          nextSteps = [
            `1. Create a screen scheme with "create_screen_scheme" first`,
            `2. Verify you have administrator permissions to view screen schemes`,
            `3. Check if you're in the correct Jira instance`
          ];
          workflowGuidance = 'The proper workflow is: Admin Access → Discovery → Action';
        } else if (error.message?.includes('permission') || error.message?.includes('FORBIDDEN')) {
          enhancedSuggestion = `Insufficient permissions for screen scheme operations`;
          nextSteps = [
            '1. Verify you have Jira Administrator permissions',
            '2. Contact your administrator for access',
            '3. Retry after permissions are granted'
          ];
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'SCREEN_SCHEME_DISCOVERY_ERROR',
                message: error.message,
                suggestion: enhancedSuggestion,
                next_steps: nextSteps.length > 0 ? nextSteps : undefined,
                workflow_guidance: workflowGuidance,
                related_tools: nextSteps.length > 0 ? ['create_screen_scheme'] : undefined
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: createScreenScheme
  server.registerTool(
    'create_screen_scheme',
    {
      title: 'Create Screen Scheme',
      description: '🆕 CREATE: Creates a new screen scheme with screen mappings for different operations. After creation, use the returned ID with other screen scheme management tools. Related tools: "get_screen_schemes", "update_screen_scheme", "get_screens".',
      inputSchema: createScreenSchemeInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = createScreenSchemeSchema.parse(params);
        
        const response = await apiClient.makeRequest<JiraScreenScheme>({
          method: 'POST',
          path: '/screenscheme',
          data: {
            name: validatedParams.name,
            description: validatedParams.description,
            screens: validatedParams.screens,
          },
        });

        if (response.success && response.data) {
          logger.info('Screen scheme created successfully', { 
            schemeId: response.data.id,
            schemeName: response.data.name 
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                screenScheme: response.data,
                message: `Screen scheme '${response.data.name}' created successfully with ID ${response.data.id}`,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to create screen scheme');
      } catch (error: any) {
        logger.error('Failed to create screen scheme', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'CREATE_SCREEN_SCHEME_ERROR',
                message: error.message,
                details: error.details,
                suggestion: error.suggestion || 'Ensure you have Jira Administrator permissions and valid screen IDs',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: updateScreenScheme - REMOVED: API returns validation errors for screen scheme updates in Cloud
  // Screen schemes must be updated via Jira UI (Project Settings → Screens)

  // Tool: deleteScreenScheme
  server.registerTool(
    'delete_screen_scheme',
    {
      title: 'Delete Screen Scheme',
      description: '⚠️ PREREQUISITE: Use "get_screen_schemes" first to find valid screen scheme IDs. Deletes a screen scheme by ID. If you get "Screen scheme not found" errors, the screen scheme likely doesn\'t exist - use the discovery tool to find valid IDs first.',
      inputSchema: deleteScreenSchemeInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
      },
    },
    async (params) => {
      try {
        const validatedParams = deleteScreenSchemeSchema.parse(params);
        
        const response = await apiClient.makeRequest<void>({
          method: 'DELETE',
          path: `/screenscheme/${validatedParams.screenSchemeId}`,
        });

        if (response.success) {
          logger.info('Screen scheme deleted successfully', { 
            schemeId: validatedParams.screenSchemeId 
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Screen scheme ${validatedParams.screenSchemeId} deleted successfully`,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to delete screen scheme');
      } catch (error: any) {
        logger.error('Failed to delete screen scheme', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'DELETE_SCREEN_SCHEME_ERROR',
                message: error.message,
                details: error.details,
                suggestion: error.suggestion || 'Ensure the screen scheme exists, is not in use, and you have admin permissions',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: getScreens
  server.registerTool(
    'get_screens',
    {
      title: 'Get Screens',
      description: '🔍 DISCOVERY TOOL: Primary discovery method for screen operations. Use this first to find available screen IDs before using other screen management tools. Returns comprehensive list with IDs, names, and key properties needed for subsequent operations.',
      inputSchema: getScreensInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = getScreensSchema.parse(params);

        const queryParams: any = {};
        if (validatedParams.startAt !== 0) queryParams.startAt = validatedParams.startAt;
        if (validatedParams.maxResults !== 50) queryParams.maxResults = validatedParams.maxResults;
        if (validatedParams.expand) queryParams.expand = validatedParams.expand;

        const response = await apiClient.makeRequest<any>({
          method: 'GET',
          path: '/screens',
          params: Object.keys(queryParams).length > 0 ? queryParams : undefined,
        });

        if (response.success && response.data) {
          const screens = response.data.values || response.data;
          const count = response.data.values ? response.data.values.length : Array.isArray(response.data) ? response.data.length : 0;

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                screens: screens,
                pagination: {
                  startAt: response.data.startAt || 0,
                  maxResults: response.data.maxResults || 50,
                  total: response.data.total || count,
                },
                count: count,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to retrieve screens');
      } catch (error: any) {
        logger.error('Failed to get screens', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_SCREENS_ERROR',
                message: error.message,
                details: error.details,
                suggestion: error.suggestion || 'Ensure you have permission to view screens',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: createScreen
  server.registerTool(
    'create_screen',
    {
      title: 'Create Screen',
      description: '🆕 CREATE: Creates a new screen with tabs and fields. After creation, use the returned ID with other screen management tools. Related tools: "get_screens", "update_screen", "get_screen_tabs".',
      inputSchema: createScreenInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = createScreenSchema.parse(params);
        
        const screenData: any = {
          name: validatedParams.name,
          description: validatedParams.description,
        };

        // Add tabs if provided
        if (validatedParams.tabs && validatedParams.tabs.length > 0) {
          screenData.tabs = validatedParams.tabs;
        }

        const response = await apiClient.makeRequest<any>({
          method: 'POST',
          path: '/screens',
          data: screenData,
        });

        if (response.success && response.data) {
          logger.info('Screen created successfully', { 
            screenId: response.data.id,
            screenName: response.data.name 
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                screen: response.data,
                message: `Screen '${response.data.name}' created successfully with ID ${response.data.id}`,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to create screen');
      } catch (error: any) {
        logger.error('Failed to create screen', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'CREATE_SCREEN_ERROR',
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

  // Tool: updateScreen
  server.registerTool(
    'update_screen',
    {
      title: 'Update Screen',
      description: '⚠️ PREREQUISITE: Use "get_screens" first to find valid screen IDs. Updates an existing screen name and/or description. If you get "Screen not found" errors, the screen likely doesn\'t exist - use the discovery tool to find valid IDs first.',
      inputSchema: updateScreenInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = updateScreenSchema.parse(params);
        
        const updateData: any = {};
        if (validatedParams.name) updateData.name = validatedParams.name;
        if (validatedParams.description !== undefined) updateData.description = validatedParams.description;

        if (Object.keys(updateData).length === 0) {
          throw new Error('At least one field must be provided for update');
        }

        const response = await apiClient.makeRequest<any>({
          method: 'PUT',
          path: `/screens/${validatedParams.screenId}`,
          data: updateData,
        });

        if (response.success && response.data) {
          logger.info('Screen updated successfully', { 
            screenId: validatedParams.screenId,
            screenName: response.data.name 
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                screen: response.data,
                message: `Screen ${validatedParams.screenId} updated successfully`,
                updatedFields: Object.keys(updateData),
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to update screen');
      } catch (error: any) {
        logger.error('Failed to update screen', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'UPDATE_SCREEN_ERROR',
                message: error.message,
                details: error.details,
                suggestion: error.suggestion || 'Ensure the screen exists and you have admin permissions',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: deleteScreen
  server.registerTool(
    'delete_screen',
    {
      title: 'Delete Screen',
      description: '⚠️ PREREQUISITE: Use "get_screens" first to find valid screen IDs. Deletes a screen by ID. If you get "Screen not found" errors, the screen likely doesn\'t exist - use the discovery tool to find valid IDs first.',
      inputSchema: deleteScreenInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
      },
    },
    async (params) => {
      try {
        const validatedParams = deleteScreenSchema.parse(params);
        
        const response = await apiClient.makeRequest<void>({
          method: 'DELETE',
          path: `/screens/${validatedParams.screenId}`,
        });

        if (response.success) {
          logger.info('Screen deleted successfully', { 
            screenId: validatedParams.screenId 
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Screen ${validatedParams.screenId} deleted successfully`,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to delete screen');
      } catch (error: any) {
        logger.error('Failed to delete screen', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'DELETE_SCREEN_ERROR',
                message: error.message,
                details: error.details,
                suggestion: error.suggestion || 'Ensure the screen exists, is not in use by screen schemes, and you have admin permissions',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: getScreenTabs
  server.registerTool(
    'get_screen_tabs',
    {
      title: 'Get Screen Tabs',
      description: '⚠️ PREREQUISITE: Use "get_screens" first to find valid screen IDs. Gets all tabs for a specific screen. If you get "Screen not found" errors, the screen likely doesn\'t exist - use the discovery tool to find valid IDs first.',
      inputSchema: getScreenTabsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = getScreenTabsSchema.parse(params);
        
        const queryParams: any = {};
        if (validatedParams.projectKey) {
          queryParams.projectKey = validatedParams.projectKey;
        }

        const response = await apiClient.makeRequest<any>({
          method: 'GET',
          path: `/screens/${validatedParams.screenId}/tabs`,
          params: Object.keys(queryParams).length > 0 ? queryParams : undefined,
        });

        if (response.success && response.data) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                tabs: response.data,
                count: Array.isArray(response.data) ? response.data.length : 0,
                screenId: validatedParams.screenId,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to retrieve screen tabs');
      } catch (error: any) {
        logger.error('Failed to get screen tabs', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_SCREEN_TABS_ERROR',
                message: error.message,
                details: error.details,
                suggestion: error.suggestion || 'Ensure you have appropriate permissions and the screen ID is valid',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: createScreenTab
  server.registerTool(
    'create_screen_tab',
    {
      title: 'Create Screen Tab',
      description: '⚠️ PREREQUISITE: Use "get_screens" first to find valid screen IDs. Creates a new tab on a screen. If you get "Screen not found" errors, the screen likely doesn\'t exist - use the discovery tool to find valid IDs first.',
      inputSchema: createScreenTabInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = createScreenTabSchema.parse(params);
        
        const response = await apiClient.makeRequest<any>({
          method: 'POST',
          path: `/screens/${validatedParams.screenId}/tabs`,
          data: {
            name: validatedParams.name,
          },
        });

        if (response.success && response.data) {
          logger.info('Screen tab created successfully', { 
            screenId: validatedParams.screenId,
            tabId: response.data.id,
            tabName: response.data.name,
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                tab: response.data,
                message: `Screen tab '${response.data.name}' created successfully on screen ${validatedParams.screenId}`,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to create screen tab');
      } catch (error: any) {
        logger.error('Failed to create screen tab', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'CREATE_SCREEN_TAB_ERROR',
                message: error.message,
                details: error.details,
                suggestion: error.suggestion || 'Ensure you have Jira Administrator permissions and the screen exists',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: updateScreenTab
  server.registerTool(
    'update_screen_tab',
    {
      title: 'Update Screen Tab',
      description: '⚠️ PREREQUISITE: Use "get_screens" first to find valid screen IDs. Updates the name of a screen tab. If you get "Screen not found" errors, the screen likely doesn\'t exist - use the discovery tool to find valid IDs first.',
      inputSchema: updateScreenTabInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = updateScreenTabSchema.parse(params);
        
        const response = await apiClient.makeRequest<any>({
          method: 'PUT',
          path: `/screens/${validatedParams.screenId}/tabs/${validatedParams.tabId}`,
          data: {
            name: validatedParams.name,
          },
        });

        if (response.success && response.data) {
          logger.info('Screen tab updated successfully', { 
            screenId: validatedParams.screenId,
            tabId: validatedParams.tabId,
            tabName: response.data.name,
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                tab: response.data,
                message: `Screen tab ${validatedParams.tabId} updated successfully`,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to update screen tab');
      } catch (error: any) {
        logger.error('Failed to update screen tab', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'UPDATE_SCREEN_TAB_ERROR',
                message: error.message,
                details: error.details,
                suggestion: error.suggestion || 'Ensure the screen and tab exist and you have admin permissions',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: deleteScreenTab
  server.registerTool(
    'delete_screen_tab',
    {
      title: 'Delete Screen Tab',
      description: '⚠️ PREREQUISITE: Use "get_screens" first to find valid screen IDs. Deletes a tab from a screen. If you get "Screen not found" errors, the screen likely doesn\'t exist - use the discovery tool to find valid IDs first.',
      inputSchema: deleteScreenTabInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
      },
    },
    async (params) => {
      try {
        const validatedParams = deleteScreenTabSchema.parse(params);
        
        const response = await apiClient.makeRequest<void>({
          method: 'DELETE',
          path: `/screens/${validatedParams.screenId}/tabs/${validatedParams.tabId}`,
        });

        if (response.success) {
          logger.info('Screen tab deleted successfully', { 
            screenId: validatedParams.screenId,
            tabId: validatedParams.tabId,
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Screen tab ${validatedParams.tabId} deleted successfully from screen ${validatedParams.screenId}`,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to delete screen tab');
      } catch (error: any) {
        logger.error('Failed to delete screen tab', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'DELETE_SCREEN_TAB_ERROR',
                message: error.message,
                details: error.details,
                suggestion: error.suggestion || 'Ensure the screen and tab exist, the tab is not the last tab, and you have admin permissions',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: getScreenTabFields
  server.registerTool(
    'get_screen_tab_fields',
    {
      title: 'Get Screen Tab Fields',
      description: '⚠️ PREREQUISITE: Use "get_screens" first to find valid screen IDs. Gets all fields for a specific screen tab. If you get "Screen not found" errors, the screen likely doesn\'t exist - use the discovery tool to find valid IDs first.',
      inputSchema: getScreenTabFieldsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = getScreenTabFieldsSchema.parse(params);
        
        const queryParams: any = {};
        if (validatedParams.projectKey) {
          queryParams.projectKey = validatedParams.projectKey;
        }

        const response = await apiClient.makeRequest<any>({
          method: 'GET',
          path: `/screens/${validatedParams.screenId}/tabs/${validatedParams.tabId}/fields`,
          params: Object.keys(queryParams).length > 0 ? queryParams : undefined,
        });

        if (response.success && response.data) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                fields: response.data,
                count: Array.isArray(response.data) ? response.data.length : 0,
                screenId: validatedParams.screenId,
                tabId: validatedParams.tabId,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to retrieve screen tab fields');
      } catch (error: any) {
        logger.error('Failed to get screen tab fields', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_SCREEN_TAB_FIELDS_ERROR',
                message: error.message,
                details: error.details,
                suggestion: error.suggestion || 'Ensure you have appropriate permissions and the screen/tab IDs are valid',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: removeFieldFromScreenTab
  server.registerTool(
    'remove_field_from_screen_tab',
    {
      title: 'Remove Field from Screen Tab',
      description: '⚠️ PREREQUISITE: Use "get_screens" first to find valid screen IDs. Removes a field from a screen tab. If you get "Screen not found" errors, the screen likely doesn\'t exist - use the discovery tool to find valid IDs first.',
      inputSchema: removeFieldFromScreenTabInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
      },
    },
    async (params) => {
      try {
        const validatedParams = removeFieldFromScreenTabSchema.parse(params);
        
        const response = await apiClient.makeRequest<void>({
          method: 'DELETE',
          path: `/screens/${validatedParams.screenId}/tabs/${validatedParams.tabId}/fields/${validatedParams.fieldId}`,
        });

        if (response.success) {
          logger.info('Field removed from screen tab successfully', { 
            screenId: validatedParams.screenId,
            tabId: validatedParams.tabId,
            fieldId: validatedParams.fieldId,
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Field ${validatedParams.fieldId} removed successfully from screen tab ${validatedParams.tabId}`,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to remove field from screen tab');
      } catch (error: any) {
        logger.error('Failed to remove field from screen tab', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'REMOVE_FIELD_FROM_SCREEN_TAB_ERROR',
                message: error.message,
                details: error.details,
                suggestion: error.suggestion || 'Ensure the screen, tab, and field exist and you have admin permissions',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: moveScreenTabField
  server.registerTool(
    'move_screen_tab_field',
    {
      title: 'Move Screen Tab Field',
      description: '⚠️ PREREQUISITE: Use "get_screens" first to find valid screen IDs. Moves a field within a screen tab to a different position. If you get "Screen not found" errors, the screen likely doesn\'t exist - use the discovery tool to find valid IDs first.',
      inputSchema: moveScreenTabFieldInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = moveScreenTabFieldSchema.parse(params);
        
        const moveData: any = {};
        if (validatedParams.after) {
          moveData.after = validatedParams.after;
        }
        if (validatedParams.position) {
          moveData.position = validatedParams.position;
        }

        const response = await apiClient.makeRequest<any>({
          method: 'POST',
          path: `/screens/${validatedParams.screenId}/tabs/${validatedParams.tabId}/fields/${validatedParams.fieldId}/move`,
          data: moveData,
        });

        if (response.success) {
          logger.info('Screen tab field moved successfully', { 
            screenId: validatedParams.screenId,
            tabId: validatedParams.tabId,
            fieldId: validatedParams.fieldId,
            position: validatedParams.position,
            after: validatedParams.after,
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Field ${validatedParams.fieldId} moved successfully in screen tab ${validatedParams.tabId}`,
                moveDetails: {
                  fieldId: validatedParams.fieldId,
                  position: validatedParams.position,
                  after: validatedParams.after,
                },
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to move screen tab field');
      } catch (error: any) {
        logger.error('Failed to move screen tab field', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'MOVE_SCREEN_TAB_FIELD_ERROR',
                message: error.message,
                details: error.details,
                suggestion: error.suggestion || 'Ensure the screen, tab, and field exist and you have admin permissions',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: addFieldToScreen (Fixed implementation)
  server.registerTool(
    'add_field_to_screen',
    {
      title: 'Add Field to Screen',
      description: '⚠️ PREREQUISITE: Use "get_screens" first to find valid screen IDs. Adds a field to a specific screen tab using POST method with fieldId in request body. If you get "Screen not found" errors, the screen likely doesn\'t exist - use the discovery tool to find valid IDs first.',
      inputSchema: addFieldToScreenInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = addFieldToScreenSchema.parse(params);
        
        const response = await apiClient.makeRequest<any>({
          method: 'POST',
          path: `/screens/${validatedParams.screenId}/tabs/${validatedParams.tabId}/fields`,
          data: {
            fieldId: validatedParams.fieldId,
          },
        });

        if (response.success && response.data) {
          logger.info('Field added to screen successfully', { 
            screenId: validatedParams.screenId,
            tabId: validatedParams.tabId,
            fieldId: validatedParams.fieldId,
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                field: response.data,
                message: `Field ${validatedParams.fieldId} added successfully to screen tab ${validatedParams.tabId}`,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to add field to screen');
      } catch (error: any) {
        logger.error('Failed to add field to screen', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'ADD_FIELD_TO_SCREEN_ERROR',
                message: error.message,
                details: error.details,
                suggestion: error.suggestion || 'Ensure the screen, tab, and field exist and you have admin permissions',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: addFieldToDefaultScreen
  server.registerTool(
    'add_field_to_default_screen',
    {
      title: 'Add Field to Default Screen',
      description: '⚠️ PREREQUISITES: Use "get_screen_available_fields" first to check if the field can be added. Adding a field that is already on the screen will fail with a validation error. This tool adds a field to the default screen\'s default tab. Common failure: "Field is already present on the screen".',
      inputSchema: addFieldToDefaultScreenInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = addFieldToDefaultScreenSchema.parse(params);
        
        const response = await apiClient.makeRequest<any>({
          method: 'POST',
          path: `/screens/addToDefault/${validatedParams.fieldId}`,
        });

        if (response.success) {
          logger.info('Field added to default screen successfully', { 
            fieldId: validatedParams.fieldId,
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Field ${validatedParams.fieldId} added successfully to the default screen`,
                fieldId: validatedParams.fieldId,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to add field to default screen');
      } catch (error: any) {
        logger.error('Failed to add field to default screen', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'ADD_FIELD_TO_DEFAULT_SCREEN_ERROR',
                message: error.message,
                details: error.details,
                suggestion: error.suggestion || 'Ensure the field exists and you have admin permissions',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: getScreenAvailableFields
  server.registerTool(
    'get_screen_available_fields',
    {
      title: 'Get Screen Available Fields',
      description: '⚠️ PREREQUISITE: Use "get_screens" first to find valid screen IDs. Gets fields that can be added to a screen. If you get "Screen not found" errors, the screen likely doesn\'t exist - use the discovery tool to find valid IDs first.',
      inputSchema: getScreenAvailableFieldsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = getScreenAvailableFieldsSchema.parse(params);
        
        const response = await apiClient.makeRequest<any>({
          method: 'GET',
          path: `/screens/${validatedParams.screenId}/availableFields`,
        });

        if (response.success && response.data) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                availableFields: response.data,
                count: Array.isArray(response.data) ? response.data.length : 0,
                screenId: validatedParams.screenId,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to retrieve available fields for screen');
      } catch (error: any) {
        logger.error('Failed to get screen available fields', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_SCREEN_AVAILABLE_FIELDS_ERROR',
                message: error.message,
                details: error.details,
                suggestion: error.suggestion || 'Ensure the screen exists and you have appropriate permissions',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: assignIssueTypeScreenSchemeToProject
  server.registerTool(
    'assign_issue_type_screen_scheme_to_project',
    {
      title: 'Assign Issue Type Screen Scheme to Project',
      description: '⚠️ IMPORTANT: The schemeId parameter requires an Issue Type Screen Scheme ID — NOT a plain Screen Scheme ID. These are different Jira entities. Use the Jira REST API (GET /rest/api/3/issuetypescreenscheme) to discover valid ITSS IDs. Assigns an issue type screen scheme to a classic Jira project. Requires Jira Administrator permission. Does NOT work on team-managed (next-gen) projects.',
      inputSchema: assignIssueTypeScreenSchemeToProjectInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = assignIssueTypeScreenSchemeToProjectSchema.parse(params);

        const response = await apiClient.makeRequest<any>({
          method: 'PUT',
          path: '/issuetypescreenscheme/project',
          data: {
            issueTypeScreenSchemeId: validatedParams.schemeId,
            projectId: validatedParams.projectIdOrKey,
          },
        });

        if (response.success) {
          logger.info('Issue type screen scheme assigned to project successfully', {
            schemeId: validatedParams.schemeId,
            projectId: validatedParams.projectIdOrKey,
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Issue type screen scheme ${validatedParams.schemeId} assigned to project ${validatedParams.projectIdOrKey} successfully`,
                assignment: {
                  schemeId: validatedParams.schemeId,
                  projectId: validatedParams.projectIdOrKey,
                },
                usage_guidance: 'The project now uses the assigned issue type screen scheme for all screen operations.',
                suggested_next_steps: [
                  'Use GET /rest/api/3/issuetypescreenscheme to list issue type screen schemes and verify the assignment',
                  'Create a test issue in the project to verify screens display correctly',
                  'Use "get_screens" to review available screens in the scheme'
                ]
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to assign issue type screen scheme to project');
      } catch (error: any) {
        logger.error('Failed to assign issue type screen scheme to project', { error: error.message });

        let enhancedSuggestion = 'Ensure you have Jira Administrator permissions and both the scheme ID and project ID are valid';
        let nextSteps: string[] = [];

        if (error.message?.includes('not found') && error.message?.includes('scheme')) {
          enhancedSuggestion = `Issue type screen scheme ID ${params.schemeId} not found`;
          nextSteps = [
            '1. Use GET /rest/api/3/issuetypescreenscheme to list issue type screen schemes (NOT plain screen schemes)',
            '2. Issue Type Screen Scheme IDs are different from Screen Scheme IDs — do not use IDs from "get_screen_schemes"',
            '3. Then retry with a valid issue type screen scheme ID'
          ];
        } else if (error.message?.includes('not found') && error.message?.includes('project')) {
          enhancedSuggestion = `Project ${params.projectIdOrKey} not found`;
          nextSteps = [
            '1. Verify the project ID or key is correct',
            '2. Ensure the project exists and is a classic (company-managed) project',
            '3. Team-managed (next-gen) projects cannot use custom screen schemes via API'
          ];
        } else if (error.message?.includes('permission') || error.message?.includes('Unauthorized') || error.message?.includes('403')) {
          enhancedSuggestion = 'You do not have permission to assign screen schemes';
          nextSteps = [
            '1. Ensure you have "Jira Administrator" global permission',
            '2. Contact your Jira administrator for screen scheme assignment rights',
            '3. Screen scheme assignment requires system admin privileges'
          ];
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'ASSIGN_ISSUE_TYPE_SCREEN_SCHEME_ERROR',
                message: error.message,
                details: error.details,
                suggestion: enhancedSuggestion,
                next_steps: nextSteps.length > 0 ? nextSteps : undefined,
                workflow_guidance: nextSteps.length > 0 ? 'The proper workflow is: Scheme Discovery → Project Validation → Assignment' : undefined,
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Screen tools registered successfully (logging disabled for MCP compatibility)
}