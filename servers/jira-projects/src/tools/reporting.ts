import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { JiraApiClient } from '../api/client.js';
import { searchJQLSchema } from '../validation/schemas.js';
import { searchJQLInputSchema, generateProjectReportInputSchema } from '../validation/input-schemas.js';
import { logger } from '../utils/logger.js';
import { wrapUserContent } from '../utils/sanitize.js';
import { toolExamples } from '../validation/tool-examples.js';
import { z } from 'zod';

/**
 * Sanitize issue fields that may contain user-generated content
 */
function sanitizeIssueFields(issue: any): any {
  if (!issue || !issue.fields) return issue;

  return {
    ...issue,
    fields: {
      ...issue.fields,
      summary: issue.fields.summary ? wrapUserContent(issue.fields.summary) : issue.fields.summary,
      description: issue.fields.description ? wrapUserContent(issue.fields.description) : issue.fields.description,
    },
  };
}

export async function registerReportingTools(server: McpServer, apiClient: JiraApiClient) {
  // Tool: searchJQL - Enhanced with JQL guidance
  server.registerTool(
    'search_jql',
    {
      title: 'Search with JQL',
      description: '🔍 Execute JQL queries to search for issues and generate reports. Provides powerful searching capabilities with JQL (Jira Query Language). Use this for finding issues before generating reports.',
      inputSchema: searchJQLInputSchema,
      annotations: {
        title: 'Search with JQL',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      examples: toolExamples['search_jql'],
    },
    async (params) => {
      try {
        const validatedParams = searchJQLSchema.parse(params);

        // Use new /search/jql endpoint (old /search deprecated Aug 2025)
        // Note: New API uses nextPageToken instead of startAt for pagination
        const response = await apiClient.makeRequest<{
          issues: any[];
          total: number;
          startAt: number;
          maxResults: number;
        }>({
          method: 'POST',
          path: '/search/jql',
          data: {
            jql: validatedParams.jql,
            maxResults: validatedParams.maxResults,
            fields: validatedParams.fields,
            expand: validatedParams.expand,
          },
        });

        if (response.success && response.data) {
          const count = response.data.issues.length;
          // Sanitize user-generated content in issue fields
          const sanitizedIssues = response.data.issues.map(sanitizeIssueFields);

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                issues: sanitizedIssues,
                total: response.data.total,
                startAt: response.data.startAt,
                maxResults: response.data.maxResults,
                count: count,
                query_used: validatedParams.jql,
                usage_guidance: count > 0
                  ? `Found ${count} issue(s) matching your JQL query. Use these results for further analysis or reporting.`
                  : `No issues found matching your JQL query. Try modifying the search criteria.`,
                suggested_next_steps: count > 0 ? [
                  'Use "generate_project_report" for project-specific analytics',
                  'Refine your JQL query for more specific results',
                  'Export results for external analysis'
                ] : [
                  'Check your JQL syntax and try again',
                  'Use simpler search criteria to find issues',
                  'Verify project keys and field names in your query'
                ],
                jql_help: {
                  examples: [
                    'project = "PROJ" AND status = "In Progress"',
                    'assignee = currentUser() AND created >= -7d',
                    'priority = High AND resolution is EMPTY'
                  ]
                }
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to execute JQL search');
      } catch (error: any) {
        logger.error('Failed to execute JQL search', { error: error.message });
        
        let enhancedSuggestion = 'Check JQL syntax and permissions';
        let nextSteps: string[] = [];

        if (error.message?.includes('JQL') || error.message?.includes('syntax') || error.message?.includes('parse')) {
          enhancedSuggestion = 'JQL syntax error in your query';
          nextSteps = [
            '1. Check your JQL syntax for errors (quotes, operators, field names)',
            '2. Common syntax: field = "value" AND field2 != "value2"',
            '3. Use the Jira interface to test your JQL before using this tool',
            '4. Reference: Basic JQL: project, assignee, status, created, updated'
          ];
        } else if (error.message?.includes('field') && error.message?.includes('exist')) {
          enhancedSuggestion = 'Field referenced in JQL does not exist';
          nextSteps = [
            '1. Check field names are correct (case sensitive)',
            '2. Use standard fields like: project, assignee, status, priority',
            '3. Custom fields need exact names from Jira configuration',
            '4. Try a simpler query first to test connectivity'
          ];
        } else if (error.message?.includes('permission') || error.message?.includes('Unauthorized')) {
          enhancedSuggestion = 'You do not have permission to search issues';
          nextSteps = [
            '1. Ensure you have "Browse Projects" permission',
            '2. Contact your Jira administrator for search permissions',
            '3. Try searching in projects you have explicit access to'
          ];
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'JQL_SEARCH_ERROR',
                message: error.message,
                query_attempted: params.jql,
                suggestion: enhancedSuggestion,
                next_steps: nextSteps.length > 0 ? nextSteps : undefined,
                workflow_guidance: nextSteps.length > 0 ? 'Fix the JQL syntax or permissions issue, then retry the search' : undefined,
                jql_help: {
                  basic_examples: [
                    'project = "PROJECT_KEY"',
                    'status = "To Do"',
                    'assignee = currentUser()'
                  ],
                  operators: ['=', '!=', 'IN', 'NOT IN', '~', '!~', 'IS EMPTY', 'IS NOT EMPTY'],
                  logical: ['AND', 'OR', 'NOT']
                }
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: generateProjectReport - Enhanced with project key assumptions
  server.registerTool(
    'generate_project_report',
    {
      title: 'Generate Project Report',
      description: '⚠️ PREREQUISITE: Ensure the project key exists and you have access. Generates a comprehensive project report including issues, progress, and statistics. If you get "Project not found" errors, verify the project key is correct.',
      inputSchema: generateProjectReportInputSchema,
      annotations: {
        title: 'Generate Project Report',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: any) => {
      try {
        const projectKey = params.projectKey;
        const includeIssues = params.includeIssues !== false;
        const includeProgress = params.includeProgress !== false;
        const dateRange = params.dateRange || '30d';

        // Validate project exists first
        try {
          const projectCheckResponse = await apiClient.makeRequest<any>({
            method: 'GET',
            path: `/project/${projectKey}`,
          });
          
          if (!projectCheckResponse.success) {
            throw new Error(`Project "${projectKey}" not found or not accessible`);
          }
        } catch (projectError: any) {
          if (projectError.message?.includes('404') || projectError.message?.includes('not found')) {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: {
                    code: 'PROJECT_NOT_FOUND',
                    message: `Project "${projectKey}" not found`,
                    suggestion: 'Project key does not exist or you do not have access',
                    next_steps: [
                      '1. Verify the project key is correct (case sensitive)',
                      '2. Use "search_jql" with query "project = projectKey" to test access',
                      '3. Contact your Jira administrator if the project should exist',
                      '4. Check you have "Browse Projects" permission for this project'
                    ],
                    workflow_guidance: 'Verify project access first, then retry report generation',
                    project_help: {
                      note: 'Project keys are usually 2-10 uppercase letters',
                      examples: ['PROJ', 'DEV', 'SUPPORT', 'TEAM1']
                    }
                  },
                }, null, 2),
              }],
              isError: true,
            };
          }
        }

        // Build JQL for project overview
        let jql = `project = "${projectKey}"`;
        if (dateRange) {
          jql += ` AND created >= -${dateRange}`;
        }

        // Use new /search/jql endpoint (old /search deprecated Aug 2025)
        const response = await apiClient.makeRequest<{
          issues: any[];
          total: number;
        }>({
          method: 'POST',
          path: '/search/jql',
          data: {
            jql,
            maxResults: includeIssues ? 100 : 0,
            fields: ['summary', 'status', 'priority', 'assignee', 'created', 'resolutiondate'],
          },
        });

        if (response.success && response.data) {
          const report: any = {
            projectKey,
            reportGenerated: new Date().toISOString(),
            summary: {
              totalIssues: response.data.total,
              dateRange,
              jqlUsed: jql,
            },
          };

          if (includeIssues) {
            // Sanitize user-generated content in issue fields
            report.issues = response.data.issues.map(sanitizeIssueFields);
          }

          if (includeProgress) {
            // Calculate basic statistics
            const issues = response.data.issues || [];
            const statusCounts: Record<string, number> = {};
            const priorityCounts: Record<string, number> = {};

            issues.forEach((issue: any) => {
              const status = issue.fields.status?.name || 'Unknown';
              const priority = issue.fields.priority?.name || 'Unknown';
              
              statusCounts[status] = (statusCounts[status] || 0) + 1;
              priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;
            });

            report.statistics = {
              statusBreakdown: statusCounts,
              priorityBreakdown: priorityCounts,
            };
          }

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                report,
                usage_guidance: `Project report for ${projectKey} generated successfully with ${response.data.total} total issues.`,
                suggested_next_steps: [
                  'Analyze the status and priority breakdowns',
                  'Use "search_jql" for more detailed issue queries',
                  'Export this report for presentation or further analysis',
                  'Generate additional reports with different date ranges'
                ],
                report_help: {
                  date_range_options: ['7d', '30d', '90d', '1y'],
                  customization: 'Use includeIssues and includeProgress parameters to control report detail'
                }
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to generate project report');
      } catch (error: any) {
        logger.error('Failed to generate project report', { error: error.message });
        
        let enhancedSuggestion = 'Check project key and permissions';
        let nextSteps: string[] = [];

        if (error.message?.includes('not found') || error.message?.includes('NOT_FOUND') || error.message?.includes('404')) {
          enhancedSuggestion = `Project "${params.projectKey}" not found or not accessible`;
          nextSteps = [
            '1. Verify the project key is correct (case sensitive)',
            '2. Use "search_jql" with query "project = projectKey" to test access',
            '3. Contact your Jira administrator if the project should exist',
            '4. Ensure you have "Browse Projects" permission for this project'
          ];
        } else if (error.message?.includes('permission') || error.message?.includes('Unauthorized')) {
          enhancedSuggestion = `You do not have permission to access project "${params.projectKey}"`;
          nextSteps = [
            '1. Contact your project administrator for access',
            '2. Verify you are assigned to this project',
            '3. Check project permissions with "Browse Projects" and "View Issues"'
          ];
        } else if (error.message?.includes('JQL') || error.message?.includes('syntax')) {
          enhancedSuggestion = 'Internal JQL error in report generation';
          nextSteps = [
            '1. Try with a different date range parameter',
            '2. Contact support if the error persists',
            '3. Use "search_jql" directly to test project access'
          ];
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GENERATE_REPORT_ERROR',
                message: error.message,
                project_key: params.projectKey,
                suggestion: enhancedSuggestion,
                next_steps: nextSteps.length > 0 ? nextSteps : undefined,
                workflow_guidance: nextSteps.length > 0 ? 'Verify project access first, then retry report generation' : undefined,
                project_help: {
                  note: 'Project keys are usually 2-10 uppercase letters',
                  examples: ['PROJ', 'DEV', 'SUPPORT', 'TEAM1']
                }
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // New guided tool: get_project_analytics - Enhanced project analytics with discovery
  server.registerTool(
    'get_project_analytics',
    {
      title: 'Get Project Analytics',
      description: '⚠️ PREREQUISITE: Use "generate_project_report" or "search_jql" first to verify project access. Retrieves detailed analytics for a project including velocity, burndown, and team performance metrics.',
      inputSchema: {
        projectKey: z.string().describe('Project key (e.g., PROJ, DEV, SUPPORT)'),
        metricsType: z.enum(['velocity', 'burndown', 'team_performance', 'all']).default('all').describe('Type of analytics to retrieve'),
        timeFrame: z.enum(['7d', '30d', '90d', '6m', '1y']).default('30d').describe('Time frame for analytics')
      },
      annotations: {
        title: 'Get Project Analytics',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: any) => {
      try {
        const { projectKey, metricsType = 'all', timeFrame = '30d' } = params;

        // First verify project exists and is accessible
        try {
          await apiClient.makeRequest<any>({
            method: 'GET',
            path: `/project/${projectKey}`,
          });
        } catch (projectError: any) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: {
                  code: 'PROJECT_ACCESS_ERROR',
                  message: `Cannot access project "${projectKey}" for analytics`,
                  suggestion: 'Project key does not exist or you do not have access',
                  next_steps: [
                    '1. Use "generate_project_report" first to verify project access',
                    '2. Check the project key is correct (case sensitive)',
                    '3. Ensure you have "Browse Projects" permission',
                    '4. Contact your Jira administrator for project access'
                  ],
                  workflow_guidance: 'The proper workflow is: Project Discovery → Report Generation → Analytics',
                  project_help: {
                    note: 'Use "generate_project_report" to test project access before analytics',
                    examples: ['PROJ', 'DEV', 'SUPPORT', 'TEAM1']
                  }
                },
              }, null, 2),
            }],
            isError: true,
          };
        }

        // Build analytics query based on metrics type
        let analyticsJQL = `project = "${projectKey}" AND created >= -${timeFrame}`;

        // Use new /search/jql endpoint (old /search deprecated Aug 2025)
        const analyticsResponse = await apiClient.makeRequest<{
          issues: any[];
          total: number;
        }>({
          method: 'POST',
          path: '/search/jql',
          data: {
            jql: analyticsJQL,
            maxResults: 1000,
            fields: ['status', 'priority', 'assignee', 'created', 'resolutiondate', 'timeestimate', 'timespent', 'worklog'],
          },
        });

        if (analyticsResponse.success && analyticsResponse.data) {
          const issues = analyticsResponse.data.issues;
          
          // Calculate analytics based on requested metrics type
          const analytics: any = {
            projectKey,
            timeFrame,
            metricsType,
            generatedAt: new Date().toISOString(),
            issueCount: issues.length,
          };

          if (metricsType === 'all' || metricsType === 'team_performance') {
            // Team performance metrics
            const assigneeStats: Record<string, any> = {};
            issues.forEach((issue: any) => {
              const assignee = issue.fields.assignee?.displayName || 'Unassigned';
              if (!assigneeStats[assignee]) {
                assigneeStats[assignee] = { total: 0, resolved: 0, inProgress: 0 };
              }
              assigneeStats[assignee].total++;
              
              const status = issue.fields.status?.name?.toLowerCase() || '';
              if (status.includes('done') || status.includes('resolved') || status.includes('closed')) {
                assigneeStats[assignee].resolved++;
              } else if (status.includes('progress') || status.includes('development')) {
                assigneeStats[assignee].inProgress++;
              }
            });
            
            analytics.teamPerformance = assigneeStats;
          }

          if (metricsType === 'all' || metricsType === 'velocity') {
            // Simple velocity calculation (issues closed per week)
            const weeklyClosures: Record<string, number> = {};
            issues.forEach((issue: any) => {
              if (issue.fields.resolutiondate) {
                const resolutionWeek = new Date(issue.fields.resolutiondate).toISOString().slice(0, 10);
                weeklyClosures[resolutionWeek] = (weeklyClosures[resolutionWeek] || 0) + 1;
              }
            });
            
            analytics.velocity = {
              weeklyClosures,
              averagePerWeek: Object.values(weeklyClosures).reduce((a, b) => a + b, 0) / Math.max(Object.keys(weeklyClosures).length, 1)
            };
          }

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                analytics,
                usage_guidance: `Analytics for project ${projectKey} generated successfully covering ${timeFrame}.`,
                suggested_next_steps: [
                  'Analyze team performance metrics to identify bottlenecks',
                  'Use velocity data for sprint planning',
                  'Generate reports with different time frames for trends',
                  'Export analytics data for presentation'
                ]
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to retrieve project analytics');
      } catch (error: any) {
        logger.error('Failed to get project analytics', { error: error.message });
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_ANALYTICS_ERROR',
                message: error.message,
                suggestion: 'Check project key and permissions',
                next_steps: [
                  '1. Use "generate_project_report" first to verify project access',
                  '2. Ensure you have permissions to view project issues',
                  '3. Try with a different time frame parameter'
                ],
                workflow_guidance: 'The proper workflow is: Project Discovery → Report Generation → Analytics'
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );
}