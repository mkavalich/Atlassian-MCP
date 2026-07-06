import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { JiraApiClient } from '../api/client.js';
import {
  getDashboardsSchema,
  createDashboardSchema,
  getDashboardSchema,
  updateDashboardSchema,
  deleteDashboardSchema,
} from '../validation/schemas.js';
import {
  getDashboardsInputSchema,
  createDashboardInputSchema,
  getDashboardInputSchema,
  updateDashboardInputSchema,
  deleteDashboardInputSchema,
} from '../validation/input-schemas.js';
import { JiraDashboard } from '../types/index.js';
import { sanitizeErrorMessage } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export async function registerDashboardTools(server: McpServer, apiClient: JiraApiClient) {
  // Tool: getDashboards - DISCOVERY TOOL (Enhanced with UX patterns)
  server.registerTool(
    'get_dashboards',
    {
      title: 'Get Dashboards',
      description: '🔍 DISCOVERY TOOL: Use this first to find available dashboard IDs before using other dashboard management tools. Returns comprehensive list with IDs needed for get_dashboard, update_dashboard, and delete_dashboard operations.',
      inputSchema: getDashboardsInputSchema,
      annotations: {
        title: 'Get Dashboards',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const validatedParams = getDashboardsSchema.parse(params);
        const { fields, ...apiParams } = validatedParams;

        const response = await apiClient.makeRequest<{ dashboards: JiraDashboard[]; total: number }>({
          method: 'GET',
          path: '/dashboard',
          params: apiParams,
        });

        if (response.success && response.data) {
          const rawDashboards = response.data.dashboards || response.data;
          const total = response.data.total || (Array.isArray(rawDashboards) ? rawDashboards.length : 0);

          // Apply field selection for token efficiency
          const dashboards = fields === 'summary'
            ? (Array.isArray(rawDashboards) ? rawDashboards : []).map((d: JiraDashboard) => ({
                id: d.id,
                name: d.name,
              }))
            : rawDashboards;

          const count = Array.isArray(dashboards) ? dashboards.length : 0;
          const startAt = validatedParams.startAt || 0;
          const maxResults = validatedParams.maxResults || 20;
          const hasMore = startAt + count < total;

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                dashboards,
                pagination: {
                  total,
                  count,
                  startAt,
                  maxResults,
                  hasMore,
                  nextStartAt: hasMore ? startAt + count : null,
                },
                fieldsMode: fields,
                usage_guidance: count > 0
                  ? `Found ${count} of ${total} dashboard(s).${hasMore ? ' Use startAt=' + (startAt + count) + ' for next page.' : ''} Use IDs with "get_dashboard", "update_dashboard", "delete_dashboard".`
                  : `No dashboards found. Create one with "create_dashboard" to get started.`,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to retrieve dashboards');
      } catch (error: any) {
        logger.error('Failed to get dashboards', { error: error.message });
        
        let enhancedSuggestion = 'Check permissions and try again';
        let nextSteps: string[] = [];

        if (error.message?.includes('Unauthorized') || error.message?.includes('403')) {
          enhancedSuggestion = 'You do not have permission to view dashboards';
          nextSteps = [
            '1. Ensure you have "Browse Projects" permission',
            '2. Contact your Jira administrator to grant dashboard access',
            '3. Try logging in with an account that has appropriate permissions'
          ];
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_DASHBOARDS_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: enhancedSuggestion,
                next_steps: nextSteps.length > 0 ? nextSteps : undefined,
                workflow_guidance: nextSteps.length > 0 ? 'Resolve permissions first, then retry dashboard discovery' : undefined
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: createDashboard - Enhanced with validation
  server.registerTool(
    'create_dashboard',
    {
      title: 'Create Dashboard',
      description: '✅ Create a new dashboard with share permissions. Creates a dashboard that can be discovered with "get_dashboards" and managed with other dashboard tools.',
      inputSchema: createDashboardInputSchema,
      annotations: {
        title: 'Create Dashboard',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const validatedParams = createDashboardSchema.parse(params);
        
        const response = await apiClient.makeRequest<JiraDashboard>({
          method: 'POST',
          path: '/dashboard',
          data: validatedParams,
        });

        if (response.success && response.data) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                dashboard: response.data,
                message: `Dashboard '${response.data.name}' created successfully`,
                usage_guidance: `Dashboard ID ${response.data.id} can now be used with other dashboard tools.`,
                suggested_next_steps: [
                  `Use "get_dashboard" with ID ${response.data.id} to view detailed information`,
                  'Use "update_dashboard" to modify settings',
                  'Use "create_dashboard_widget" to add widgets'
                ]
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to create dashboard');
      } catch (error: any) {
        logger.error('Failed to create dashboard', { error: error.message });
        
        let enhancedSuggestion = 'Check parameters and permissions';
        let nextSteps: string[] = [];

        if (error.message?.includes('name') && error.message?.includes('already exists')) {
          enhancedSuggestion = 'Dashboard name already exists';
          nextSteps = [
            '1. Choose a different dashboard name',
            '2. Use "get_dashboards" to see existing dashboard names',
            '3. Retry with unique name'
          ];
        } else if (error.message?.includes('permission') || error.message?.includes('Unauthorized')) {
          enhancedSuggestion = 'You do not have permission to create dashboards';
          nextSteps = [
            '1. Ensure you have "Create Shared Objects" permission',
            '2. Contact your Jira administrator for dashboard creation rights',
            '3. Try with an account that has appropriate permissions'
          ];
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'CREATE_DASHBOARD_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: enhancedSuggestion,
                next_steps: nextSteps.length > 0 ? nextSteps : undefined,
                workflow_guidance: nextSteps.length > 0 ? 'Resolve the issue above, then retry dashboard creation' : undefined
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: getDashboard - Enhanced with prerequisite warnings
  server.registerTool(
    'get_dashboard',
    {
      title: 'Get Dashboard',
      description: '⚠️ PREREQUISITE: Use "get_dashboards" first to discover valid dashboard IDs. Retrieves detailed information for a specific dashboard including widgets, permissions, and configuration.',
      inputSchema: getDashboardInputSchema,
      annotations: {
        title: 'Get Dashboard',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const validatedParams = getDashboardSchema.parse(params);
        
        const response = await apiClient.makeRequest<JiraDashboard>({
          method: 'GET',
          path: `/dashboard/${validatedParams.dashboardId}`,
        });

        if (response.success && response.data) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                dashboard: response.data,
                usage_guidance: `Dashboard ${validatedParams.dashboardId} retrieved successfully.`,
                suggested_next_steps: [
                  'Use "update_dashboard" to modify this dashboard',
                  'Use "delete_dashboard" to remove this dashboard',
                  'Use "create_dashboard_widget" to add widgets'
                ]
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get dashboard');
      } catch (error: any) {
        logger.error('Failed to get dashboard', { error: error.message });
        
        let enhancedSuggestion = 'Check dashboard ID and permissions';
        let nextSteps: string[] = [];

        if (error.message?.includes('not found') || error.message?.includes('NOT_FOUND') || error.message?.includes('404')) {
          enhancedSuggestion = `Dashboard ID ${params.dashboardId} not found`;
          nextSteps = [
            '1. Use "get_dashboards" to find available dashboard IDs',
            '2. If no dashboards exist, create one with "create_dashboard" first',
            '3. Then retry with a valid dashboard ID from step 1'
          ];
        } else if (error.message?.includes('permission') || error.message?.includes('Unauthorized')) {
          enhancedSuggestion = `You do not have permission to access dashboard ${params.dashboardId}`;
          nextSteps = [
            '1. Ensure the dashboard is shared with you or publicly accessible',
            '2. Contact the dashboard owner for access',
            '3. Use "get_dashboards" to see dashboards you can access'
          ];
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_DASHBOARD_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: enhancedSuggestion,
                next_steps: nextSteps.length > 0 ? nextSteps : undefined,
                workflow_guidance: nextSteps.length > 0 ? 'The proper workflow is: Discovery → Validation → Action' : undefined
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: updateDashboard - Enhanced error handling with next steps
  server.registerTool(
    'update_dashboard',
    {
      title: 'Update Dashboard',
      description: '⚠️ PREREQUISITE: Use "get_dashboards" first to discover valid dashboard IDs. Updates dashboard details and share permissions. If you get "Dashboard not found" errors, the ID likely doesn\'t exist or you need to discover it first.',
      inputSchema: updateDashboardInputSchema,
      annotations: {
        title: 'Update Dashboard',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const validatedParams = updateDashboardSchema.parse(params);
        
        const { dashboardId, ...updateData } = validatedParams;

        const response = await apiClient.makeRequest<JiraDashboard>({
          method: 'PUT',
          path: `/dashboard/${dashboardId}`,
          data: updateData,
        });

        if (response.success && response.data) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                dashboard: response.data,
                message: `Dashboard '${response.data.name}' updated successfully`,
                updated_fields: Object.keys(updateData),
                usage_guidance: `Dashboard ${dashboardId} has been updated.`,
                suggested_next_steps: [
                  `Use "get_dashboard" with ID ${dashboardId} to view updated information`,
                  'Use "get_dashboards" to see all your dashboards'
                ]
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to update dashboard');
      } catch (error: any) {
        logger.error('Failed to update dashboard', { error: error.message });
        
        let enhancedSuggestion = 'Check parameters and permissions';
        let nextSteps: string[] = [];

        if (error.message?.includes('not found') || error.message?.includes('NOT_FOUND') || error.message?.includes('404')) {
          enhancedSuggestion = `Dashboard ID ${params.dashboardId} not found`;
          nextSteps = [
            '1. Use "get_dashboards" to find available dashboard IDs',
            '2. If no dashboards exist, create one with "create_dashboard" first',
            '3. Then retry with a valid dashboard ID from step 1'
          ];
        } else if (error.message?.includes('permission') || error.message?.includes('Unauthorized')) {
          enhancedSuggestion = `You do not have permission to update dashboard ${params.dashboardId}`;
          nextSteps = [
            '1. Ensure you own the dashboard or have edit permissions',
            '2. Contact the dashboard owner for modification rights',
            '3. Use "get_dashboard" to check current permissions'
          ];
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'UPDATE_DASHBOARD_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: enhancedSuggestion,
                next_steps: nextSteps.length > 0 ? nextSteps : undefined,
                workflow_guidance: nextSteps.length > 0 ? 'The proper workflow is: Discovery → Validation → Action' : undefined
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: deleteDashboard - ID validation and discovery guidance
  server.registerTool(
    'delete_dashboard',
    {
      title: 'Delete Dashboard',
      description: '⚠️ PREREQUISITE: Use "get_dashboards" first to discover valid dashboard IDs. Permanently deletes a dashboard. If you get "Dashboard not found" errors, the ID likely doesn\'t exist or you need to discover it first.',
      inputSchema: deleteDashboardInputSchema,
      annotations: {
        title: 'Delete Dashboard',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const validatedParams = deleteDashboardSchema.parse(params);
        
        const response = await apiClient.makeRequest({
          method: 'DELETE',
          path: `/dashboard/${validatedParams.dashboardId}`,
        });

        if (response.success) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: 'Dashboard deleted successfully',
                deleted_dashboard_id: validatedParams.dashboardId,
                usage_guidance: `Dashboard ${validatedParams.dashboardId} has been permanently removed.`,
                suggested_next_steps: [
                  'Use "get_dashboards" to see remaining dashboards',
                  'Use "create_dashboard" to create a new dashboard'
                ]
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to delete dashboard');
      } catch (error: any) {
        logger.error('Failed to delete dashboard', { error: error.message });
        
        let enhancedSuggestion = 'Check dashboard ID and permissions';
        let nextSteps: string[] = [];

        if (error.message?.includes('not found') || error.message?.includes('NOT_FOUND') || error.message?.includes('404')) {
          enhancedSuggestion = `Dashboard ID ${params.dashboardId} not found`;
          nextSteps = [
            '1. Use "get_dashboards" to find available dashboard IDs',
            '2. If no dashboards exist, none can be deleted',
            '3. Ensure the dashboard ID is correct and try again'
          ];
        } else if (error.message?.includes('permission') || error.message?.includes('Unauthorized')) {
          enhancedSuggestion = `You do not have permission to delete dashboard ${params.dashboardId}`;
          nextSteps = [
            '1. Ensure you own the dashboard or have delete permissions',
            '2. Contact the dashboard owner or Jira administrator',
            '3. Only dashboard owners can delete dashboards'
          ];
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'DELETE_DASHBOARD_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: enhancedSuggestion,
                next_steps: nextSteps.length > 0 ? nextSteps : undefined,
                workflow_guidance: nextSteps.length > 0 ? 'The proper workflow is: Discovery → Validation → Action' : undefined
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );
}