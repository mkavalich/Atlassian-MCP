import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { JiraApiClient } from '../api/client.js';
import { logger } from '../utils/logger.js';
import {
  getCrossProductUserActivityInputSchema,
} from '../validation/input-schemas.js';
import {
  getCrossProductUserActivitySchema,
} from '../validation/schemas.js';

// Helper function to calculate time since a date
function getTimeSince(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffDays > 0) return `${diffDays} day(s) ago`;
  if (diffHours > 0) return `${diffHours} hour(s) ago`;
  if (diffMinutes > 0) return `${diffMinutes} minute(s) ago`;
  return 'just now';
}

// Helper function to generate IdP recommendations
function generateIdpRecommendations(directories: any[], users: any[]): string[] {
  const recommendations: string[] = [];

  // Check for inactive directories
  const inactiveDirectories = directories.filter(d => d.attributes?.state !== 'active');
  if (inactiveDirectories.length > 0) {
    recommendations.push(`${inactiveDirectories.length} directory(ies) are inactive - consider reviewing their status`);
  }

  // Check for directories without sync enabled
  const noSyncDirectories = directories.filter(d => !d.attributes?.syncEnabled);
  if (noSyncDirectories.length > 0) {
    recommendations.push(`${noSyncDirectories.length} directory(ies) have sync disabled - enable sync for automated user management`);
  }

  // Check for stale sync
  directories.forEach(d => {
    if (d.attributes?.lastSyncTime) {
      const syncDate = new Date(d.attributes.lastSyncTime);
      const daysSinceSync = (Date.now() - syncDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceSync > 7) {
        recommendations.push(`Directory "${d.attributes?.name}" hasn't synced in ${Math.floor(daysSinceSync)} days`);
      }
    }
  });

  // Check user distribution
  const inactiveUsers = users.filter(u => u.account_status !== 'active');
  if (inactiveUsers.length > users.length * 0.2) {
    recommendations.push(`${inactiveUsers.length} users (${Math.round(inactiveUsers.length / users.length * 100)}%) are inactive - consider cleanup`);
  }

  if (recommendations.length === 0) {
    recommendations.push('All identity providers are healthy and configured correctly');
  }

  return recommendations;
}

// Helper function to calculate directory health status
function calculateDirectoryHealth(attributes: any): string {
  if (!attributes) return 'unknown';
  if (attributes.state !== 'active') return 'inactive';
  if (!attributes.syncEnabled) return 'sync_disabled';

  if (attributes.lastSyncTime) {
    const syncDate = new Date(attributes.lastSyncTime);
    const hoursAgo = (Date.now() - syncDate.getTime()) / (1000 * 60 * 60);
    if (hoursAgo > 168) return 'stale'; // More than 7 days
    if (hoursAgo > 24) return 'warning';
  }

  return 'healthy';
}

// Helper function to generate directory alerts
function generateDirectoryAlerts(attributes: any, syncAgeHours: number | null): string[] {
  const alerts: string[] = [];

  if (attributes?.state !== 'active') {
    alerts.push('Directory is not active');
  }
  if (!attributes?.syncEnabled) {
    alerts.push('Sync is disabled');
  }
  if (syncAgeHours !== null && syncAgeHours > 168) {
    alerts.push(`Sync is stale (${Math.round(syncAgeHours / 24)} days old)`);
  } else if (syncAgeHours !== null && syncAgeHours > 24) {
    alerts.push(`Last sync was ${Math.round(syncAgeHours)} hours ago`);
  }

  return alerts;
}

// Helper function to generate monitoring recommendations
function generateMonitoringRecommendations(directoryHealth: any[]): string[] {
  const recommendations: string[] = [];

  const unhealthyDirs = directoryHealth.filter(d => d.health.overall !== 'healthy');
  if (unhealthyDirs.length > 0) {
    unhealthyDirs.forEach(d => {
      if (d.health.overall === 'inactive') {
        recommendations.push(`Activate directory "${d.name}"`);
      } else if (d.health.overall === 'sync_disabled') {
        recommendations.push(`Enable sync for directory "${d.name}"`);
      } else if (d.health.overall === 'stale') {
        recommendations.push(`Investigate sync issues for directory "${d.name}"`);
      }
    });
  }

  if (recommendations.length === 0) {
    recommendations.push('All directories are operating normally');
  }

  return recommendations;
}

