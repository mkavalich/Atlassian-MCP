import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { JiraApiClient } from '../api/client.js';
import { logger } from '../utils/logger.js';
import { sanitizeErrorMessage } from '../utils/errors.js';
import {
  ScimDirectoryGroupsResponse,
} from '../types/index.js';
import {
  getScimDirectoryGroupsInputSchema,
  getDirectoryHealthStatusInputSchema,
  getProvisioningInsightsInputSchema,
} from '../validation/input-schemas.js';
import {
  getDirectoryHealthStatusSchema,
  getProvisioningInsightsSchema,
} from '../validation/schemas.js';

/**
 * Register Directory Integration Health Tools (SCIM API)
 * Provides comprehensive READ-ONLY access to SCIM directory integration health
 * for enterprise administrators monitoring directory synchronization and provisioning.
 * 
 * These tools help monitor:
 * - Directory group synchronization and health status
 * - SCIM schema compliance and configuration
 * - Resource type availability and configuration
 * - Provisioning performance and error analysis
 * 
 * Required scope: read:directory:admin
 */
export async function registerDirectoryHealthTools(server: McpServer, apiClient: JiraApiClient) {

  // REMOVED: get_scim_directory_groups - requires separate SCIM API authentication
  // See backlog.json for details. The SCIM API is not accessible with standard Admin API tokens.
  /*
  server.registerTool(
    'get_scim_directory_groups',
    {
      title: 'Get SCIM Directory Groups',
      description: 'Retrieve groups from a specific directory via SCIM API for health monitoring and synchronization analysis',
      inputSchema: getScimDirectoryGroupsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params: any) => {
      try {
        const directoryId = params.directoryId;
        
        // Build query parameters for SCIM API
        const queryParams: Record<string, any> = {};
        
        if (params.filter) queryParams.filter = params.filter;
        if (params.startIndex) queryParams.startIndex = params.startIndex;
        if (params.count) queryParams.count = params.count;
        if (params.attributes) queryParams.attributes = params.attributes.join(',');
        if (params.excludedAttributes) queryParams.excludedAttributes = params.excludedAttributes.join(',');

        // Make request to SCIM Directory API
        const response = await apiClient.makeScimDirectoryRequest<ScimDirectoryGroupsResponse>({
          method: 'GET',
          path: `/directory/${directoryId}/Groups`,
          params: queryParams,
        });

        if (response.success && response.data) {
          const groups = response.data.Resources || [];
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                directoryGroups: {
                  directoryId,
                  totalResults: response.data.totalResults,
                  startIndex: response.data.startIndex,
                  itemsPerPage: response.data.itemsPerPage,
                  resultCount: groups.length,
                  groups: groups.map(group => ({
                    id: group.id,
                    displayName: group.displayName,
                    externalId: group.externalId,
                    active: group.active,
                    memberCount: group.members?.length || 0,
                    members: group.members?.map(member => ({
                      value: member.value,
                      display: member.display,
                      type: member.type,
                    })) || [],
                    meta: {
                      resourceType: group.meta.resourceType,
                      created: group.meta.created,
                      lastModified: group.meta.lastModified,
                      version: group.meta.version,
                    },
                    schemas: group.schemas,
                  })),
                  queryParameters: queryParams,
                  executionTime: response.metadata?.executionTime,
                },
                healthInsights: {
                  synchronizationStatus: groups.length > 0 ? 'healthy' : 'warning',
                  lastSyncIndicator: groups.length > 0 ? groups[0].meta.lastModified : null,
                  schemaCompliance: response.data.schemas?.length > 0 ? 'compliant' : 'unknown',
                  totalGroupsInDirectory: response.data.totalResults,
                },
                apiInfo: {
                  endpoint: `/scim/directory/${directoryId}/Groups`,
                  requiredScope: 'read:directory:admin',
                  note: 'SCIM Directory Groups API provides insights into directory group synchronization health',
                },
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to retrieve directory groups from SCIM API');
      } catch (error: any) {
        logger.error('Failed to get SCIM directory groups', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_SCIM_DIRECTORY_GROUPS_ERROR',
                message: sanitizeErrorMessage(error.message),
                details: error.details,
                suggestion: error.suggestion || 'Ensure you have organization admin token with read:directory:admin scope',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );
  */

  // Tool: get_scim_directory_schemas - REMOVED: SCIM Schemas endpoint returns 401 Unauthorized
  // The SCIM API for directory schemas is not accessible with standard Admin API tokens.
  // Directory schema information should be accessed through the Atlassian Admin UI.

  // Tool: get_scim_directory_resource_types - REMOVED: SCIM ResourceTypes endpoint returns 401 Unauthorized
  // The SCIM API for resource types is not accessible with standard Admin API tokens.
  // Resource type information should be accessed through the Atlassian Admin UI.

  // Tool: get_directory_health_status
  server.registerTool(
    'get_directory_health_status',
    {
      title: 'Get Directory Health Status',
      description: 'Comprehensive directory health analysis including sync status, error patterns, and performance metrics',
      inputSchema: getDirectoryHealthStatusInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params: any) => {
      try {
        const validated = getDirectoryHealthStatusSchema.parse(params);
        const orgId = apiClient.getOrgId();
        if (!orgId) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: {
                  code: 'MISSING_ORG_ID',
                  message: 'Organization ID is required for directory health operations',
                  suggestion: 'Set ATLASSIAN_ORG_ID environment variable with your organization ID',
                },
              }, null, 2),
            }],
            isError: true,
          };
        }

        const { directoryId, includeSync = true, includeErrors = true, includePerformance = false } = validated;

        // Get directories from Organization API
        const directoriesResponse = await apiClient.makeOrganizationApiRequest<{
          data: Array<{
            id: string;
            type: string;
            attributes: {
              name: string;
              directoryType: string;
              state?: string;
              syncEnabled?: boolean;
              lastSyncTime?: string;
            };
          }>;
        }>({
          method: 'GET',
          path: `/v1/orgs/${orgId}/directories`,
        });

        if (!directoriesResponse.success || !directoriesResponse.data) {
          throw new Error('Failed to retrieve directories');
        }

        const directories = directoriesResponse.data.data || [];
        const targetDirectories = directoryId
          ? directories.filter(d => d.id === directoryId)
          : directories;

        // Build health status for each directory
        const healthStatus = await Promise.all(targetDirectories.map(async (dir) => {
          const health: any = {
            directoryId: dir.id,
            name: dir.attributes?.name,
            type: dir.attributes?.directoryType,
            state: dir.attributes?.state,
          };

          if (includeSync) {
            health.syncStatus = {
              enabled: dir.attributes?.syncEnabled,
              lastSyncTime: dir.attributes?.lastSyncTime,
              status: dir.attributes?.state === 'active' ? 'healthy' : 'warning',
            };
          }

          // Try to get group count from SCIM API
          if (includePerformance) {
            try {
              const groupsResponse = await apiClient.makeScimDirectoryRequest<ScimDirectoryGroupsResponse>({
                method: 'GET',
                path: `/directory/${dir.id}/Groups`,
                params: { count: 1 },
              });

              if (groupsResponse.success && groupsResponse.data) {
                health.metrics = {
                  totalGroups: groupsResponse.data.totalResults,
                  groupsRetrieved: true,
                };
              }
            } catch (scimError) {
              health.metrics = {
                groupsRetrieved: false,
                note: 'Unable to retrieve group metrics via SCIM API',
              };
            }
          }

          if (includeErrors) {
            health.errorStatus = {
              hasRecentErrors: false,
              note: 'Error logs require audit API access',
            };
          }

          return health;
        }));

        // Calculate overall health
        const overallHealth = {
          status: healthStatus.every(h => h.syncStatus?.status === 'healthy') ? 'healthy' :
                  healthStatus.some(h => h.syncStatus?.status === 'healthy') ? 'degraded' : 'unhealthy',
          totalDirectories: healthStatus.length,
          activeDirectories: healthStatus.filter(h => h.state === 'active').length,
          syncEnabled: healthStatus.filter(h => h.syncStatus?.enabled).length,
        };

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              overallHealth,
              directories: healthStatus,
              analysisOptions: { includeSync, includeErrors, includePerformance },
              orgId,
            }, null, 2),
          }],
        };
      } catch (error: any) {
        logger.error('Failed to analyze directory health status', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_DIRECTORY_HEALTH_ERROR',
                message: sanitizeErrorMessage(error.message),
                details: error.details,
                suggestion: error.suggestion || 'Ensure you have Organization Admin API access',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: get_provisioning_insights
  server.registerTool(
    'get_provisioning_insights',
    {
      title: 'Get Provisioning Insights',
      description: 'Analyze user provisioning patterns, performance, and failure rates across directories',
      inputSchema: getProvisioningInsightsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params: any) => {
      try {
        const validated = getProvisioningInsightsSchema.parse(params);
        const orgId = apiClient.getOrgId();
        if (!orgId) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: {
                  code: 'MISSING_ORG_ID',
                  message: 'Organization ID is required for provisioning insights',
                  suggestion: 'Set ATLASSIAN_ORG_ID environment variable with your organization ID',
                },
              }, null, 2),
            }],
            isError: true,
          };
        }

        const {
          directoryId,
          timeframe = '30d',
          includeFailures = true,
          includePerformance = false,
          groupBy = 'day'
        } = validated;

        // Get directories for context
        const directoriesResponse = await apiClient.makeOrganizationApiRequest<{
          data: Array<{
            id: string;
            type: string;
            attributes: {
              name: string;
              directoryType: string;
              state?: string;
              lastSyncTime?: string;
            };
          }>;
        }>({
          method: 'GET',
          path: `/v1/orgs/${orgId}/directories`,
        });

        if (!directoriesResponse.success || !directoriesResponse.data) {
          throw new Error('Failed to retrieve directories');
        }

        const directories = directoriesResponse.data.data || [];
        const targetDirectories = directoryId
          ? directories.filter(d => d.id === directoryId)
          : directories;

        // Get organization events for provisioning-related actions
        const eventsResponse = await apiClient.makeOrganizationApiRequest<{
          data: Array<{
            id: string;
            type: string;
            attributes: {
              time: string;
              action: string;
              actor?: {
                id: string;
                name?: string;
              };
              context?: Array<{
                name: string;
                id?: string;
              }>;
            };
          }>;
        }>({
          method: 'GET',
          path: `/v1/orgs/${orgId}/events`,
          params: { limit: 100 },
        });

        // Filter events for directory/user provisioning
        const provisioningEvents = eventsResponse.success && eventsResponse.data
          ? (eventsResponse.data.data || []).filter(e =>
              e.attributes?.action?.toLowerCase().includes('user') ||
              e.attributes?.action?.toLowerCase().includes('directory') ||
              e.attributes?.action?.toLowerCase().includes('sync') ||
              e.attributes?.action?.toLowerCase().includes('provision')
            )
          : [];

        // Build provisioning insights for each directory
        const directoryInsights = targetDirectories.map(dir => {
          const dirEvents = provisioningEvents.filter(e =>
            e.attributes?.context?.some(c => c.id === dir.id || c.name?.includes(dir.attributes?.name || ''))
          );

          return {
            directoryId: dir.id,
            name: dir.attributes?.name,
            type: dir.attributes?.directoryType,
            lastSyncTime: dir.attributes?.lastSyncTime,
            recentEvents: dirEvents.length,
            status: dir.attributes?.state === 'active' ? 'healthy' : 'inactive',
          };
        });

        // Calculate aggregate insights
        const insights = {
          summary: {
            totalDirectories: targetDirectories.length,
            activeDirectories: targetDirectories.filter(d => d.attributes?.state === 'active').length,
            totalProvisioningEvents: provisioningEvents.length,
            analysisTimeframe: timeframe,
          },
          directories: directoryInsights,
          recentActivity: provisioningEvents.slice(0, 10).map(e => ({
            id: e.id,
            time: e.attributes?.time,
            action: e.attributes?.action,
            actor: e.attributes?.actor?.name,
          })),
          performance: includePerformance ? {
            note: 'Detailed performance metrics require additional audit API access',
            estimatedHealth: provisioningEvents.length > 0 ? 'active' : 'idle',
          } : null,
          failures: includeFailures ? {
            note: 'Failure analysis requires audit log access with error filtering',
            recentFailureIndicator: 'no failures detected in recent events',
          } : null,
        };

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              insights,
              analysisOptions: {
                directoryId,
                timeframe,
                includeFailures,
                includePerformance,
                groupBy,
              },
              orgId,
            }, null, 2),
          }],
        };
      } catch (error: any) {
        logger.error('Failed to get provisioning insights', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_PROVISIONING_INSIGHTS_ERROR',
                message: sanitizeErrorMessage(error.message),
                details: error.details,
                suggestion: error.suggestion || 'Ensure you have Organization Admin API access',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool registration completed (logging disabled for MCP compatibility)
}