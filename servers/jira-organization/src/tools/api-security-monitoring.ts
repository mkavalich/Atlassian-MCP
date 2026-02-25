import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { JiraApiClient } from '../api/client.js';
import { logger } from '../utils/logger.js';
import {
  getUserManageSchema,
  getUserManageProfileSchema,
  getUserManageApiTokensSchema,
  getOrgUserStatsSchema,
  getOrgGroupStatsSchema,
} from '../validation/schemas.js';
import {
  getUserManageInputSchema,
  getUserManageProfileInputSchema,
  getUserManageApiTokensInputSchema,
  getOrgUserStatsInputSchema,
  getOrgGroupStatsInputSchema,
} from '../validation/input-schemas.js';

/**
 * Register API Usage & Security Monitoring Tools
 * Provides comprehensive READ-ONLY analysis of API usage, security monitoring,
 * user management permissions, and usage analytics for organization administrators.
 * 
 * These tools help monitor and analyze:
 * - User management permissions and capabilities
 * - Detailed user profile information
 * - User API token usage and security
 * - Organization-level user statistics
 * - Directory-level user and group analytics
 * 
 * All tools are READ-ONLY and designed for security monitoring and compliance.
 */
export async function registerApiSecurityMonitoringTools(server: McpServer, apiClient: JiraApiClient) {
  
  // Tool: get_user_manage
  server.registerTool(
    'get_user_manage',
    {
      title: 'Get User Management Permissions',
      description: 'Retrieve user management permissions and capabilities for a specific user',
      inputSchema: getUserManageInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = getUserManageSchema.parse(params);
        
        const response = await apiClient.makeOrgAdminRequest<any>({
          method: 'GET',
          path: `/admin/v1/users/${validatedParams.account_id}/manage`,
        });

        if (response.success && response.data) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                userManagePermissions: response.data,
                accountId: validatedParams.account_id,
                timestamp: new Date().toISOString(),
                message: 'User management permissions retrieved successfully',
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to retrieve user management permissions');
      } catch (error: any) {
        logger.error('Failed to get user manage permissions', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_USER_MANAGE_ERROR',
                message: error.message,
                details: error.details,
                suggestion: error.suggestion || 'Ensure you have Organization Admin permissions and the correct scopes (read:user-permissions:admin)',
                requiredScopes: ['read:user-permissions:admin'],
                authenticationMethod: 'Organization Admin API token',
                endpoint: '/admin/v1/users/{account_id}/manage',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: get_user_manage_profile
  server.registerTool(
    'get_user_manage_profile',
    {
      title: 'Get User Management Profile',
      description: 'Retrieve detailed user profile information for management purposes',
      inputSchema: getUserManageProfileInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = getUserManageProfileSchema.parse(params);
        
        const response = await apiClient.makeOrgAdminRequest<any>({
          method: 'GET',
          path: `/admin/v1/users/${validatedParams.account_id}/manage/profile`,
        });

        if (response.success && response.data) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                userProfile: response.data,
                accountId: validatedParams.account_id,
                timestamp: new Date().toISOString(),
                message: 'User management profile retrieved successfully',
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to retrieve user management profile');
      } catch (error: any) {
        logger.error('Failed to get user manage profile', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_USER_MANAGE_PROFILE_ERROR',
                message: error.message,
                details: error.details,
                suggestion: error.suggestion || 'Ensure you have Organization Admin permissions and the correct scopes (read:user-permissions:admin)',
                requiredScopes: ['read:user-permissions:admin'],
                authenticationMethod: 'Organization Admin API token',
                endpoint: '/admin/v1/users/{account_id}/manage/profile',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: get_user_manage_api_tokens
  server.registerTool(
    'get_user_manage_api_tokens',
    {
      title: 'Get User API Tokens',
      description: 'Retrieve API tokens for a specific user for security monitoring',
      inputSchema: getUserManageApiTokensInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = getUserManageApiTokensSchema.parse(params);
        
        const response = await apiClient.makeOrgAdminRequest<any>({
          method: 'GET',
          path: `/admin/v1/users/${validatedParams.account_id}/manage/api-tokens`,
        });

        if (response.success && response.data) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                apiTokens: response.data.data || response.data,
                accountId: validatedParams.account_id,
                count: response.data.data?.length || (Array.isArray(response.data) ? response.data.length : 0),
                timestamp: new Date().toISOString(),
                message: 'User API tokens retrieved successfully',
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to retrieve user API tokens');
      } catch (error: any) {
        logger.error('Failed to get user API tokens', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_USER_API_TOKENS_ERROR',
                message: error.message,
                details: error.details,
                suggestion: error.suggestion || 'Ensure you have Organization Admin permissions and the correct scopes (read:user-permissions:admin)',
                requiredScopes: ['read:user-permissions:admin'],
                authenticationMethod: 'Organization Admin API token',
                endpoint: '/admin/v1/users/{account_id}/manage/api-tokens',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: get_org_user_stats
  server.registerTool(
    'get_org_user_stats',
    {
      title: 'Get Organization User Statistics',
      description: 'Retrieve user statistics for organization and directory analysis',
      inputSchema: getOrgUserStatsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = getOrgUserStatsSchema.parse(params);
        
        const queryParams: any = {};
        if (validatedParams.includeInactive) {
          queryParams.includeInactive = validatedParams.includeInactive;
        }
        if (validatedParams.timeframe) {
          queryParams.timeframe = validatedParams.timeframe;
        }

        const response = await apiClient.makeOrgAdminRequest<any>({
          method: 'GET',
          path: `/admin/v2/orgs/${validatedParams.orgId}/directories/${validatedParams.directoryId}/users/stats`,
          params: queryParams,
        });

        if (response.success && response.data) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                userStats: response.data,
                organizationId: validatedParams.orgId,
                directoryId: validatedParams.directoryId,
                includeInactive: validatedParams.includeInactive,
                timeframe: validatedParams.timeframe,
                timestamp: new Date().toISOString(),
                message: 'Organization user statistics retrieved successfully',
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to retrieve organization user statistics');
      } catch (error: any) {
        logger.error('Failed to get organization user stats', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_ORG_USER_STATS_ERROR',
                message: error.message,
                details: error.details,
                suggestion: error.suggestion || 'Ensure you have Organization Admin permissions and the correct scopes (read:user-stats:admin)',
                requiredScopes: ['read:user-stats:admin'],
                authenticationMethod: 'Organization Admin API token',
                endpoint: '/admin/v2/orgs/{orgId}/directories/{directoryId}/users/stats',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: get_org_group_stats
  server.registerTool(
    'get_org_group_stats',
    {
      title: 'Get Organization Group Statistics',
      description: 'Retrieve group statistics for organization and directory analysis',
      inputSchema: getOrgGroupStatsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = getOrgGroupStatsSchema.parse(params);
        
        const queryParams: any = {};
        if (validatedParams.includeEmpty) {
          queryParams.includeEmpty = validatedParams.includeEmpty;
        }
        if (validatedParams.timeframe) {
          queryParams.timeframe = validatedParams.timeframe;
        }

        const response = await apiClient.makeOrgAdminRequest<any>({
          method: 'GET',
          path: `/admin/v2/orgs/${validatedParams.orgId}/directories/${validatedParams.directoryId}/groups/stats`,
          params: queryParams,
        });

        if (response.success && response.data) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                groupStats: response.data,
                organizationId: validatedParams.orgId,
                directoryId: validatedParams.directoryId,
                includeEmpty: validatedParams.includeEmpty,
                timeframe: validatedParams.timeframe,
                timestamp: new Date().toISOString(),
                message: 'Organization group statistics retrieved successfully',
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to retrieve organization group statistics');
      } catch (error: any) {
        logger.error('Failed to get organization group stats', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_ORG_GROUP_STATS_ERROR',
                message: error.message,
                details: error.details,
                suggestion: error.suggestion || 'Ensure you have Organization Admin permissions and the correct scopes (read:user-stats:admin)',
                requiredScopes: ['read:user-stats:admin'],
                authenticationMethod: 'Organization Admin API token',
                endpoint: '/admin/v2/orgs/{orgId}/directories/{directoryId}/groups/stats',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // API Security Monitoring tools registered successfully (logging disabled for MCP compatibility)
}