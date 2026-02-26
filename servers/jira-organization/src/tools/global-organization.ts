import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { JiraApiClient } from '../api/client.js';
import { logger } from '../utils/logger.js';
import {
  getOrganizationInfoInputSchema,
  getOrganizationPoliciesInputSchema,
  getOrganizationDomainsInputSchema,
  getOrganizationWorkspacesInputSchema,
  getOrganizationEventsInputSchema,
} from '../validation/input-schemas.js';
import {
  getOrganizationEventsSchema,
} from '../validation/schemas.js';

/**
 * Register Global Organization Analysis Tools
 * Provides comprehensive READ-ONLY analysis of Atlassian organization settings,
 * policies, domains, workspaces, and events for global administrators.
 *
 * These tools help diagnose organizational issues including:
 * - Organization configuration and policies
 * - Domain verification status
 * - Product workspace overview
 * - Audit events and activities
 */
export async function registerGlobalOrganizationTools(server: McpServer, apiClient: JiraApiClient) {

  // Tool: get_organization_info
  server.registerTool(
    'get_organization_info',
    {
      title: 'Get Organization Information',
      description: 'Retrieve comprehensive organization details, settings, and configuration',
      inputSchema: getOrganizationInfoInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async () => {
      try {
        const orgId = apiClient.getOrgId();

        // If we have org ID, get full organization info from Organization API
        if (orgId) {
          const orgResponse = await apiClient.makeOrganizationApiRequest<{
            id: string;
            type: string;
            attributes: {
              name: string;
              slug?: string;
              createdDate?: string;
              updatedDate?: string;
            };
          }>({
            method: 'GET',
            path: `/v1/orgs/${orgId}`,
          });

          if (orgResponse.success && orgResponse.data) {
            // Also get Jira instance info for additional context
            const jiraResponse = await apiClient.makeRequest<any>({
              method: 'GET',
              path: '/serverInfo',
            });

            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  organization: {
                    id: orgResponse.data.id,
                    type: orgResponse.data.type,
                    name: orgResponse.data.attributes?.name,
                    slug: orgResponse.data.attributes?.slug,
                    createdDate: orgResponse.data.attributes?.createdDate,
                    updatedDate: orgResponse.data.attributes?.updatedDate,
                  },
                  jiraInstance: jiraResponse.success ? {
                    baseUrl: jiraResponse.data?.baseUrl,
                    version: jiraResponse.data?.version,
                    buildNumber: jiraResponse.data?.buildNumber,
                    serverTitle: jiraResponse.data?.serverTitle,
                    deployment: 'cloud',
                  } : null,
                  orgId,
                }, null, 2),
              }],
            };
          }
        }

        // Fallback to Jira server info if no org access
        const response = await apiClient.makeRequest<any>({
          method: 'GET',
          path: '/serverInfo',
        });

        if (response.success && response.data) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                organizationInfo: {
                  baseUrl: response.data.baseUrl,
                  version: response.data.version,
                  buildNumber: response.data.buildNumber,
                  buildDate: response.data.buildDate,
                  scmInfo: response.data.scmInfo,
                  serverTitle: response.data.serverTitle,
                  deployment: 'cloud',
                },
                note: orgId
                  ? 'Organization API call failed - showing Jira instance info only'
                  : 'Set ATLASSIAN_ORG_ID for full organization details',
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to retrieve organization information');
      } catch (error: any) {
        logger.error('Failed to get organization info', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_ORGANIZATION_INFO_ERROR',
                message: error.message,
                details: error.details,
                suggestion: error.suggestion || 'Ensure you have organization admin permissions',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: get_organization_policies
  server.registerTool(
    'get_organization_policies',
    {
      title: 'Get Organization Policies',
      description: 'List all security and access policies configured at organization level',
      inputSchema: getOrganizationPoliciesInputSchema,
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
                  message: 'Organization ID is required for policy operations',
                  suggestion: 'Set ATLASSIAN_ORG_ID environment variable with your organization ID',
                },
              }, null, 2),
            }],
            isError: true,
          };
        }

        const response = await apiClient.makeOrganizationApiRequest<{
          data: Array<{
            id: string;
            type: string;
            attributes: {
              name: string;
              type: string;
              status: string;
              resources?: Array<{ id: string; meta?: any }>;
              createdAt?: string;
              updatedAt?: string;
            };
          }>;
        }>({
          method: 'GET',
          path: `/v1/orgs/${orgId}/policies`,
        });

        if (response.success && response.data) {
          const policies = response.data.data?.map(p => ({
            id: p.id,
            name: p.attributes?.name,
            type: p.attributes?.type,
            status: p.attributes?.status,
            resourceCount: p.attributes?.resources?.length || 0,
            createdAt: p.attributes?.createdAt,
            updatedAt: p.attributes?.updatedAt,
          })) || [];

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                policies,
                count: policies.length,
                orgId,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to retrieve organization policies');
      } catch (error: any) {
        logger.error('Failed to get organization policies', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_ORG_POLICIES_ERROR',
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

  // Tool: get_organization_domains
  server.registerTool(
    'get_organization_domains',
    {
      title: 'Get Organization Domains',
      description: 'List all verified domains and their verification status',
      inputSchema: getOrganizationDomainsInputSchema,
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
                  message: 'Organization ID is required for domain operations',
                  suggestion: 'Set ATLASSIAN_ORG_ID environment variable with your organization ID',
                },
              }, null, 2),
            }],
            isError: true,
          };
        }

        const response = await apiClient.makeOrganizationApiRequest<{
          data: Array<{
            id: string;
            type: string;
            attributes: {
              name: string;
              claim?: {
                type: string;
                status: string;
              };
            };
          }>;
        }>({
          method: 'GET',
          path: `/v1/orgs/${orgId}/domains`,
        });

        if (response.success && response.data) {
          const domains = response.data.data?.map(d => ({
            id: d.id,
            name: d.attributes?.name,
            claimType: d.attributes?.claim?.type,
            claimStatus: d.attributes?.claim?.status,
          })) || [];

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                domains,
                count: domains.length,
                orgId,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to retrieve organization domains');
      } catch (error: any) {
        logger.error('Failed to get organization domains', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_ORG_DOMAINS_ERROR',
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

  // Tool: get_organization_workspaces
  server.registerTool(
    'get_organization_workspaces',
    {
      title: 'Get Organization Workspaces',
      description: 'List all product workspaces (Jira, Confluence, etc.) in the organization',
      inputSchema: getOrganizationWorkspacesInputSchema,
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
                  message: 'Organization ID is required for workspace operations',
                  suggestion: 'Set ATLASSIAN_ORG_ID environment variable with your organization ID',
                },
              }, null, 2),
            }],
            isError: true,
          };
        }

        // Get managed users which includes product information
        const response = await apiClient.makeOrganizationApiRequest<{
          data: Array<{
            id: string;
            type: string;
            attributes: {
              cloudId: string;
              url: string;
              name: string;
              avatarUrl?: string;
              products?: Array<{
                key: string;
                name: string;
              }>;
            };
          }>;
        }>({
          method: 'GET',
          path: `/v1/orgs/${orgId}/sites`,
        });

        if (response.success && response.data) {
          const sites = response.data.data?.map(s => ({
            id: s.id,
            cloudId: s.attributes?.cloudId,
            name: s.attributes?.name,
            url: s.attributes?.url,
            products: s.attributes?.products,
          })) || [];

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                sites,
                count: sites.length,
                orgId,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to retrieve organization workspaces');
      } catch (error: any) {
        logger.error('Failed to get organization workspaces', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_ORG_WORKSPACES_ERROR',
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

  // Tool: get_organization_events
  server.registerTool(
    'get_organization_events',
    {
      title: 'Get Organization Events',
      description: 'Retrieve organization audit events and administrative activities',
      inputSchema: getOrganizationEventsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = getOrganizationEventsSchema.parse(params);
        const orgId = apiClient.getOrgId();
        if (!orgId) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: {
                  code: 'MISSING_ORG_ID',
                  message: 'Organization ID is required for event operations',
                  suggestion: 'Set ATLASSIAN_ORG_ID environment variable with your organization ID',
                },
              }, null, 2),
            }],
            isError: true,
          };
        }

        const { limit = 50, from, to } = validatedParams;

        const queryParams: Record<string, any> = { limit };
        if (from) queryParams.from = from;
        if (to) queryParams.to = to;

        const response = await apiClient.makeOrganizationApiRequest<{
          data: Array<{
            id: string;
            type: string;
            attributes: {
              time: string;
              action: string;
              actor?: {
                id: string;
                name?: string;
                email?: string;
              };
              context?: Array<{
                name: string;
                id?: string;
              }>;
              container?: {
                id: string;
                type?: string;
              };
            };
          }>;
          links?: {
            next?: string;
            self?: string;
          };
        }>({
          method: 'GET',
          path: `/v1/orgs/${orgId}/events`,
          params: queryParams,
        });

        if (response.success && response.data) {
          const events = response.data.data?.map(e => ({
            id: e.id,
            time: e.attributes?.time,
            action: e.attributes?.action,
            actor: e.attributes?.actor,
            context: e.attributes?.context,
            container: e.attributes?.container,
          })) || [];

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                events,
                count: events.length,
                pagination: {
                  limit,
                  hasMore: Boolean(response.data.links?.next),
                },
                filters: { from, to },
                orgId,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to retrieve organization events');
      } catch (error: any) {
        logger.error('Failed to get organization events', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_ORG_EVENTS_ERROR',
                message: error.message,
                details: error.details,
                suggestion: error.suggestion || 'Ensure you have Organization Admin API access with read:audit-log:organization scope',
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
