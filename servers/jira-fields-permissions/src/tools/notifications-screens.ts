import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { JiraApiClient } from '../api/client.js';
import {
  getNotificationSchemesSchema,
  createNotificationSchemeSchema,
  getScreensSchema,
  createScreenSchema,
  addFieldToScreenSchema,
} from '../validation/schemas.js';
import {
  getNotificationSchemesInputSchema,
  createNotificationSchemeInputSchema,
  getScreensInputSchema,
  createScreenInputSchema,
  addFieldToScreenInputSchema,
} from '../validation/input-schemas.js';
import {
  JiraNotificationScheme,
  JiraScreenDetailed
} from '../types/index.js';
import { logger } from '../utils/logger.js';

export async function registerNotificationScreenTools(server: McpServer, apiClient: JiraApiClient) {
  // Tool: getNotificationSchemes
  server.registerTool(
    'get_notification_schemes',
    {
      title: 'Get Notification Schemes',
      description: 'Retrieve all notification schemes with pagination support',
      inputSchema: getNotificationSchemesInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = getNotificationSchemesSchema.parse(params);

        const queryParams: any = {};
        if (validatedParams.startAt !== 0) queryParams.startAt = validatedParams.startAt;
        if (validatedParams.maxResults !== 50) queryParams.maxResults = validatedParams.maxResults;
        if (validatedParams.expand) queryParams.expand = validatedParams.expand;

        const response = await apiClient.makeRequest<{ values: JiraNotificationScheme[]; total: number; startAt: number; maxResults: number }>({
          method: 'GET',
          path: '/notificationscheme',
          params: Object.keys(queryParams).length > 0 ? queryParams : undefined,
        });

        if (response.success && response.data) {
          const notificationSchemes = response.data.values || response.data;

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                notificationSchemes,
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

        throw new Error('Failed to retrieve notification schemes');
      } catch (error: any) {
        logger.error('Failed to get notification schemes', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_NOTIFICATION_SCHEMES_ERROR',
                message: error.message,
                details: error.details,
                suggestion: error.suggestion || 'Ensure you have permission to view notification schemes',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: createNotificationScheme
  server.registerTool(
    'create_notification_scheme',
    {
      title: 'Create Notification Scheme',
      description: 'Create a new notification scheme with event notifications',
      inputSchema: createNotificationSchemeInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = createNotificationSchemeSchema.parse(params);
        
        const requestData: any = {
          name: validatedParams.name,
        };
        
        if (validatedParams.description !== undefined) {
          requestData.description = validatedParams.description;
        }
        
        if (validatedParams.notificationSchemeEvents && validatedParams.notificationSchemeEvents.length > 0) {
          requestData.notificationSchemeEvents = validatedParams.notificationSchemeEvents;
        }

        const response = await apiClient.makeRequest<JiraNotificationScheme>({
          method: 'POST',
          path: '/notificationscheme',
          data: requestData,
        });

        if (response.success && response.data) {
          logger.info('Notification scheme created successfully', { 
            schemeId: response.data.id,
            schemeName: response.data.name 
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                notificationScheme: response.data,
                message: `Notification scheme '${response.data.name}' created successfully with ID ${response.data.id}`,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to create notification scheme');
      } catch (error: any) {
        logger.error('Failed to create notification scheme', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'CREATE_NOTIFICATION_SCHEME_ERROR',
                message: error.message,
                details: error.details,
                suggestion: error.suggestion || 'Ensure you have Jira Administrator permissions and valid event/notification configurations',
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
    'get_notification_screens',
    {
      title: 'Get Notification Screens',
      description: 'Retrieve all screens available for notification configuration',
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

        const response = await apiClient.makeRequest<{ values: JiraScreenDetailed[]; total: number; startAt: number; maxResults: number }>({
          method: 'GET',
          path: '/screens',
          params: Object.keys(queryParams).length > 0 ? queryParams : undefined,
        });

        if (response.success && response.data) {
          const screens = response.data.values || response.data;

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                screens,
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
    'create_notification_screen',
    {
      title: 'Create Notification Screen',
      description: 'Create a new screen for notification workflows with tabs and fields',
      inputSchema: createScreenInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = createScreenSchema.parse(params);
        
        const requestData: any = {
          name: validatedParams.name,
        };
        
        if (validatedParams.description !== undefined) {
          requestData.description = validatedParams.description;
        }
        
        if (validatedParams.tabs && validatedParams.tabs.length > 0) {
          requestData.tabs = validatedParams.tabs;
        }

        const response = await apiClient.makeRequest<JiraScreenDetailed>({
          method: 'POST',
          path: '/screens',
          data: requestData,
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
                suggestion: error.suggestion || 'Ensure you have Jira Administrator permissions and valid tab/field configurations',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: addFieldToScreen
  server.registerTool(
    'add_field_to_notification_screen',
    {
      title: 'Add Field to Notification Screen',
      description: '⚠️ PREREQUISITES: Use "get_notification_screens" to find valid screen IDs, then use jira-workflows "get_screen_tabs" to find valid tab IDs for that screen. Tab IDs are numeric and screen-specific. Adds a field to a screen tab.',
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
            fieldId: validatedParams.fieldId
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                field: response.data,
                message: `Field ${validatedParams.fieldId} added to screen ${validatedParams.screenId} tab ${validatedParams.tabId} successfully`,
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

  // Notification screen tools registered successfully (logging disabled for MCP compatibility)
}