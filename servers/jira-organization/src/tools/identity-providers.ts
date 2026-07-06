import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { JiraApiClient } from '../api/client.js';
import { logger } from '../utils/logger.js';
import { sanitizeErrorMessage } from '../utils/errors.js';
import {
  getIdentityProvidersInputSchema,
  getDirectoryInfoInputSchema,
  getDirectorySyncStatusInputSchema,
  getDirectorySyncSettingsInputSchema,
  getDirectoryUsersInputSchema,
  getDirectoryGroupsInputSchema,
  getUserLastActiveInputSchema,
} from '../validation/input-schemas.js';
import {
  getDirectoryInfoSchema,
  getDirectorySyncStatusSchema,
  getDirectorySyncSettingsSchema,
  getDirectoryUsersSchema,
  getUserLastActiveSchema,
} from '../validation/schemas.js';

/**
 * Register Identity Provider and Directory Analysis Tools
 * Provides comprehensive READ-ONLY analysis of identity providers, user directories,
 * Azure AD sync status, and SCIM provisioning for global administrators.
 *
 * These tools help diagnose identity provider issues including:
 * - Identity provider configuration
 * - Directory sync status and health
 * - Azure AD/SCIM sync configuration
 * - User provisioning status
 */
export async function registerIdentityProviderTools(server: McpServer, apiClient: JiraApiClient) {

  // Tool: get_identity_providers
  server.registerTool(
    'get_identity_providers',
    {
      title: 'Get Identity Providers',
      description: '🔍 DISCOVERY TOOL: Primary discovery method for identity provider operations. Lists all configured identity providers and their status. Use this first to understand your directory configuration before troubleshooting sync issues.',
      inputSchema: getIdentityProvidersInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async () => {
      try {
        const orgId = apiClient.getOrgId();
        if (!orgId) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: {
                  code: 'MISSING_ORG_ID',
                  message: 'Organization ID is required for identity provider operations',
                  suggestion: 'Set ATLASSIAN_ORG_ID environment variable with your organization ID',
                },
              }, null, 2),
            }],
            isError: true,
          };
        }

        const response = await apiClient.makeOrganizationApiRequest<{
          data: Array<{
            directoryId: string;
            type: string;
            name: string;
            state: string;
            lastSyncTime?: string;
            userCount?: number;
            groupCount?: number;
          }>;
        }>({
          method: 'GET',
          path: `/v1/orgs/${orgId}/directories`,
        });

        if (response.success && response.data) {
          const directories = response.data.data || [];

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                directories,
                count: directories.length,
                orgId,
                usage_guidance: 'Use directory IDs with get_directory_info, get_directory_sync_status, etc.',
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to retrieve identity providers');
      } catch (error: any) {
        logger.error('Failed to get identity providers', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_IDENTITY_PROVIDERS_ERROR',
                message: sanitizeErrorMessage(error.message),
                details: error.details,
                suggestion: error.suggestion || 'Ensure you have Organization Admin API access with read:directory:admin scope',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: get_directory_info
  server.registerTool(
    'get_directory_info',
    {
      title: 'Get Directory Information',
      description: '⚠️ PREREQUISITE: Use "get_identity_providers" first to find valid directory IDs. Gets detailed information about a specific directory configuration. If you get "Directory not found" errors, use the discovery tool to find valid directory IDs first.',
      inputSchema: getDirectoryInfoInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params: any) => {
      try {
        const { directoryId } = getDirectoryInfoSchema.parse(params);

        const orgId = apiClient.getOrgId();
        if (!orgId) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: {
                  code: 'MISSING_ORG_ID',
                  message: 'Organization ID is required for directory operations',
                  suggestion: 'Set ATLASSIAN_ORG_ID environment variable with your organization ID',
                },
              }, null, 2),
            }],
            isError: true,
          };
        }

        const response = await apiClient.makeOrganizationApiRequest<{
          directoryId: string;
          type: string;
          name: string;
          state: string;
          lastSyncTime?: string;
          userCount?: number;
          groupCount?: number;
          syncEnabled?: boolean;
          domains?: string[];
          attributes?: Record<string, any>;
        }>({
          method: 'GET',
          path: `/v1/orgs/${orgId}/directories/${encodeURIComponent(directoryId)}`,
        });

        if (response.success && response.data) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                directory: response.data,
                directoryId,
                orgId,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to retrieve directory information');
      } catch (error: any) {
        logger.error('Failed to get directory info', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_DIRECTORY_INFO_ERROR',
                message: sanitizeErrorMessage(error.message),
                details: error.details,
                suggestion: error.suggestion || 'Use get_identity_providers first to find valid directory IDs',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: get_directory_sync_status
  server.registerTool(
    'get_directory_sync_status',
    {
      title: 'Get Directory Sync Status',
      description: '⚠️ PREREQUISITE: Use "get_identity_providers" first to find valid directory IDs. Checks the sync status and health of directory synchronization. If you get "Directory not found" errors, use the discovery tool to find valid directory IDs first.',
      inputSchema: getDirectorySyncStatusInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params: any) => {
      try {
        const { directoryId } = getDirectorySyncStatusSchema.parse(params);

        const orgId = apiClient.getOrgId();
        if (!orgId) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: {
                  code: 'MISSING_ORG_ID',
                  message: 'Organization ID is required for sync status operations',
                  suggestion: 'Set ATLASSIAN_ORG_ID environment variable with your organization ID',
                },
              }, null, 2),
            }],
            isError: true,
          };
        }

        // If no directoryId provided, get sync status for all directories
        if (!directoryId) {
          const response = await apiClient.makeOrganizationApiRequest<{
            data: Array<{
              directoryId: string;
              name: string;
              type: string;
              state: string;
              lastSyncTime?: string;
              syncStatus?: string;
            }>;
          }>({
            method: 'GET',
            path: `/v1/orgs/${orgId}/directories`,
          });

          if (response.success && response.data) {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  syncStatus: response.data.data?.map(d => ({
                    directoryId: d.directoryId,
                    name: d.name,
                    type: d.type,
                    state: d.state,
                    lastSyncTime: d.lastSyncTime,
                  })) || [],
                  count: response.data.data?.length || 0,
                  orgId,
                }, null, 2),
              }],
            };
          }
        }

        // Get sync status for specific directory
        const response = await apiClient.makeOrganizationApiRequest<{
          directoryId: string;
          syncStatus: string;
          lastSyncTime?: string;
          lastSyncResult?: string;
          syncInProgress?: boolean;
          nextSyncTime?: string;
          usersSynced?: number;
          groupsSynced?: number;
          errors?: Array<{ code: string; message: string }>;
        }>({
          method: 'GET',
          path: `/v1/orgs/${orgId}/directories/${encodeURIComponent(directoryId as string)}`,
        });

        if (response.success && response.data) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                syncStatus: {
                  directoryId: response.data.directoryId,
                  status: response.data.syncStatus,
                  lastSyncTime: response.data.lastSyncTime,
                  lastSyncResult: response.data.lastSyncResult,
                  syncInProgress: response.data.syncInProgress,
                  nextSyncTime: response.data.nextSyncTime,
                  usersSynced: response.data.usersSynced,
                  groupsSynced: response.data.groupsSynced,
                  errors: response.data.errors,
                },
                orgId,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to retrieve sync status');
      } catch (error: any) {
        logger.error('Failed to get directory sync status', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_DIRECTORY_SYNC_STATUS_ERROR',
                message: sanitizeErrorMessage(error.message),
                details: error.details,
                suggestion: error.suggestion || 'Use get_identity_providers first to find valid directory IDs',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: get_directory_sync_settings
  server.registerTool(
    'get_directory_sync_settings',
    {
      title: 'Get Directory Sync Settings',
      description: '⚠️ PREREQUISITE: Use "get_identity_providers" first to find valid directory IDs. Gets sync configuration including frequency, domains, and group settings. If you get "Directory not found" errors, use the discovery tool to find valid directory IDs first.',
      inputSchema: getDirectorySyncSettingsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params: any) => {
      try {
        const { directoryId } = getDirectorySyncSettingsSchema.parse(params);

        const orgId = apiClient.getOrgId();
        if (!orgId) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: {
                  code: 'MISSING_ORG_ID',
                  message: 'Organization ID is required for sync settings operations',
                  suggestion: 'Set ATLASSIAN_ORG_ID environment variable with your organization ID',
                },
              }, null, 2),
            }],
            isError: true,
          };
        }

        const response = await apiClient.makeOrganizationApiRequest<{
          directoryId: string;
          type: string;
          name: string;
          syncEnabled?: boolean;
          syncFrequency?: string;
          domains?: string[];
          userIdentifierAttribute?: string;
          groupSyncEnabled?: boolean;
          nestedGroupsEnabled?: boolean;
          attributes?: Record<string, any>;
        }>({
          method: 'GET',
          path: `/v1/orgs/${orgId}/directories/${encodeURIComponent(directoryId)}`,
        });

        if (response.success && response.data) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                syncSettings: {
                  directoryId: response.data.directoryId,
                  type: response.data.type,
                  name: response.data.name,
                  syncEnabled: response.data.syncEnabled,
                  syncFrequency: response.data.syncFrequency,
                  domains: response.data.domains,
                  userIdentifierAttribute: response.data.userIdentifierAttribute,
                  groupSyncEnabled: response.data.groupSyncEnabled,
                  nestedGroupsEnabled: response.data.nestedGroupsEnabled,
                  attributes: response.data.attributes,
                },
                orgId,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to retrieve sync settings');
      } catch (error: any) {
        logger.error('Failed to get directory sync settings', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_DIRECTORY_SYNC_SETTINGS_ERROR',
                message: sanitizeErrorMessage(error.message),
                details: error.details,
                suggestion: error.suggestion || 'Use get_identity_providers first to find valid directory IDs',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: get_directory_users
  server.registerTool(
    'get_directory_users',
    {
      title: 'Get Directory Users',
      description: '⚠️ PREREQUISITE: Use "get_identity_providers" first to find valid directory IDs. Lists users synced from directories with their sync status and attributes. If you get "Directory not found" errors, use the discovery tool to find valid directory IDs first.',
      inputSchema: getDirectoryUsersInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params: any) => {
      try {
        const { directoryId, limit = 100, cursor } = getDirectoryUsersSchema.parse(params);

        const orgId = apiClient.getOrgId();
        if (!orgId) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: {
                  code: 'MISSING_ORG_ID',
                  message: 'Organization ID is required for directory user operations',
                  suggestion: 'Set ATLASSIAN_ORG_ID environment variable with your organization ID',
                },
              }, null, 2),
            }],
            isError: true,
          };
        }

        const queryParams: Record<string, any> = { limit };
        if (cursor) queryParams.cursor = cursor;

        // Use directory-filtered users endpoint or general users endpoint
        const path = directoryId
          ? `/v1/orgs/${orgId}/directory/users?directoryId=${encodeURIComponent(directoryId)}`
          : `/v1/orgs/${orgId}/directory/users`;

        const response = await apiClient.makeOrganizationApiRequest<{
          data: Array<{
            accountId: string;
            accountType: string;
            accountStatus: string;
            name: string;
            email: string;
            avatarUrl?: string;
            created?: string;
            lastActive?: string;
            productAccess?: Array<{ productKey: string; productName: string }>;
          }>;
          links?: {
            next?: string;
            self?: string;
          };
        }>({
          method: 'GET',
          path,
          params: queryParams,
        });

        if (response.success && response.data) {
          const users = response.data.data || [];

          // Transform to consistent format with user entity fields
          const transformedUsers = users.map(u => ({
            accountId: u.accountId,
            displayName: u.name,
            emailAddress: u.email,
            accountType: u.accountType,
            accountStatus: u.accountStatus,
            active: u.accountStatus === 'active',
            avatarUrl: u.avatarUrl,
            created: u.created,
            lastActive: u.lastActive,
            productAccess: u.productAccess,
          }));

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                users: transformedUsers,
                count: transformedUsers.length,
                pagination: {
                  limit,
                  hasMore: Boolean(response.data.links?.next),
                  nextCursor: response.data.links?.next,
                },
                directoryId: directoryId || 'all',
                orgId,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to retrieve directory users');
      } catch (error: any) {
        logger.error('Failed to get directory users', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_DIRECTORY_USERS_ERROR',
                message: sanitizeErrorMessage(error.message),
                details: error.details,
                suggestion: error.suggestion || 'Use get_identity_providers first to find valid directory IDs',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // REMOVED: get_directory_groups - Cloud API limitation (endpoint returns 403 Forbidden)

  // Tool: get_user_last_active
  server.registerTool(
    'get_user_last_active',
    {
      title: 'Get User Last Active Dates',
      description: '⚠️ PREREQUISITE: Use "get_organization_users" first to find valid user account IDs. Gets a user\'s last active dates across all Atlassian products. If you get "User not found" errors, use the user discovery tools to find valid user IDs first.',
      inputSchema: getUserLastActiveInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params: any) => {
      try {
        const { accountId } = getUserLastActiveSchema.parse(params);

        const orgId = apiClient.getOrgId();
        if (!orgId) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: {
                  code: 'MISSING_ORG_ID',
                  message: 'Organization ID is required for user activity operations',
                  suggestion: 'Set ATLASSIAN_ORG_ID environment variable with your organization ID',
                },
              }, null, 2),
            }],
            isError: true,
          };
        }

        const response = await apiClient.makeOrganizationApiRequest<{
          data: {
            accountId: string;
            productAccess: Array<{
              key: string;
              name: string;
              siteUrl?: string;
              lastActive?: string;
            }>;
          };
        }>({
          method: 'GET',
          path: `/v1/orgs/${orgId}/directory/users/${encodeURIComponent(accountId)}/last-active-dates`,
        });

        if (response.success && response.data) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                accountId,
                productActivity: response.data.data?.productAccess || [],
                orgId,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to retrieve user last active dates');
      } catch (error: any) {
        logger.error('Failed to get user last active dates', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_USER_LAST_ACTIVE_ERROR',
                message: sanitizeErrorMessage(error.message),
                details: error.details,
                suggestion: error.suggestion || 'Use get_organization_users first to find valid user account IDs',
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
