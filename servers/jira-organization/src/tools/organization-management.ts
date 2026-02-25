import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { JiraApiClient } from '../api/client.js';
import { logger } from '../utils/logger.js';
import {
  AtlassianOrganizationsResponse,
  OrganizationDetails,
} from '../types/index.js';
import {
  getOrganizationsInputSchema,
  getOrganizationDetailsInputSchema,
} from '../validation/input-schemas.js';

/**
 * Register Organization Management Tools (Atlassian Organization API)
 * Provides comprehensive READ-ONLY access to Atlassian organization information
 * for enterprise administrators managing multi-organizational environments.
 * 
 * These tools help analyze:
 * - Organization structure and configuration
 * - Billing and subscription details
 * - Domain verification and policies
 * - Cross-organizational user and product statistics
 * 
 * Required scope: read:organizations:admin
 */
export async function registerOrganizationManagementTools(server: McpServer, apiClient: JiraApiClient) {
  
  // Tool: get_organizations
  server.registerTool(
    'get_organizations',
    {
      title: 'Get Organizations List',
      description: 'Retrieve list of Atlassian organizations with filtering and pagination support for multi-org management',
      inputSchema: getOrganizationsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params: any) => {
      try {
        // Build query parameters for Organization API
        const queryParams: Record<string, any> = {};

        if (params.limit) queryParams.limit = params.limit;
        if (params.page) queryParams.page = params.page;
        if (params.status) queryParams.status = params.status;
        if (params.type) queryParams.type = params.type;

        // Make request to Organization API
        const response = await apiClient.makeOrganizationApiRequest<AtlassianOrganizationsResponse>({
          method: 'GET',
          path: '/v1/orgs',
          params: queryParams,
        });

        if (response.success && response.data) {
          // Safely extract data with defensive null checks for varying API response formats
          const responseData = response.data as any;

          // Handle different response shapes: { data: [...] } or direct array
          let organizations: any[] = [];
          if (Array.isArray(responseData)) {
            organizations = responseData;
          } else if (Array.isArray(responseData?.data)) {
            organizations = responseData.data;
          }

          // Extract pagination info with safe defaults
          const meta = (responseData && typeof responseData === 'object' && responseData.meta) ? responseData.meta : {};
          const links = (responseData && typeof responseData === 'object' && responseData.links) ? responseData.links : {};

          const totalResults = (meta && typeof meta.total === 'number') ? meta.total : organizations.length;
          const currentPage = (meta && typeof meta.page === 'number') ? meta.page : 1;
          const pageSize = (meta && typeof meta.pageSize === 'number') ? meta.pageSize : organizations.length;

          // Transform organizations data
          const transformedOrgs = organizations.filter(org => org != null).map(org => ({
            id: org?.id,
            name: org?.name,
            slug: org?.slug,
            type: org?.type,
            status: org?.status,
            createdAt: org?.createdAt,
            updatedAt: org?.updatedAt,
            billing: org?.billing ? {
              planType: org.billing?.planType,
              planName: org.billing?.planName,
              billingCycle: org.billing?.billingCycle,
              nextBillingDate: org.billing?.nextBillingDate,
              seats: org.billing?.seats,
            } : undefined,
            domainCount: org?.domains?.length || 0,
            verifiedDomains: org?.domains?.filter((d: any) => d?.verified)?.length || 0,
            policyCount: org?.policies?.length || 0,
            enabledPolicies: org?.policies?.filter((p: any) => p?.enabled)?.length || 0,
            features: org?.features || [],
            links: org?._links,
          }));

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                organizations: transformedOrgs,
                totalResults,
                currentPage,
                pageSize,
                resultCount: transformedOrgs.length,
                queryParameters: queryParams,
                executionTime: response.metadata?.executionTime,
                pagination: {
                  hasNext: !!(links && links.next),
                  hasPrev: !!(links && links.prev),
                  nextPageUrl: links?.next || null,
                  prevPageUrl: links?.prev || null,
                },
                organizationSummary: {
                  totalOrganizations: totalResults,
                  activeOrganizations: organizations.filter(org => org?.status === 'active').length,
                  enterpriseOrganizations: organizations.filter(org => org?.type === 'enterprise').length,
                  standardOrganizations: organizations.filter(org => org?.type === 'standard').length,
                },
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to retrieve organizations from Atlassian Organization API');
      } catch (error: any) {
        logger.error('Failed to get organizations list', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_ORGANIZATIONS_ERROR',
                message: error.message,
                details: error.details,
                suggestion: error.suggestion || 'Ensure you have organization admin token with read:organizations:admin scope',
                _source: 'ATLASSIAN_MCP_JAN12_V1',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: get_organization_details
  server.registerTool(
    'get_organization_details',
    {
      title: 'Get Organization Details',
      description: 'Retrieve comprehensive details for a specific organization including statistics, audit, and compliance information',
      inputSchema: getOrganizationDetailsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params: any) => {
      try {
        const orgId = params.orgId;
        
        // Build query parameters for detailed organization information
        const queryParams: Record<string, any> = {};
        
        if (params.includeStatistics) queryParams.include_statistics = params.includeStatistics;
        if (params.includeAudit) queryParams.include_audit = params.includeAudit;
        if (params.includeCompliance) queryParams.include_compliance = params.includeCompliance;

        // Make request to Organization API for specific organization
        const response = await apiClient.makeOrganizationApiRequest<OrganizationDetails>({
          method: 'GET',
          path: `/v1/orgs/${orgId}`,
          params: queryParams,
        });

        if (response.success && response.data) {
          const org = response.data;
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                organizationDetails: {
                  basicInfo: {
                    id: org.id,
                    name: org.name,
                    slug: org.slug,
                    type: org.type,
                    status: org.status,
                    createdAt: org.createdAt,
                    updatedAt: org.updatedAt,
                    links: org._links,
                  },
                  billing: org.billing ? {
                    planType: org.billing.planType,
                    planName: org.billing.planName,
                    billingCycle: org.billing.billingCycle,
                    nextBillingDate: org.billing.nextBillingDate,
                    seats: org.billing.seats ? {
                      total: org.billing.seats.total,
                      used: org.billing.seats.used,
                      available: org.billing.seats.available,
                      utilizationRate: org.billing.seats.total > 0 
                        ? Math.round((org.billing.seats.used / org.billing.seats.total) * 100) 
                        : 0,
                    } : undefined,
                  } : undefined,
                  domains: {
                    totalDomains: org.domains?.length || 0,
                    verifiedDomains: org.domains?.filter(d => d.verified).length || 0,
                    pendingDomains: org.domains?.filter(d => d.status === 'pending').length || 0,
                    primaryDomain: org.domains?.find(d => d.type === 'primary')?.domain,
                    domains: org.domains?.map(domain => ({
                      id: domain.id,
                      domain: domain.domain,
                      verified: domain.verified,
                      verifiedAt: domain.verifiedAt,
                      status: domain.status,
                      type: domain.type,
                    })) || [],
                  },
                  policies: {
                    totalPolicies: org.policies?.length || 0,
                    enabledPolicies: org.policies?.filter(p => p.enabled).length || 0,
                    policyTypes: org.policies?.reduce((types: Record<string, number>, policy) => {
                      // Safe property access using Object.entries() and find()
                      if (policy.type && typeof policy.type === 'string') {
                        const currentCount = Object.entries(types).find(([key]) => key === policy.type)?.[1] || 0;
                        const typeEntries = Object.entries(types).filter(([key]) => key !== policy.type);
                        types = Object.fromEntries([...typeEntries, [policy.type, currentCount + 1]]);
                      }
                      return types;
                    }, {}) || {},
                    policies: org.policies?.map(policy => ({
                      id: policy.id,
                      name: policy.name,
                      type: policy.type,
                      enabled: policy.enabled,
                      lastModified: policy.lastModified,
                      modifiedBy: policy.modifiedBy,
                    })) || [],
                  },
                  features: org.features || [],
                  statistics: org.statistics ? {
                    users: {
                      total: org.statistics.totalUsers,
                      active: org.statistics.activeUsers,
                      activePercentage: org.statistics.totalUsers > 0 
                        ? Math.round((org.statistics.activeUsers / org.statistics.totalUsers) * 100) 
                        : 0,
                    },
                    products: {
                      jira: org.statistics.products.jira,
                      confluence: org.statistics.products.confluence,
                      bitbucket: org.statistics.products.bitbucket,
                      totalSites: Object.values(org.statistics.products).reduce((sum: number, product: any) => 
                        sum + (product.sites || product.workspaces || 0), 0),
                    },
                  } : undefined,
                  audit: org.audit ? {
                    lastActivity: org.audit.lastActivity,
                    eventTypes: org.audit.eventTypes,
                    retentionDays: org.audit.retentionDays,
                    auditingEnabled: org.audit.eventTypes.length > 0,
                  } : undefined,
                  compliance: org.compliance ? {
                    gdprCompliant: org.compliance.gdprCompliant,
                    soc2Certified: org.compliance.soc2Certified,
                    iso27001Certified: org.compliance.iso27001Certified,
                    dataResidency: org.compliance.dataResidency,
                    complianceScore: [
                      org.compliance.gdprCompliant,
                      org.compliance.soc2Certified,
                      org.compliance.iso27001Certified,
                    ].filter(Boolean).length,
                  } : undefined,
                  queryParameters: queryParams,
                  executionTime: response.metadata?.executionTime,
                },
                healthInsights: {
                  overallHealth: org.status === 'active' ? 'healthy' : 'warning',
                  domainHealth: org.domains && org.domains.length > 0 && org.domains.some(d => d.verified) ? 'healthy' : 'warning',
                  billingHealth: org.billing && org.billing.seats && org.billing.seats.available > 0 ? 'healthy' : 'warning',
                  securityPosture: org.policies && org.policies.some(p => p.enabled) ? 'configured' : 'needs_attention',
                  complianceStatus: org.compliance && (
                    org.compliance.gdprCompliant || 
                    org.compliance.soc2Certified || 
                    org.compliance.iso27001Certified
                  ) ? 'compliant' : 'unknown',
                },
                apiInfo: {
                  endpoint: `/admin/v1/orgs/${orgId}`,
                  requiredScope: 'read:organizations:admin',
                  note: 'Organization details provide comprehensive insights into organizational health and configuration',
                },
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to retrieve organization details from Atlassian Organization API');
      } catch (error: any) {
        logger.error('Failed to get organization details', { error: error.message, orgId: params.orgId });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_ORGANIZATION_DETAILS_ERROR',
                message: error.message,
                details: {
                  ...error.details,
                  orgId: params.orgId,
                },
                suggestion: error.suggestion || 'Ensure you have organization admin token with read:organizations:admin scope',
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