import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { JiraApiClient } from '../api/client.js';
import { logger } from '../utils/logger.js';
import {
  getCustomerOrganizationsInputSchema,
  getOrganizationCustomersInputSchema,
  getCustomerOrganizationMembershipInputSchema,
  getProjectCustomerOrganizationsInputSchema,
  analyzeCustomerVisibilityInputSchema,
} from '../validation/input-schemas.js';

/**
 * Register Customer Organization Analysis Tools
 * Provides comprehensive READ-ONLY analysis of Jira Service Management customer organizations,
 * customer permissions, and visibility settings to help diagnose Azure AD sync issues.
 * 
 * These tools help diagnose customer visibility issues including:
 * - Customer organization structures
 * - Customer membership and visibility rules
 * - Project-specific customer permissions
 * - Customer sharing settings analysis
 */
export async function registerCustomerOrganizationTools(server: McpServer, apiClient: JiraApiClient) {
  
  // Tool: get_customer_organizations
  server.registerTool(
    'get_customer_organizations',
    {
      title: 'Get Customer Organizations',
      description: '🔍 DISCOVERY TOOL: Primary discovery method for customer organization operations. Use this first to find available customer organization IDs before using other customer organization management tools. Returns comprehensive list with IDs, names, and key properties needed for subsequent operations.',
      inputSchema: getCustomerOrganizationsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params: any) => {
      try {
        const { limit = 50, start = 0 } = params;

        // Get organizations using Jira Service Management API
        const response = await apiClient.makeServiceDeskRequest<any>({
          method: 'GET',
          path: '/organization',
          params: {
            limit,
            start,
          },
        });

        if (response.success && response.data) {
          const organizations = response.data.values || [];

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                organizations,
                pagination: {
                  start,
                  limit,
                  size: response.data.size || 0,
                  isLast: response.data.isLast || false,
                },
                totalOrganizations: response.data.size || 0,
                analysis: {
                  note: 'Customer organizations are containers for grouping customers in JSM',
                  visibilityImpact: 'Customer sharing permissions determine if customers can see each other within organizations',
                  azureAdRelevance: 'Azure AD synced users should be properly assigned to organizations for visibility',
                },
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to retrieve customer organizations');
      } catch (error: any) {
        logger.error('Failed to get customer organizations', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_CUSTOMER_ORGANIZATIONS_ERROR',
                message: error.message,
                details: error.details,
                suggestion: error.suggestion || 'Ensure you have service desk permissions to view organizations',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: get_organization_customers
  server.registerTool(
    'get_organization_customers',
    {
      title: 'Get Organization Customers',
      description: '⚠️ PREREQUISITE: Use "get_customer_organizations" first to find valid organization IDs. Lists all customers in a specific organization. If you get "Organization not found" errors, the organization likely doesn\'t exist - use the discovery tool to find valid IDs first.',
      inputSchema: getOrganizationCustomersInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params: any) => {
      try {
        const { organizationId, limit = 50, start = 0 } = params;

        // Get customers in organization using Jira Service Management API
        const response = await apiClient.makeServiceDeskRequest<any>({
          method: 'GET',
          path: `/organization/${organizationId}/user`,
          params: {
            limit,
            start,
          },
        });

        if (response.success && response.data) {
          const customers = response.data.values || [];

          // Analyze customer types and potential Azure AD sync status
          const customerAnalysis = customers.map((customer: any) => ({
            ...customer,
            analysis: {
              accountType: customer.accountType || 'unknown',
              isAzureADSynced: customer.email?.includes('@') && !customer.email?.endsWith('.atlassian.net'),
              hasExternalDomain: customer.email && !customer.email.endsWith('.atlassian.net'),
              lastActive: customer.lastActive,
            },
          }));

          const azureADSyncedCount = customerAnalysis.filter((c: any) => c.analysis.isAzureADSynced).length;
          const externalDomainCount = customerAnalysis.filter((c: any) => c.analysis.hasExternalDomain).length;

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                customers: customerAnalysis,
                organizationId,
                pagination: {
                  start,
                  limit,
                  size: response.data.size || 0,
                  isLast: response.data.isLast || false,
                },
                analysis: {
                  totalCustomers: customerAnalysis.length,
                  azureADSyncedCustomers: azureADSyncedCount,
                  externalDomainCustomers: externalDomainCount,
                  internalCustomers: customerAnalysis.length - externalDomainCount,
                  visibilityNote: 'Customers in this organization should be able to see each other based on project customer sharing settings',
                  troubleshooting: {
                    ifCustomersCantSeeEachOther: 'Check project customer permissions and sharing settings',
                    azureAdIssues: 'Verify Azure AD sync is working and customers are properly provisioned',
                  },
                },
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to retrieve organization customers');
      } catch (error: any) {
        logger.error('Failed to get organization customers', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_ORGANIZATION_CUSTOMERS_ERROR',
                message: error.message,
                details: error.details,
                suggestion: error.suggestion || 'Ensure organization ID is valid and you have permissions',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: get_customer_organization_membership
  server.registerTool(
    'get_customer_organization_membership',
    {
      title: 'Get Customer Organization Membership',
      description: '🔍 DISCOVERY TOOL: Checks which organizations a specific customer belongs to. Use this to understand customer organization membership before making visibility or access changes.',
      inputSchema: getCustomerOrganizationMembershipInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params: any) => {
      try {
        const { accountId, email } = params;

        if (!accountId && !email) {
          throw new Error('Either accountId or email must be provided');
        }

        // First get all organizations
        const orgsResponse = await apiClient.makeServiceDeskRequest<any>({
          method: 'GET',
          path: '/organization',
          params: { limit: 1000 },
        });

        if (!orgsResponse.success || !orgsResponse.data) {
          throw new Error('Failed to retrieve organizations');
        }

        const organizations = orgsResponse.data.values || [];
        const memberships = [];

        // Check each organization for customer membership
        for (const org of organizations) {
          try {
            const usersResponse = await apiClient.makeServiceDeskRequest<any>({
              method: 'GET',
              path: `/organization/${org.id}/user`,
              params: { limit: 1000 },
            });

            if (usersResponse.success && usersResponse.data) {
              const users = usersResponse.data.values || [];
              const isMember = users.some((user: any) => {
                if (accountId) return user.accountId === accountId;
                if (email) return user.emailAddress === email || user.email === email;
                return false;
              });

              if (isMember) {
                const memberUser = users.find((user: any) => {
                  if (accountId) return user.accountId === accountId;
                  if (email) return user.emailAddress === email || user.email === email;
                  return false;
                });

                memberships.push({
                  organization: org,
                  memberDetails: memberUser,
                  joinedDate: memberUser?.created,
                });
              }
            }
          } catch (orgError) {
            // Skip organizations we can't access
            logger.warn(`Could not check membership in organization ${org.id}`, { orgError });
          }
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              customer: { accountId, email },
              memberships,
              analysis: {
                totalMemberships: memberships.length,
                organizationCount: organizations.length,
                membershipPercentage: Math.round((memberships.length / organizations.length) * 100),
                visibilityImplication: memberships.length === 0 
                  ? 'Customer not in any organization - cannot see other customers with default settings'
                  : `Customer can potentially see other customers in ${memberships.length} organization(s)`,
                troubleshooting: {
                  noMemberships: 'If customer cannot see others, they may not be assigned to any organization',
                  azureAdSync: 'Check if Azure AD sync is properly assigning customers to organizations',
                  recommendation: 'Customers should be in at least one organization for proper visibility',
                },
              },
            }, null, 2),
          }],
        };
      } catch (error: any) {
        logger.error('Failed to get customer organization membership', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_CUSTOMER_MEMBERSHIP_ERROR',
                message: error.message,
                details: error.details,
                suggestion: error.suggestion || 'Ensure customer identifier is valid and you have permissions',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: get_project_customer_organizations
  server.registerTool(
    'get_project_customer_organizations',
    {
      title: 'Get Project Customer Organizations',
      description: '🔍 DISCOVERY TOOL: Lists organizations associated with a specific service project. Use this to understand project-level customer organization associations.',
      inputSchema: getProjectCustomerOrganizationsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params: any) => {
      try {
        const { projectKey, serviceDeskId } = params;

        if (!projectKey && !serviceDeskId) {
          throw new Error('Either projectKey or serviceDeskId must be provided');
        }

        let deskId = serviceDeskId;

        // If projectKey provided, get the service desk ID first
        if (projectKey && !serviceDeskId) {
          const desksResponse = await apiClient.makeServiceDeskRequest<any>({
            method: 'GET',
            path: '/servicedesk',
          });

          if (desksResponse.success && desksResponse.data) {
            const desk = desksResponse.data.values?.find((d: any) => d.projectKey === projectKey);
            if (!desk) {
              throw new Error(`Service desk not found for project ${projectKey}`);
            }
            deskId = desk.id;
          } else {
            throw new Error('Failed to retrieve service desks');
          }
        }

        // Get organizations for the service desk
        const response = await apiClient.makeServiceDeskRequest<any>({
          method: 'GET',
          path: `/servicedesk/${deskId}/organization`,
        });

        if (response.success && response.data) {
          const organizations = response.data.values || [];

          // Get customer count for each organization
          const organizationsWithDetails = await Promise.all(
            organizations.map(async (org: any) => {
              try {
                const customersResponse = await apiClient.makeServiceDeskRequest<any>({
                  method: 'GET',
                  path: `/organization/${org.id}/user`,
                  params: { limit: 1 }, // Just to get count
                });

                return {
                  ...org,
                  customerCount: customersResponse.data?.size || 0,
                };
              } catch {
                return {
                  ...org,
                  customerCount: 'unknown',
                };
              }
            })
          );

          const totalCustomers = organizationsWithDetails
            .filter(org => typeof org.customerCount === 'number')
            .reduce((sum, org) => sum + org.customerCount, 0);

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                organizations: organizationsWithDetails,
                project: { projectKey, serviceDeskId: deskId },
                analysis: {
                  totalOrganizations: organizationsWithDetails.length,
                  totalCustomers,
                  averageCustomersPerOrg: organizationsWithDetails.length > 0
                    ? Math.round(totalCustomers / organizationsWithDetails.length)
                    : 0,
                  visibilityImplication: 'Customer visibility depends on project customer sharing settings',
                  troubleshooting: {
                    customerVisibility: 'Check Project Settings > Access > Customer permissions > Customer sharing',
                    azureAdCustomers: 'Verify Azure AD synced customers are assigned to appropriate organizations',
                    emptyOrganizations: 'Organizations with 0 customers may indicate sync or assignment issues',
                  },
                },
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to retrieve project organizations');
      } catch (error: any) {
        logger.error('Failed to get project customer organizations', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_PROJECT_ORGANIZATIONS_ERROR',
                message: error.message,
                details: error.details,
                suggestion: error.suggestion || 'Ensure project exists and you have service desk permissions',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: analyze_customer_visibility
  server.registerTool(
    'analyze_customer_visibility',
    {
      title: 'Analyze Customer Visibility',
      description: '🔍 DISCOVERY TOOL: Comprehensive analysis of why customers can or cannot see each other in user pickers. Use this to diagnose customer visibility issues and Azure AD sync problems.',
      inputSchema: analyzeCustomerVisibilityInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params: any) => {
      try {
        const { projectKey, customerAccountId } = params;

        // This is a comprehensive analysis tool that would check multiple factors
        const analysis = {
          projectKey,
          customerAccountId,
          timestamp: new Date().toISOString(),
          factors: {
            customerSharingSettings: {
              status: 'requires_manual_check',
              description: 'Check Project Settings > Access > Customer permissions > Customer sharing',
              possibleValues: [
                'Customers can search for other customers within their organizations',
                'Customers can search for other customers within their organizations, or manually enter the email address of other customers within their project',
                'Customers can search for other customers within their project or organizations',
              ],
              recommendation: 'Set to "within their project or organizations" for maximum visibility',
            },
            organizationMembership: {
              status: 'analysis_needed',
              description: 'Customer organization membership affects visibility',
              note: 'Use get_customer_organization_membership tool to check specific customer memberships',
            },
            globalPermissions: {
              status: 'analysis_needed',
              description: 'Browse users and groups permission may affect user picker visibility',
              note: 'Check Settings > System > Global permissions',
            },
            userPickerFiltering: {
              status: 'analysis_needed',
              description: 'Custom field user filtering may restrict visible users',
              note: 'Check Settings > Issues > Custom fields > User Picker fields > Edit User Filtering',
            },
            accountTypes: {
              status: 'analysis_needed',
              description: 'Customer account types (internal vs external) may affect visibility',
              azureAdNote: 'Azure AD synced users should have proper account types assigned',
            },
          },
          commonIssues: {
            azureAdSyncProblems: [
              'Users synced as wrong account type (licensed instead of customer)',
              'Users not assigned to any customer organizations',
              'Organization email domain mapping issues',
              'Sync timing issues - users not fully provisioned',
            ],
            permissionProblems: [
              'Customer sharing set to "within organizations only" but customers not in organizations',
              'User picker fields have restrictive filtering applied',
              'Missing "Browse users and groups" permission for customer accounts',
            ],
            configurationIssues: [
              'Project has restrictive customer access settings',
              'Custom fields configured incorrectly',
              'Organizations not properly associated with the project',
            ],
          },
          diagnosticSteps: [
            'Check customer sharing settings in project permissions',
            'Verify customer organization memberships',
            'Test user picker fields with different customer accounts', 
            'Check Azure AD sync status and user provisioning',
            'Verify customer account types are correct',
            'Check for user picker field filtering restrictions',
          ],
          nextSteps: [
            'Use get_customer_organization_membership to check specific customer memberships',
            'Use get_project_customer_organizations to see project organization structure',
            'Check project customer permissions manually in Jira Service Management UI',
            'Test visibility with known Azure AD synced customer accounts',
          ],
        };

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              analysis,
              warning: 'This is a diagnostic analysis. Actual customer sharing settings must be checked manually in JSM project settings.',
            }, null, 2),
          }],
        };
      } catch (error: any) {
        logger.error('Failed to analyze customer visibility', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'ANALYZE_CUSTOMER_VISIBILITY_ERROR',
                message: error.message,
                details: error.details,
                suggestion: 'This analysis tool provides diagnostic guidance - check actual settings manually',
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