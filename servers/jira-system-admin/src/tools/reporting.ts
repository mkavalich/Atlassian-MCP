import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { JiraApiClient } from '../api/client.js';
import {
  exportProjectDataSchema,
  exportUserDataSchema,
  generateSystemReportSchema,
  generateUsageAnalyticsSchema,
  generateHealthCheckReportSchema,
} from '../validation/schemas.js';
import {
  exportProjectDataInputSchema,
  exportUserDataInputSchema,
  generateSystemReportInputSchema,
  generateUsageAnalyticsInputSchema,
  generateHealthCheckReportInputSchema,
} from '../validation/input-schemas.js';
import { logger } from '../utils/logger.js';
import { sanitizeErrorMessage } from '../utils/errors.js';


// Escapes a value interpolated inside a double-quoted JQL string literal so
// injection characters (" and \) cannot break out of the quotes.
const jqlSafe = (v: string) => String(v).replace(/["\\]/g, '\\$&');

export async function registerReportingTools(server: McpServer, apiClient: JiraApiClient) {
  // Tool: exportProjectData
  server.registerTool(
    'export_project_data',
    {
      title: 'Export Project Data',
      description: '⚠️ PREREQUISITE: Use project discovery tools first to find valid project keys. Export comprehensive project data including issues, configurations, and metadata. If you get "Project not found" errors, the project likely doesn\'t exist - use project discovery tools to find valid keys first.',
      inputSchema: exportProjectDataInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = exportProjectDataSchema.parse(params);

        // Get project data
        // Query values belong in `params` (forwarded to axios), never in `path`.
        // sanitizePath percent-encodes any path segment containing '?', so an inline
        // query string became part of the path and the request 404'd.
        // `params` must be a PLAIN OBJECT: the shared cache key is built from
        // Object.keys(params), which is empty for a URLSearchParams, so using one would
        // collapse every distinct query onto a single cache entry.
        const projectResponse = await apiClient.makeRequest<any>({
          method: 'GET',
          path: `/project/${encodeURIComponent(validatedParams.projectKey)}`,
          params: {
            expand: 'description,lead,url,projectKeys,permissions,issueTypes,issueTypeHierarchy',
          },
        });

        if (!projectResponse.success) {
          throw new Error('Failed to retrieve project data');
        }

        const exportData: any = {
          project: projectResponse.data,
          exportedAt: new Date().toISOString(),
          includeFields: {
            issues: validatedParams.includeIssues,
            workflows: validatedParams.includeWorkflows,
            permissions: validatedParams.includePermissions,
            customFields: validatedParams.includeCustomFields,
          },
        };

        // Include issues if requested
        if (validatedParams.includeIssues) {
          // Use new /search/jql endpoint (old /search deprecated Aug 2025)
          const issuesResponse = await apiClient.makeRequest<any>({
            method: 'POST',
            path: '/search/jql',
            data: {
              jql: `project = "${jqlSafe(validatedParams.projectKey)}"`,
              maxResults: validatedParams.maxIssues || 1000,
              expand: 'changelog,comments,attachments,worklog',
            },
          });

          if (issuesResponse.success) {
            exportData.issues = issuesResponse.data.issues;
            exportData.totalIssues = issuesResponse.data.total;
          }
        }

        // Include workflows if requested
        if (validatedParams.includeWorkflows) {
          // Get workflow scheme associated with this project
          // The project data may contain workflowScheme info, or we query by projectId
          try {
            const workflowSchemeResponse = await apiClient.makeRequest<any>({
              method: 'GET',
              path: '/workflowscheme/project',
              params: {
                projectId: projectResponse.data.id,
              },
            });

            if (workflowSchemeResponse.success && workflowSchemeResponse.data) {
              exportData.workflowScheme = workflowSchemeResponse.data.values || workflowSchemeResponse.data;
            }
          } catch (workflowError: any) {
            // Fallback: just note workflow scheme couldn't be retrieved
            exportData.workflowScheme = {
              error: 'Could not retrieve workflow scheme',
              note: 'Use jira-workflows server get_workflow_scheme_projects for detailed scheme info',
            };
          }
        }

        // Include permissions if requested
        if (validatedParams.includePermissions) {
          const permissionsResponse = await apiClient.makeRequest<any>({
            method: 'GET',
            path: `/project/${encodeURIComponent(validatedParams.projectKey)}/permissionscheme`,
          });

          if (permissionsResponse.success) {
            exportData.permissionScheme = permissionsResponse.data;
          }
        }

        // Include custom fields if requested
        if (validatedParams.includeCustomFields) {
          const fieldsResponse = await apiClient.makeRequest<any>({
            method: 'GET',
            path: '/field',
          });

          if (fieldsResponse.success) {
            exportData.customFields = fieldsResponse.data.filter((field: any) =>
              field.isCustom && field.contexts?.some((ctx: any) =>
                ctx.projectIds?.includes(projectResponse.data.id)
              )
            );
          }
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              exportData,
              projectKey: validatedParams.projectKey,
              exportSize: JSON.stringify(exportData).length,
            }, null, 2),
          }],
        };
      } catch (error: any) {
        logger.error('Failed to export project data', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'EXPORT_PROJECT_DATA_ERROR',
                message: sanitizeErrorMessage(error.message),
                details: error.details,
                suggestion: error.suggestion || 'Ensure the project exists and you have appropriate permissions',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: exportUserData
  server.registerTool(
    'export_user_data',
    {
      title: 'Export User Data',
      description: '⚠️ PREREQUISITE: Use "search_users" first to find valid user account IDs. Export user data including profile, groups, permissions, and activity. If you get "User not found" errors, the user likely doesn\'t exist - use the discovery tool to find valid account IDs first.',
      inputSchema: exportUserDataInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = exportUserDataSchema.parse(params);

        // Get user data
        // Query values go in `params` as a plain object - see the note in
        // export_project_data above for why an inline query string 404s and why a
        // URLSearchParams must not be used here.
        const userResponse = await apiClient.makeRequest<any>({
          method: 'GET',
          path: '/user',
          params: {
            accountId: validatedParams.accountId,
            expand: 'groups,applicationRoles',
          },
        });

        if (!userResponse.success) {
          throw new Error('Failed to retrieve user data');
        }

        const exportData: any = {
          user: userResponse.data,
          exportedAt: new Date().toISOString(),
          includeFields: {
            groups: validatedParams.includeGroups,
            permissions: validatedParams.includePermissions,
            activity: validatedParams.includeActivity,
          },
        };

        // Include groups if requested
        if (validatedParams.includeGroups) {
          const groupsResponse = await apiClient.makeRequest<any>({
            method: 'GET',
            path: '/user/groups',
            params: { accountId: validatedParams.accountId },
          });

          if (groupsResponse.success) {
            exportData.groups = groupsResponse.data;
          }
        }

        // Include permissions if requested
        // Note: Jira Cloud doesn't have a direct user permissions endpoint
        // We can only check permissions for the authenticated user via /mypermissions
        if (validatedParams.includePermissions) {
          try {
            // Get user's group memberships which determine permissions
            const groupsResponse = await apiClient.makeRequest<any>({
              method: 'GET',
              path: '/user/groups',
              params: { accountId: validatedParams.accountId },
            });

            exportData.permissions = {
              note: 'Jira Cloud API does not support per-user permission enumeration',
              source: 'group_memberships',
              // `groupsRetrieved` distinguishes "no groups" from "groups not read".
              groupsRetrieved: Boolean(groupsResponse.success),
              groups: groupsResponse.success ? groupsResponse.data : [],
              guidance: 'User permissions are determined by group memberships and project roles. Use jira-fields-permissions server for permission scheme analysis.',
            };
          } catch (permError: any) {
            exportData.permissions = {
              error: 'Could not retrieve permission information',
              note: 'Use jira-fields-permissions server for permission analysis',
            };
          }
        }

        // Include activity if requested (issues created/assigned)
        if (validatedParams.includeActivity) {
          // Use new /search/jql endpoint (old /search deprecated Aug 2025)
          const createdIssuesResponse = await apiClient.makeRequest<any>({
            method: 'POST',
            path: '/search/jql',
            data: {
              jql: `creator = "${validatedParams.accountId}" ORDER BY created DESC`,
              maxResults: 100,
              fields: ['key', 'summary', 'status', 'created', 'project'],
            },
          });

          const assignedIssuesResponse = await apiClient.makeRequest<any>({
            method: 'POST',
            path: '/search/jql',
            data: {
              jql: `assignee = "${validatedParams.accountId}" ORDER BY updated DESC`,
              maxResults: 100,
              fields: ['key', 'summary', 'status', 'updated', 'project'],
            },
          });

          exportData.activity = {
            createdIssues: createdIssuesResponse.success ? createdIssuesResponse.data.issues : [],
            assignedIssues: assignedIssuesResponse.success ? assignedIssuesResponse.data.issues : [],
          };
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              exportData,
              accountId: validatedParams.accountId,
              exportSize: JSON.stringify(exportData).length,
            }, null, 2),
          }],
        };
      } catch (error: any) {
        logger.error('Failed to export user data', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'EXPORT_USER_DATA_ERROR',
                message: sanitizeErrorMessage(error.message),
                details: error.details,
                suggestion: error.suggestion || 'Ensure the user exists and you have appropriate permissions',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: generateSystemReport
  server.registerTool(
    'generate_system_report',
    {
      title: 'Generate System Report',
      description: '📊 REPORTING: Generate comprehensive system health and configuration report with multiple sections (system, license, usage, security). Configure report scope and sections to match your analysis needs.',
      inputSchema: generateSystemReportInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = generateSystemReportSchema.parse(params);

        const report: any = {
          reportType: validatedParams.reportType,
          generatedAt: new Date().toISOString(),
          sections: {},
        };

        // System Info
        if (validatedParams.reportType === 'full' || validatedParams.sections?.includes('system')) {
          const systemInfoResponse = await apiClient.makeRequest<any>({
            method: 'GET',
            path: '/serverInfo',
          });

          if (systemInfoResponse.success) {
            report.sections.systemInfo = systemInfoResponse.data;
          }
        }

        // License Info - Use serverInfo as primary source, fallback for license endpoint
        if (validatedParams.reportType === 'full' || validatedParams.sections?.includes('license')) {
          try {
            // /instance/license is a TENANT endpoint, served by makeRequest with the ordinary site
            // credential. It does NOT require an organization admin token -- attaching one is
            // precisely what used to make this call fail.
            const licenseResponse = await apiClient.makeRequest<any>({
              method: 'GET',
              path: '/instance/license',
            });

            if (licenseResponse.success) {
              report.sections.license = {
                source: 'license_endpoint',
                data: licenseResponse.data,
              };
            }
          } catch (licenseError: any) {
            // Fallback to serverInfo for basic license information
            try {
              const serverInfoResponse = await apiClient.makeRequest<any>({
                method: 'GET',
                path: '/serverInfo',
              });

              // Get user count as license usage indicator.
              // Previously '/user/picker?maxResults=1': the inline query string 404'd,
              // which dragged this whole fallback into the catch below and produced an
              // error blaming /serverInfo, which was actually fine. Settled separately so
              // a user-count failure can no longer be misattributed to serverInfo.
              const userCountRes = await Promise.allSettled([
                apiClient.makeRequest<any>({
                  method: 'GET',
                  path: '/users/search',
                  params: { maxResults: 1000 },
                }),
              ]);
              const userRows = userCountRes[0].status === 'fulfilled' && Array.isArray(userCountRes[0].value.data)
                ? userCountRes[0].value.data
                : null;
              if (!userRows) {
                logger.warn('License fallback: user count unavailable');
              }

              report.sections.license = {
                source: 'fallback_serverinfo',
                warning: 'License endpoint unavailable; using serverInfo fallback. This does NOT indicate a missing Organization Admin token -- /instance/license is a tenant endpoint that uses the ordinary site credential. Check that the account behind ATLASSIAN_API_TOKEN holds the Administer Jira global permission.',
                data: {
                  version: serverInfoResponse.data?.version,
                  deploymentType: serverInfoResponse.data?.deploymentType,
                  serverTitle: serverInfoResponse.data?.serverTitle,
                  buildNumber: serverInfoResponse.data?.buildNumber,
                  userCount: userRows
                    ? userRows.filter((u: any) => u.active && u.accountType !== 'app').length
                    : 'Unknown',
                },
                authError: {
                  endpoint: '/instance/license',
                  requiredPermissions: 'Organization Admin with enhanced API token scopes',
                  currentAuth: 'Site-level API token (basic auth)',
                  suggestion: 'Create organization-level API token with billing/license scopes',
                },
              };
            } catch (fallbackError) {
              report.sections.license = {
                source: 'error',
                error: 'Unable to retrieve license information',
                details: 'Both /instance/license and /serverInfo endpoints failed',
              };
            }
          }
        }

        // Usage Statistics
        if (validatedParams.reportType === 'full' || validatedParams.sections?.includes('usage')) {
          // Use new /search/jql endpoint (old /search deprecated Aug 2025)
          // activeUsers previously came from `/user/picker?maxResults=1`. That was wrong
          // twice over: the inline query string made the path 404, and /user/picker's
          // `total` counts users MATCHING the query, not users on the instance - with an
          // empty query it answers 0. /users/search enumerates accounts, so the count is
          // real. Apps are excluded; they are not licensed human users.
          const [projectsRes, usersRes, issuesRes] = await Promise.allSettled([
            apiClient.makeRequest<any>({ method: 'GET', path: '/project' }),
            apiClient.makeRequest<any>({ method: 'GET', path: '/users/search', params: { maxResults: 1000 } }),
            apiClient.makeRequest<any>({ method: 'POST', path: '/search/jql', data: { jql: 'created >= -30d', maxResults: 1 } }),
          ]);

          if (projectsRes.status === 'rejected') {
            logger.warn('Usage report: project count unavailable', { error: projectsRes.reason?.message });
          }
          if (usersRes.status === 'rejected') {
            logger.warn('Usage report: user count unavailable', { error: usersRes.reason?.message });
          }
          if (issuesRes.status === 'rejected') {
            logger.warn('Usage report: recent issue count unavailable', { error: issuesRes.reason?.message });
          }

          const userRows = usersRes.status === 'fulfilled' && Array.isArray(usersRes.value.data)
            ? usersRes.value.data
            : null;

          // NOTE: Jira removed `total` from POST /search/jql, so recentIssues reads a
          // property that no longer exists on a successful response. That is a separate
          // defect class (not a malformed URL) and is deliberately left for its own
          // change; it is reported rather than silently patched here.
          const recentIssues = issuesRes.status === 'fulfilled'
            ? (issuesRes.value.data?.total ?? null)
            : null;

          // null means "could not determine", never 0. A rejected request that reports 0
          // is indistinguishable from a genuine zero, which is the whole bug being fixed.
          report.sections.usage = {
            projects: projectsRes.status === 'fulfilled' ?
              (Array.isArray(projectsRes.value.data) ? projectsRes.value.data.length : projectsRes.value.data?.total ?? null) : null,
            activeUsers: userRows ? userRows.filter((u: any) => u.active && u.accountType !== 'app').length : null,
            appAccounts: userRows ? userRows.filter((u: any) => u.accountType === 'app').length : null,
            recentIssues,
            dataSources: {
              projects: projectsRes.status === 'fulfilled',
              activeUsers: userRows !== null,
              recentIssues: issuesRes.status === 'fulfilled' && issuesRes.value.data?.total !== undefined,
            },
          };
        }

        // Security & Permissions
        if (validatedParams.reportType === 'full' || validatedParams.sections?.includes('security')) {
          const permissionSchemesResponse = await apiClient.makeRequest<any>({
            method: 'GET',
            path: '/permissionscheme',
          });

          if (permissionSchemesResponse.success) {
            report.sections.security = {
              permissionSchemes: permissionSchemesResponse.data.permissionSchemes?.length || 0,
              schemes: permissionSchemesResponse.data.permissionSchemes || [],
            };
          }
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              report: report,
              reportType: validatedParams.reportType,
            }, null, 2),
          }],
        };
      } catch (error: any) {
        logger.error('Failed to generate system report', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GENERATE_SYSTEM_REPORT_ERROR',
                message: sanitizeErrorMessage(error.message),
                details: error.details,
                suggestion: error.suggestion || 'Ensure you have system administrator permissions',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: generateUsageAnalytics
  server.registerTool(
    'generate_usage_analytics',
    {
      title: 'Generate Usage Analytics',
      description: '📊 REPORTING: Generate detailed usage analytics and activity reports with time period filtering. Provides comprehensive metrics on issue creation, project activity, and user engagement patterns.',
      inputSchema: generateUsageAnalyticsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = generateUsageAnalyticsSchema.parse(params);

        const analytics: any = {
          period: validatedParams.period,
          startDate: validatedParams.startDate,
          endDate: validatedParams.endDate,
          generatedAt: new Date().toISOString(),
        };

        // Build JQL for time period
        let timeFilter = '';
        if (validatedParams.startDate && validatedParams.endDate) {
          timeFilter = `created >= "${jqlSafe(validatedParams.startDate)}" AND created <= "${jqlSafe(validatedParams.endDate)}"`;
        } else if (validatedParams.period) {
          const periodMap = new Map([
            ['week', '-1w'],
            ['month', '-1M'],
            ['quarter', '-3M'],
            ['year', '-1y']
          ]);
          // Safe property access using Map
          if (validatedParams.period && periodMap.has(validatedParams.period)) {
            timeFilter = `created >= ${periodMap.get(validatedParams.period)}`;
          } else {
            timeFilter = 'created >= -1M'; // Default fallback
          }
        }

        // Issue creation analytics - use new /search/jql endpoint (old /search deprecated Aug 2025)
        // Note: maxResults must be at least 1 for the API to return total count
        const issueAnalyticsResponse = await apiClient.makeRequest<any>({
          method: 'POST',
          path: '/search/jql',
          data: {
            jql: timeFilter || 'created >= -1M',
            maxResults: 1,
            fields: ['key'], // Minimal fields for count query
          },
        });

        if (issueAnalyticsResponse.success) {
          analytics.issueMetrics = {
            totalCreated: issueAnalyticsResponse.data.total,
          };
        }

        // Project activity by getting recent issues per project
        const projectsResponse = await apiClient.makeRequest<any>({
          method: 'GET',
          path: '/project',
        });

        if (projectsResponse.success) {
          const projects = Array.isArray(projectsResponse.data) ? projectsResponse.data : projectsResponse.data.values || [];
          analytics.projectActivity = await Promise.all(
            projects.slice(0, 10).map(async (project: any) => {
              try {
                // Use new /search/jql endpoint (old /search deprecated Aug 2025)
                const projectIssuesResponse = await apiClient.makeRequest<any>({
                  method: 'POST',
                  path: '/search/jql',
                  data: {
                    jql: `project = "${jqlSafe(project.key)}" AND (${timeFilter || 'created >= -1M'})`,
                    maxResults: 1,
                    fields: ['key'],
                  },
                });

                return {
                  projectKey: project.key,
                  projectName: project.name,
                  issueCount: projectIssuesResponse.success ? projectIssuesResponse.data.total : 0,
                };
              } catch {
                return {
                  projectKey: project.key,
                  projectName: project.name,
                  issueCount: 0,
                };
              }
            })
          );
        }

        // Get audit records for activity
        if (validatedParams.includeAuditData) {
          const auditResponse = await apiClient.makeRequest<any>({
            method: 'GET',
            path: '/auditing/record',
            params: {
              limit: 100,
              filter: validatedParams.startDate ? `created > ${validatedParams.startDate}` : 'created > -7d',
            },
          });

          if (auditResponse.success) {
            analytics.auditActivity = {
              totalRecords: auditResponse.data.total,
              recentActions: auditResponse.data.records || [],
            };
          }
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              analytics: analytics,
              period: validatedParams.period,
            }, null, 2),
          }],
        };
      } catch (error: any) {
        logger.error('Failed to generate usage analytics', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GENERATE_USAGE_ANALYTICS_ERROR',
                message: sanitizeErrorMessage(error.message),
                details: error.details,
                suggestion: error.suggestion || 'Ensure you have appropriate permissions and valid date parameters',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: generateHealthCheckReport
  server.registerTool(
    'generate_health_check_report',
    {
      title: 'Generate Health Check Report',
      description: '📊 REPORTING: Generate comprehensive system health check and diagnostic report with multiple check levels (basic/comprehensive). Provides system status, performance metrics, security validation, and actionable recommendations.',
      inputSchema: generateHealthCheckReportInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = generateHealthCheckReportSchema.parse(params);

        const healthCheck: any = {
          generatedAt: new Date().toISOString(),
          checkLevel: validatedParams.checkLevel,
          results: {},
          overallStatus: 'healthy',
          warnings: [],
          errors: [],
        };

        // Basic system health checks
        try {
          const serverInfoResponse = await apiClient.makeRequest<any>({
            method: 'GET',
            path: '/serverInfo',
          });

          if (serverInfoResponse.success) {
            healthCheck.results.systemInfo = {
              status: 'healthy',
              data: serverInfoResponse.data,
            };
          } else {
            healthCheck.results.systemInfo = {
              status: 'error',
              message: 'Cannot retrieve server information',
            };
            healthCheck.errors.push('System information unavailable');
          }
        } catch (error) {
          healthCheck.results.systemInfo = {
            status: 'error',
            message: 'Server info check failed',
          };
          healthCheck.errors.push('System information check failed');
        }

        // License health check
        if (validatedParams.checkLevel === 'comprehensive' || validatedParams.checks?.includes('license')) {
          try {
            // Try license endpoint first
            const licenseResponse = await apiClient.makeRequest<any>({
              method: 'GET',
              path: '/instance/license',
            });

            if (licenseResponse.success) {
              const license = licenseResponse.data;
              healthCheck.results.license = {
                status: 'healthy',
                source: 'license_endpoint',
                data: license,
              };

              // Check for license warnings
              if (license.maximumNumberOfUsers && license.numberOfUsers) {
                const usagePercent = (license.numberOfUsers / license.maximumNumberOfUsers) * 100;
                if (usagePercent > 90) {
                  healthCheck.warnings.push(`License usage at ${usagePercent.toFixed(1)}% capacity`);
                }
              }
            }
          } catch (licenseError) {
            // Fallback to serverInfo for basic license health
            try {
              const serverInfoResponse = await apiClient.makeRequest<any>({
                method: 'GET',
                path: '/serverInfo',
              });

              // Previously '/user/picker?maxResults=1': the inline query string 404'd and
              // collapsed this fallback into the catch below, flipping overallStatus to
              // unhealthy over a broken helper call rather than a real license problem.
              // Settled separately, and reported as null rather than a confident 0.
              const userCountRes = await Promise.allSettled([
                apiClient.makeRequest<any>({
                  method: 'GET',
                  path: '/users/search',
                  params: { maxResults: 1000 },
                }),
              ]);
              const userRows = userCountRes[0].status === 'fulfilled' && Array.isArray(userCountRes[0].value.data)
                ? userCountRes[0].value.data
                : null;
              if (!userRows) {
                logger.warn('License health check: user count unavailable');
              }

              healthCheck.results.license = {
                status: 'warning',
                source: 'serverinfo_fallback',
                message: 'License endpoint requires Organization Admin permissions',
                data: {
                  version: serverInfoResponse.data?.version,
                  deploymentType: serverInfoResponse.data?.deploymentType,
                  userCount: userRows
                    ? userRows.filter((u: any) => u.active && u.accountType !== 'app').length
                    : null,
                },
                authIssue: {
                  endpoint: '/instance/license',
                  error: 'AUTH_ERROR',
                  requiredPermission: 'Organization Admin API token with enhanced scopes',
                },
              };
              healthCheck.warnings.push('License endpoint authentication insufficient - using fallback data');
            } catch (fallbackError) {
              healthCheck.results.license = {
                status: 'error',
                message: 'License information completely unavailable',
              };
              healthCheck.errors.push('License health check failed');
            }
          }
        }

        // Performance health checks
        if (validatedParams.checkLevel === 'comprehensive' || validatedParams.checks?.includes('performance')) {
          try {
            // Check system limits usage
            const [projectsRes, fieldsRes] = await Promise.allSettled([
              apiClient.makeRequest<any>({ method: 'GET', path: '/project' }),
              apiClient.makeRequest<any>({ method: 'GET', path: '/field' }),
            ]);

            const projectCount = projectsRes.status === 'fulfilled' ?
              (Array.isArray(projectsRes.value.data) ? projectsRes.value.data.length : projectsRes.value.data?.total || 0) : 0;

            const customFieldCount = fieldsRes.status === 'fulfilled' ?
              fieldsRes.value.data?.filter((f: any) => f.isCustom).length || 0 : 0;

            healthCheck.results.performance = {
              status: 'healthy',
              metrics: {
                projectCount,
                customFieldCount,
              },
            };

            // Performance warnings
            if (projectCount > 1000) {
              healthCheck.warnings.push(`High number of projects (${projectCount})`);
            }
            if (customFieldCount > 100) {
              healthCheck.warnings.push(`High number of custom fields (${customFieldCount})`);
            }
          } catch (error) {
            healthCheck.results.performance = {
              status: 'warning',
              message: 'Performance metrics unavailable',
            };
          }
        }

        // Security health checks
        if (validatedParams.checkLevel === 'comprehensive' || validatedParams.checks?.includes('security')) {
          try {
            const permissionSchemesResponse = await apiClient.makeRequest<any>({
              method: 'GET',
              path: '/permissionscheme',
            });

            if (permissionSchemesResponse.success) {
              const schemes = permissionSchemesResponse.data.permissionSchemes || [];
              healthCheck.results.security = {
                status: 'healthy',
                permissionSchemes: schemes.length,
              };

              // Security warnings
              if (schemes.length > 20) {
                healthCheck.warnings.push(`Large number of permission schemes (${schemes.length})`);
              }
            }
          } catch (error) {
            healthCheck.results.security = {
              status: 'warning',
              message: 'Security checks unavailable',
            };
          }
        }

        // Set overall status
        if (healthCheck.errors.length > 0) {
          healthCheck.overallStatus = 'unhealthy';
        } else if (healthCheck.warnings.length > 0) {
          healthCheck.overallStatus = 'degraded';
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              healthCheck: healthCheck,
              checkLevel: validatedParams.checkLevel,
            }, null, 2),
          }],
        };
      } catch (error: any) {
        logger.error('Failed to generate health check report', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GENERATE_HEALTH_CHECK_ERROR',
                message: sanitizeErrorMessage(error.message),
                details: error.details,
                suggestion: error.suggestion || 'Ensure you have system administrator permissions',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Reporting tools registered successfully (logging disabled for MCP compatibility)
}