// Helper function to generate behavior-based recommendations
function generateBehaviorRecommendations(users: any[], activeUsers: any[], noProductUsers: any[], inactiveUsers: any[]): string[] {
  const recommendations: string[] = [];
  const totalUsers = users.length;

  // Low engagement recommendation
  const engagementRate = totalUsers > 0 ? (activeUsers.length / totalUsers) * 100 : 0;
  if (engagementRate < 50) {
    recommendations.push(`Only ${Math.round(engagementRate)}% of users were active in the last 7 days - consider engagement initiatives`);
  }

  // Unused licenses recommendation
  if (noProductUsers.length > 0) {
    recommendations.push(`${noProductUsers.length} user(s) have no product access - consider license assignment or cleanup`);
  }

  // Inactive accounts recommendation
  if (inactiveUsers.length > 0 && inactiveUsers.length > totalUsers * 0.1) {
    recommendations.push(`${inactiveUsers.length} user(s) are inactive - review for potential deactivation`);
  }

  // Good health message
  if (recommendations.length === 0) {
    recommendations.push('User behavior patterns are healthy with good engagement');
  }

  return recommendations;
}

/**
 * Register Enhanced Directory Analytics Tools
 * Provides advanced READ-ONLY analytics for cross-product user activity
 * and enhanced directory insights for enterprise administrators.
 * 
 * These tools enhance existing directory functionality with:
 * - Cross-product user activity correlation
 * - Enhanced identity provider insights with provisioning data
 * - Advanced directory health monitoring
 * - User behavior pattern analysis across Atlassian products
 * 
 * Required scopes: read:directory:admin, read:users:admin
 */
