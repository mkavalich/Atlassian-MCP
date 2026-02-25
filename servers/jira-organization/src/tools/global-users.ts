import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { JiraApiClient } from '../api/client.js';
import { logger } from '../utils/logger.js';
import {
  getOrganizationUsersInputSchema,
  searchOrganizationUsersInputSchema,
  getUserRoleAssignmentsInputSchema,
  getUserGroupMembershipsInputSchema,
  analyzeUserAccessInputSchema,
} from '../validation/input-schemas.js';

/**
 * Register Global User Analysis Tools
 * Provides comprehensive READ-ONLY analysis of user accounts, access levels,
 * and product assignments for global administrators.
 * 
 * These tools help diagnose user access issues including:
 * - User account types and status
 * - Product access and licensing
 * - Group memberships and permissions
 * - Azure AD sync status analysis
 */
export async function registerGlobalUserTools(server: McpServer, apiClient: JiraApiClient) {
  
  // Tool: get_organization_users
  server.registerTool(
    'get_organization_users',
    {
      title: 'Get Organization Users',
      description: '🔍 DISCOVERY TOOL: Primary discovery method for organization user operations. Use this first to find available user IDs and account information before using other user management tools. Returns comprehensive list with IDs, account types, and key properties needed for subsequent operations.',
      inputSchema: getOrganizationUsersInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params: any) => {
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
                  message: 'Organization ID is required for user operations',
                  suggestion: 'Set ATLASSIAN_ORG_ID environment variable with your organization ID',
                },
              }, null, 2),
            }],
            isError: true,
          };
        }

        const { limit = 100, accountType, status } = params;

        // Build query parameters
        const queryParams: Record<string, any> = {};
        if (limit) queryParams.limit = limit;

        const response = await apiClient.makeOrganizationApiRequest<{
          data: Array<{
            account_id: string;
            account_type: string;
            account_status: string;
            name: string;
            email: string;
            picture?: string;
            nickname?: string;
            product_access?: Array<{
              key: string;
              name: string;
            }>;
            last_active?: string;
          }>;
          links?: {
            next?: string;
            self?: string;
          };
        }>({
          method: 'GET',
          path: `/v1/orgs/${orgId}/users`,
          params: queryParams,
        });

        if (response.success && response.data) {
          let users = response.data.data || [];

          // Apply client-side filters if provided
          if (accountType) {
            users = users.filter(u => u.account_type === accountType);
          }
          if (status) {
            users = users.filter(u => u.account_status === status);
          }

          // Transform to consistent format
          const transformedUsers = users.map(u => ({
            accountId: u.account_id,
            displayName: u.name,
            emailAddress: u.email,
            accountType: u.account_type,
            accountStatus: u.account_status,
            active: u.account_status === 'active',
            picture: u.picture,
            nickname: u.nickname,
            productAccess: u.product_access,
            lastActive: u.last_active,
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
                },
                filters: { accountType, status },
                orgId,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to retrieve organization users');
      } catch (error: any) {
        logger.error('Failed to get organization users', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_ORGANIZATION_USERS_ERROR',
                message: error.message,
                details: error.details,
                suggestion: error.suggestion || 'Ensure you have Organization Admin API access with user read scope',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: search_organization_users
  server.registerTool(
    'search_organization_users',
    {
      title: 'Search Organization Users',
      description: '🔍 DISCOVERY TOOL: Advanced search for users in the organization with filters. Use this to find specific users by various criteria before performing user operations.',
      inputSchema: searchOrganizationUsersInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params: any) => {
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
                  message: 'Organization ID is required for user search operations',
                  suggestion: 'Set ATLASSIAN_ORG_ID environment variable with your organization ID',
                },
              }, null, 2),
            }],
            isError: true,
          };
        }

        const { query, domain, accountType, lastActiveAfter, limit = 50 } = params;

        // Build query parameters
        const queryParams: Record<string, any> = { limit };

        const response = await apiClient.makeOrganizationApiRequest<{
          data: Array<{
            account_id: string;
            account_type: string;
            account_status: string;
            name: string;
            email: string;
            picture?: string;
            nickname?: string;
            product_access?: Array<{
              key: string;
              name: string;
            }>;
            last_active?: string;
          }>;
          links?: {
            next?: string;
            self?: string;
          };
        }>({
          method: 'GET',
          path: `/v1/orgs/${orgId}/users`,
          params: queryParams,
        });

        if (response.success && response.data) {
          let users = response.data.data || [];

          // Apply client-side filters
          if (query) {
            const lowerQuery = query.toLowerCase();
            users = users.filter(u =>
              u.name?.toLowerCase().includes(lowerQuery) ||
              u.email?.toLowerCase().includes(lowerQuery) ||
              u.nickname?.toLowerCase().includes(lowerQuery)
            );
          }
          if (domain) {
            users = users.filter(u => u.email?.includes(`@${domain}`) || u.email?.endsWith(domain));
          }
          if (accountType) {
            users = users.filter(u => u.account_type === accountType);
          }
          if (lastActiveAfter) {
            const afterDate = new Date(lastActiveAfter);
            users = users.filter(u => u.last_active && new Date(u.last_active) > afterDate);
          }

          // Transform to consistent format
          const transformedUsers = users.map(u => ({
            accountId: u.account_id,
            displayName: u.name,
            emailAddress: u.email,
            accountType: u.account_type,
            accountStatus: u.account_status,
            active: u.account_status === 'active',
            picture: u.picture,
            nickname: u.nickname,
            productAccess: u.product_access,
            lastActive: u.last_active,
          }));

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                users: transformedUsers,
                count: transformedUsers.length,
                filters: { query, domain, accountType, lastActiveAfter },
                pagination: {
                  limit,
                  hasMore: Boolean(response.data.links?.next),
                },
                orgId,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to search organization users');
      } catch (error: any) {
        logger.error('Failed to search organization users', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'SEARCH_ORGANIZATION_USERS_ERROR',
                message: error.message,
                details: error.details,
                suggestion: error.suggestion || 'Ensure you have Organization Admin API access with user read scope',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: get_user_role_assignments
  server.registerTool(
    'get_user_role_assignments',
    {
      title: 'Get User Role Assignments',
      description: '⚠️ PREREQUISITE: Use "get_organization_users" or "search_organization_users" first to find valid user account IDs. Gets a user\'s product access and role assignments across all Atlassian products. If you get "User not found" errors, use the discovery tools to find valid user IDs first.',
      inputSchema: getUserRoleAssignmentsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params: any) => {
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
                  message: 'Organization ID is required for role assignment operations',
                  suggestion: 'Set ATLASSIAN_ORG_ID environment variable with your organization ID',
                },
              }, null, 2),
            }],
            isError: true,
          };
        }

        const { accountId } = params;

        // Get user details including product access from Organization API
        const userResponse = await apiClient.makeOrganizationApiRequest<{
          data: Array<{
            account_id: string;
            account_type: string;
            account_status: string;
            name: string;
            email: string;
            product_access?: Array<{
              key: string;
              name: string;
              url?: string;
              last_active?: string;
            }>;
          }>;
        }>({
          method: 'GET',
          path: `/v1/orgs/${orgId}/users`,
          params: { limit: 100 },
        });

        if (userResponse.success && userResponse.data) {
          // Find the specific user
          const user = userResponse.data.data?.find(u => u.account_id === accountId);

          if (!user) {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: {
                    code: 'USER_NOT_FOUND',
                    message: `User with account ID ${accountId} not found in organization`,
                    suggestion: 'Use get_organization_users first to find valid account IDs',
                  },
                }, null, 2),
              }],
              isError: true,
            };
          }

          // Analyze product access as role assignments
          const productAccess = user.product_access || [];

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                user: {
                  accountId: user.account_id,
                  name: user.name,
                  email: user.email,
                  accountType: user.account_type,
                  accountStatus: user.account_status,
                },
                productAccess: productAccess.map(p => ({
                  productKey: p.key,
                  productName: p.name,
                  siteUrl: p.url,
                  lastActive: p.last_active,
                })),
                summary: {
                  totalProducts: productAccess.length,
                  productKeys: productAccess.map(p => p.key),
                  accountType: user.account_type,
                  isActive: user.account_status === 'active',
                },
                orgId,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to retrieve user role assignments');
      } catch (error: any) {
        logger.error('Failed to get user role assignments', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_USER_ROLE_ASSIGNMENTS_ERROR',
                message: error.message,
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

  // Tool: get_user_group_memberships
  server.registerTool(
    'get_user_group_memberships',
    {
      title: 'Get User Group Memberships',
      description: '⚠️ PREREQUISITE: Use "get_organization_users" or "search_organization_users" first to find valid user account IDs. Gets all groups a user belongs to across the organization. If you get "User not found" errors, use the discovery tools to find valid user IDs first.',
      inputSchema: getUserGroupMembershipsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params: any) => {
      try {
        const orgId = apiClient.getOrgId();
        const { accountId } = params;

        // Get Jira groups
        let jiraGroups: any[] = [];
        try {
          const jiraResponse = await apiClient.makeRequest<any>({
            method: 'GET',
            path: `/rest/api/3/user/groups`,
            params: { accountId },
          });

          if (jiraResponse.success && jiraResponse.data) {
            jiraGroups = jiraResponse.data;
          }
        } catch (jiraError) {
          // Jira groups API may not be available
        }

        // If we have org ID, try to get organization-level groups
        let orgGroups: any[] = [];
        if (orgId) {
          try {
            // First find the user in the organization to get their directory groups
            const userResponse = await apiClient.makeOrganizationApiRequest<{
              data: Array<{
                account_id: string;
                name: string;
                email: string;
              }>;
            }>({
              method: 'GET',
              path: `/v1/orgs/${orgId}/users`,
              params: { limit: 100 },
            });

            if (userResponse.success && userResponse.data) {
              const user = userResponse.data.data?.find(u => u.account_id === accountId);

              if (user) {
                // Get directory groups from the organization
                const groupsResponse = await apiClient.makeOrganizationApiRequest<{
                  data: Array<{
                    id: string;
                    type: string;
                    attributes: {
                      displayName: string;
                      description?: string;
                      memberCount?: number;
                    };
                  }>;
                }>({
                  method: 'GET',
                  path: `/v1/orgs/${orgId}/groups`,
                });

                if (groupsResponse.success && groupsResponse.data) {
                  orgGroups = groupsResponse.data.data || [];
                }
              }
            }
          } catch (orgError) {
            // Organization API access may not be available
          }
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              accountId,
              jiraGroups: jiraGroups.map((g: any) => ({
                name: g.name,
                groupId: g.groupId,
                self: g.self,
              })),
              organizationGroups: orgGroups.map((g: any) => ({
                id: g.id,
                displayName: g.attributes?.displayName,
                description: g.attributes?.description,
                memberCount: g.attributes?.memberCount,
              })),
              summary: {
                jiraGroupCount: jiraGroups.length,
                orgGroupCount: orgGroups.length,
                hasOrgAccess: Boolean(orgId),
              },
              orgId,
            }, null, 2),
          }],
        };
      } catch (error: any) {
        logger.error('Failed to get user group memberships', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_USER_GROUP_MEMBERSHIPS_ERROR',
                message: error.message,
                details: error.details,
                suggestion: error.suggestion || 'Ensure you have Organization Admin API access for complete group data',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: analyze_user_access
  server.registerTool(
    'analyze_user_access',
    {
      title: 'Analyze User Access',
      description: '⚠️ PREREQUISITE: Use "get_organization_users" or "search_organization_users" first to find valid user account IDs. Comprehensive analysis of a user\'s access across all products and services. If you get "User not found" errors, use the discovery tools to find valid user IDs first.',
      inputSchema: analyzeUserAccessInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params: any) => {
      try {
        const orgId = apiClient.getOrgId();
        const { accountId, email } = params;

        if (!accountId && !email) {
          throw new Error('Either accountId or email must be provided');
        }

        // Collect data from multiple sources
        let jiraUserInfo: any = null;
        let orgUserInfo: any = null;
        let jiraGroups: any[] = [];
        let actualAccountId = accountId;

        // Get Jira user info
        if (email && !accountId) {
          try {
            const searchResponse = await apiClient.makeRequest<any>({
              method: 'GET',
              path: '/rest/api/3/user/search',
              params: { query: email },
            });

            if (searchResponse.success && searchResponse.data && searchResponse.data.length > 0) {
              const user = searchResponse.data.find((u: any) =>
                u.emailAddress === email || u.email === email
              );
              if (user) {
                jiraUserInfo = user;
                actualAccountId = user.accountId;
              }
            }
          } catch (searchError) {
            // Search failed
          }
        } else if (accountId) {
          try {
            const userResponse = await apiClient.makeRequest<any>({
              method: 'GET',
              path: '/rest/api/3/user',
              params: { accountId },
            });

            if (userResponse.success && userResponse.data) {
              jiraUserInfo = userResponse.data;
            }
          } catch (userError) {
            // User not accessible
          }
        }

        // Get Jira groups
        if (actualAccountId) {
          try {
            const groupsResponse = await apiClient.makeRequest<any>({
              method: 'GET',
              path: `/rest/api/3/user/groups`,
              params: { accountId: actualAccountId },
            });

            if (groupsResponse.success && groupsResponse.data) {
              jiraGroups = groupsResponse.data;
            }
          } catch (groupsError) {
            // Groups not accessible
          }
        }

        // Get Organization API data if available
        if (orgId) {
          try {
            const orgResponse = await apiClient.makeOrganizationApiRequest<{
              data: Array<{
                account_id: string;
                account_type: string;
                account_status: string;
                name: string;
                email: string;
                product_access?: Array<{
                  key: string;
                  name: string;
                  url?: string;
                  last_active?: string;
                }>;
                last_active?: string;
              }>;
            }>({
              method: 'GET',
              path: `/v1/orgs/${orgId}/users`,
              params: { limit: 100 },
            });

            if (orgResponse.success && orgResponse.data) {
              // Find user by accountId or email
              orgUserInfo = orgResponse.data.data?.find(u =>
                u.account_id === actualAccountId ||
                u.email === email ||
                u.email === jiraUserInfo?.emailAddress
              );
            }
          } catch (orgError) {
            // Organization API not accessible
          }
        }

        // Combine analysis from all sources
        const userEmail = email || jiraUserInfo?.emailAddress || orgUserInfo?.email;
        const analysis = {
          user: {
            accountId: actualAccountId || orgUserInfo?.account_id,
            email: userEmail,
            displayName: jiraUserInfo?.displayName || orgUserInfo?.name,
            accountType: orgUserInfo?.account_type || jiraUserInfo?.accountType,
            accountStatus: orgUserInfo?.account_status || (jiraUserInfo?.active ? 'active' : 'inactive'),
          },
          jiraAccess: {
            hasJiraAccess: jiraUserInfo !== null,
            active: jiraUserInfo?.active,
            avatarUrl: jiraUserInfo?.avatarUrls?.['48x48'],
            groupCount: jiraGroups.length,
          },
          organizationAccess: orgUserInfo ? {
            hasOrgData: true,
            accountType: orgUserInfo.account_type,
            accountStatus: orgUserInfo.account_status,
            productCount: orgUserInfo.product_access?.length || 0,
            products: orgUserInfo.product_access?.map((p: any) => ({
              key: p.key,
              name: p.name,
              lastActive: p.last_active,
            })) || [],
            lastActive: orgUserInfo.last_active,
          } : {
            hasOrgData: false,
            note: orgId ? 'User not found in organization' : 'Organization ID not configured',
          },
          groups: {
            jiraGroups: jiraGroups.map((g: any) => g.name),
            totalGroups: jiraGroups.length,
          },
          analysis: {
            isAzureADSynced: userEmail?.includes('@') && !userEmail?.endsWith('.atlassian.net'),
            accountTypeAnalysis: orgUserInfo?.account_type === 'customer'
              ? 'Customer account - limited Jira access, can use JSM portal'
              : orgUserInfo?.account_type === 'atlassian'
              ? 'Licensed Atlassian account - full product access'
              : jiraUserInfo?.accountType === 'customer'
              ? 'Customer account - limited Jira access, can use JSM portal'
              : jiraUserInfo?.accountType === 'atlassian'
              ? 'Licensed Atlassian account - full product access'
              : 'Unknown account type',
            visibilityAnalysis: (orgUserInfo?.account_type || jiraUserInfo?.accountType) === 'customer'
              ? 'Customer accounts have restricted visibility in user pickers'
              : 'Licensed accounts have broader user visibility',
          },
          troubleshooting: {
            customerVisibilityIssues: [
              'Check if user is assigned to customer organizations',
              'Verify JSM project customer sharing settings',
              'Confirm user has customer account type',
              'Check Azure AD sync status',
            ],
            accessIssues: [
              'Verify user account is active',
              'Check product license assignments',
              'Verify group memberships',
              'Check for suspended status',
            ],
          },
        };

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              analysis,
              dataSources: {
                jiraApi: jiraUserInfo !== null,
                organizationApi: orgUserInfo !== null,
              },
              orgId,
            }, null, 2),
          }],
        };
      } catch (error: any) {
        logger.error('Failed to analyze user access', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'ANALYZE_USER_ACCESS_ERROR',
                message: error.message,
                details: error.details,
                suggestion: error.suggestion || 'Provide valid accountId or email',
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