export async function registerEnhancedDirectoryAnalyticsTools(server: McpServer, apiClient: JiraApiClient) {
  
  // Tool: get_cross_product_user_activity
  server.registerTool(
    'get_cross_product_user_activity',
    {
      title: 'Get Cross-Product User Activity',
      description: 'Analyze user activity patterns across Atlassian products for comprehensive user behavior insights',
      inputSchema: getCrossProductUserActivityInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = getCrossProductUserActivitySchema.parse(params);
        const orgId = apiClient.getOrgId();
        if (!orgId) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: {
                  code: 'MISSING_ORG_ID',
                  message: 'Organization ID is required for cross-product activity analysis',
                  suggestion: 'Set ATLASSIAN_ORG_ID environment variable with your organization ID',
                },
              }, null, 2),
            }],
            isError: true,
          };
        }

        const {
          accountId,
          email,
          startDate,
          endDate,
          products = ['jira', 'confluence', 'bitbucket', 'trello'],
          includeDetails = false,
        } = validatedParams;

        // Get organization users to find the target user
        const usersResponse = await apiClient.makeOrganizationApiRequest<{
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

        if (!usersResponse.success || !usersResponse.data) {
          throw new Error('Failed to retrieve organization users');
        }

        // Find the target user
        const targetUser = usersResponse.data.data?.find(u =>
          u.account_id === accountId || u.email === email
        );

        if (!targetUser && (accountId || email)) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: {
                  code: 'USER_NOT_FOUND',
                  message: `User not found with ${accountId ? 'accountId: ' + accountId : 'email: ' + email}`,
                  suggestion: 'Use get_organization_users to find valid account IDs',
                },
              }, null, 2),
            }],
            isError: true,
          };
        }

        // Build activity analysis
        const productAccess = targetUser?.product_access || [];
        const requestedProducts = products.map((p: string) => p.toLowerCase());

        const productActivity = productAccess
          .filter(p => requestedProducts.some(rp => p.key?.toLowerCase().includes(rp) || p.name?.toLowerCase().includes(rp)))
          .map(p => ({
            productKey: p.key,
            productName: p.name,
            siteUrl: p.url,
            lastActive: p.last_active,
            hasAccess: true,
          }));

        // Add products without access
        requestedProducts.forEach((rp: string) => {
          if (!productActivity.some(pa => pa.productKey?.toLowerCase().includes(rp) || pa.productName?.toLowerCase().includes(rp))) {
            productActivity.push({
              productKey: rp,
              productName: rp.charAt(0).toUpperCase() + rp.slice(1),
              siteUrl: undefined,
              lastActive: undefined,
              hasAccess: false,
            });
          }
        });

        const analysis = {
          user: targetUser ? {
            accountId: targetUser.account_id,
            name: targetUser.name,
            email: targetUser.email,
            accountType: targetUser.account_type,
            accountStatus: targetUser.account_status,
            lastActive: targetUser.last_active,
          } : null,
          productActivity,
          summary: {
            totalProductsRequested: requestedProducts.length,
            productsWithAccess: productActivity.filter(p => p.hasAccess).length,
            productsWithRecentActivity: productActivity.filter(p => p.lastActive).length,
            analysisScope: targetUser ? 'single_user' : 'all_users',
          },
          dateRange: {
            startDate: startDate || 'not specified',
            endDate: endDate || 'not specified',
            note: 'Detailed date range filtering requires product-specific activity logs',
          },
        };

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              analysis,
              includeDetails,
              orgId,
            }, null, 2),
          }],
        };
      } catch (error: any) {
        logger.error('Failed to analyze cross-product user activity', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_CROSS_PRODUCT_ACTIVITY_ERROR',
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

  // Tool: get_enhanced_identity_provider_insights
  server.registerTool(
    'get_enhanced_identity_provider_insights',
    {
      title: 'Get Enhanced Identity Provider Insights',
      description: 'Advanced identity provider analysis with provisioning insights and performance metrics',
      inputSchema: {},
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
                  message: 'Organization ID is required for identity provider insights',
                  suggestion: 'Set ATLASSIAN_ORG_ID environment variable with your organization ID',
                },
              }, null, 2),
            }],
            isError: true,
          };
        }

        // Get directories (identity providers)
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
              userCount?: number;
              groupCount?: number;
            };
          }>;
        }>({
          method: 'GET',
          path: `/v1/orgs/${orgId}/directories`,
        });

        if (!directoriesResponse.success || !directoriesResponse.data) {
          throw new Error('Failed to retrieve identity providers');
        }

        const directories = directoriesResponse.data.data || [];

        // Get users for user count analysis
        const usersResponse = await apiClient.makeOrganizationApiRequest<{
          data: Array<{
            account_id: string;
            account_type: string;
            account_status: string;
          }>;
        }>({
          method: 'GET',
          path: `/v1/orgs/${orgId}/users`,
          params: { limit: 100 },
        });

        const users = usersResponse.success ? (usersResponse.data?.data || []) : [];

        // Build enhanced insights
        const identityProviderInsights = directories.map(dir => ({
          id: dir.id,
          name: dir.attributes?.name,
          type: dir.attributes?.directoryType,
          state: dir.attributes?.state,
          syncEnabled: dir.attributes?.syncEnabled,
          lastSyncTime: dir.attributes?.lastSyncTime,
          health: {
            status: dir.attributes?.state === 'active' && dir.attributes?.syncEnabled ? 'healthy' : 'needs_attention',
            syncAge: dir.attributes?.lastSyncTime ? getTimeSince(dir.attributes.lastSyncTime) : 'never synced',
          },
          metrics: {
            estimatedUserCount: dir.attributes?.userCount || 'unknown',
            estimatedGroupCount: dir.attributes?.groupCount || 'unknown',
          },
        }));

        const insights = {
          identityProviders: identityProviderInsights,
          summary: {
            totalProviders: directories.length,
            activeProviders: directories.filter(d => d.attributes?.state === 'active').length,
            syncEnabledProviders: directories.filter(d => d.attributes?.syncEnabled).length,
            providerTypes: [...new Set(directories.map(d => d.attributes?.directoryType))].filter(Boolean),
          },
          userAnalysis: {
            totalOrganizationUsers: users.length,
            activeUsers: users.filter(u => u.account_status === 'active').length,
            userTypes: {
              atlassian: users.filter(u => u.account_type === 'atlassian').length,
              customer: users.filter(u => u.account_type === 'customer').length,
              app: users.filter(u => u.account_type === 'app').length,
            },
          },
          recommendations: generateIdpRecommendations(directories, users),
        };

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              insights,
              orgId,
            }, null, 2),
          }],
        };
      } catch (error: any) {
        logger.error('Failed to get enhanced identity provider insights', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_ENHANCED_IDP_INSIGHTS_ERROR',
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

  // Tool: get_advanced_directory_health_monitoring
  server.registerTool(
    'get_advanced_directory_health_monitoring',
    {
      title: 'Get Advanced Directory Health Monitoring',
      description: 'Comprehensive directory health monitoring with predictive insights and trend analysis',
      inputSchema: {},
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
                  message: 'Organization ID is required for directory health monitoring',
                  suggestion: 'Set ATLASSIAN_ORG_ID environment variable with your organization ID',
                },
              }, null, 2),
            }],
            isError: true,
          };
        }

        // Get directories
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

        // Get recent organization events for directory-related activity
        const eventsResponse = await apiClient.makeOrganizationApiRequest<{
          data: Array<{
            id: string;
            type: string;
            attributes: {
              time: string;
              action: string;
              actor?: { id: string; name?: string };
            };
          }>;
        }>({
          method: 'GET',
          path: `/v1/orgs/${orgId}/events`,
          params: { limit: 50 },
        });

        const events = eventsResponse.success ? (eventsResponse.data?.data || []) : [];
        const directoryEvents = events.filter(e =>
          e.attributes?.action?.toLowerCase().includes('directory') ||
          e.attributes?.action?.toLowerCase().includes('sync') ||
          e.attributes?.action?.toLowerCase().includes('user')
        );

        // Build health monitoring data
        const directoryHealth = directories.map(dir => {
          const lastSyncDate = dir.attributes?.lastSyncTime ? new Date(dir.attributes.lastSyncTime) : null;
          const syncAgeHours = lastSyncDate ? (Date.now() - lastSyncDate.getTime()) / (1000 * 60 * 60) : null;

          return {
            id: dir.id,
            name: dir.attributes?.name,
            type: dir.attributes?.directoryType,
            health: {
              overall: calculateDirectoryHealth(dir.attributes),
              syncStatus: dir.attributes?.syncEnabled ? 'enabled' : 'disabled',
              state: dir.attributes?.state,
              lastSyncTime: dir.attributes?.lastSyncTime,
              syncAgeHours: syncAgeHours ? Math.round(syncAgeHours) : null,
            },
            alerts: generateDirectoryAlerts(dir.attributes, syncAgeHours),
          };
        });

        // Calculate overall health score
        const healthyDirectories = directoryHealth.filter(d => d.health.overall === 'healthy').length;
        const overallHealth = directories.length === 0 ? 'no_directories' :
          healthyDirectories === directories.length ? 'healthy' :
          healthyDirectories > 0 ? 'degraded' : 'unhealthy';

        const monitoring = {
          overallHealth,
          healthScore: directories.length > 0 ? Math.round((healthyDirectories / directories.length) * 100) : 0,
          directories: directoryHealth,
          recentActivity: {
            totalEvents: directoryEvents.length,
            eventSummary: directoryEvents.slice(0, 5).map(e => ({
              time: e.attributes?.time,
              action: e.attributes?.action,
            })),
          },
          predictiveInsights: {
            capacityStatus: 'normal',
            syncTrend: healthyDirectories === directories.length ? 'stable' : 'needs_attention',
            recommendations: generateMonitoringRecommendations(directoryHealth),
          },
        };

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              monitoring,
              orgId,
            }, null, 2),
          }],
        };
      } catch (error: any) {
        logger.error('Failed to get advanced directory health monitoring', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_ADVANCED_DIRECTORY_MONITORING_ERROR',
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

  // Tool: get_user_behavior_pattern_analysis
  server.registerTool(
    'get_user_behavior_pattern_analysis',
    {
      title: 'Get User Behavior Pattern Analysis',
      description: 'Analyze user behavior patterns across directory and product usage for security and optimization insights',
      inputSchema: {},
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
                  message: 'Organization ID is required for user behavior analysis',
                  suggestion: 'Set ATLASSIAN_ORG_ID environment variable with your organization ID',
                },
              }, null, 2),
            }],
            isError: true,
          };
        }

        // Get organization users
        const usersResponse = await apiClient.makeOrganizationApiRequest<{
          data: Array<{
            account_id: string;
            account_type: string;
            account_status: string;
            name: string;
            email: string;
            product_access?: Array<{
              key: string;
              name: string;
              last_active?: string;
            }>;
            last_active?: string;
          }>;
        }>({
          method: 'GET',
          path: `/v1/orgs/${orgId}/users`,
          params: { limit: 100 },
        });

        if (!usersResponse.success || !usersResponse.data) {
          throw new Error('Failed to retrieve users');
        }

        const users = usersResponse.data.data || [];

        // Analyze user behavior patterns
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const activeIn7Days = users.filter(u => u.last_active && new Date(u.last_active) > sevenDaysAgo);
        const activeIn30Days = users.filter(u => u.last_active && new Date(u.last_active) > thirtyDaysAgo);
        const neverActive = users.filter(u => !u.last_active);
        const inactive = users.filter(u => u.account_status !== 'active');

        // Product usage patterns
        const productUsage: Record<string, number> = {};
        users.forEach(u => {
          (u.product_access || []).forEach(p => {
            const key = p.key || p.name;
            productUsage[key] = (productUsage[key] || 0) + 1;
          });
        });

        // Multi-product usage analysis
        const multiProductUsers = users.filter(u => (u.product_access?.length || 0) > 1);
        const singleProductUsers = users.filter(u => (u.product_access?.length || 0) === 1);
        const noProductUsers = users.filter(u => (u.product_access?.length || 0) === 0);

        const behaviorAnalysis = {
          summary: {
            totalUsers: users.length,
            activeUsers: users.filter(u => u.account_status === 'active').length,
            inactiveUsers: inactive.length,
          },
          activityPatterns: {
            activeIn7Days: activeIn7Days.length,
            activeIn30Days: activeIn30Days.length,
            neverActive: neverActive.length,
            activityRate7Days: users.length > 0 ? Math.round((activeIn7Days.length / users.length) * 100) : 0,
            activityRate30Days: users.length > 0 ? Math.round((activeIn30Days.length / users.length) * 100) : 0,
          },
          productUsagePatterns: {
            productUsage,
            multiProductUsers: multiProductUsers.length,
            singleProductUsers: singleProductUsers.length,
            noProductAccess: noProductUsers.length,
            averageProductsPerUser: users.length > 0 ?
              Math.round(users.reduce((sum, u) => sum + (u.product_access?.length || 0), 0) / users.length * 10) / 10 : 0,
          },
          userTypeDistribution: {
            atlassian: users.filter(u => u.account_type === 'atlassian').length,
            customer: users.filter(u => u.account_type === 'customer').length,
            app: users.filter(u => u.account_type === 'app').length,
          },
          securityInsights: {
            inactiveAccounts: inactive.length,
            accountsNeverUsed: neverActive.length,
            potentialCleanupCandidates: users.filter(u =>
              !u.last_active || (u.last_active && new Date(u.last_active) < thirtyDaysAgo)
            ).length,
          },
          optimizationInsights: {
            unusedLicenses: noProductUsers.length,
            lowEngagementUsers: users.filter(u =>
              u.last_active && new Date(u.last_active) < thirtyDaysAgo &&
              new Date(u.last_active) > new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
            ).length,
            recommendations: generateBehaviorRecommendations(users, activeIn7Days, noProductUsers, inactive),
          },
        };

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              behaviorAnalysis,
              orgId,
            }, null, 2),
          }],
        };
      } catch (error: any) {
        logger.error('Failed to get user behavior pattern analysis', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_USER_BEHAVIOR_ANALYSIS_ERROR',
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

  // Tool registration completed (logging disabled for MCP compatibility)
}