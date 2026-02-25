import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { JpdGraphQLClient } from '../api/graphql-client.js';
import { JiraApiClient } from '../api/client.js';
import {
  getInsightsSchema,
  getInsightSchema,
  createInsightSchema,
  updateInsightSchema,
  deleteInsightSchema,
  analyzeIdeaInsightsSchema,
} from '../validation/schemas.js';
import {
  getInsightsInputSchema,
  getInsightInputSchema,
  createInsightInputSchema,
  updateInsightInputSchema,
  deleteInsightInputSchema,
  analyzeIdeaInsightsInputSchema,
} from '../validation/input-schemas.js';
import {
  GET_IDEA_INSIGHTS,
  GET_INSIGHT,
} from '../graphql/queries.js';
import {
  CREATE_INSIGHT,
  UPDATE_INSIGHT,
  DELETE_INSIGHT,
} from '../graphql/mutations.js';
import { JpdInsight } from '../types/index.js';
import { logger } from '../utils/logger.js';

export async function registerInsightTools(
  server: McpServer,
  graphqlClient: JpdGraphQLClient,
  restClient: JiraApiClient
) {
  // Tool: get_insights (Discovery Tool)
  server.registerTool(
    'get_insights',
    {
      title: 'Get Insights',
      description: '🔍 DISCOVERY: List all insights (evidence) attached to an idea. Insights represent customer feedback, research findings, and supporting data. Use "get_ideas" first to find idea keys.',
      inputSchema: getInsightsInputSchema as any,
      annotations: {
        title: 'Get Insights',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = getInsightsSchema.parse(params);

        // First, get the issue details (ID and project ID) from the key if needed
        let issueId = validatedParams.ideaId;
        let projectId: string | null = null;

        if (issueId.includes('-')) {
          // It's a key, need to get the ID and project ID
          const issueResponse = await restClient.makeRequest<{
            id: string;
            fields: { project: { id: string } };
          }>({
            method: 'GET',
            path: `/issue/${validatedParams.ideaId}`,
            params: { fields: 'project' },
          });
          if (issueResponse.success && issueResponse.data) {
            issueId = issueResponse.data.id;
            projectId = issueResponse.data.fields.project.id;
          }
        }

        if (!projectId) {
          throw new Error('Could not determine project ID for this idea');
        }

        // Build ARIs for the Polaris API
        const projectAri = await graphqlClient.buildProjectAri(projectId);
        const containerAri = await graphqlClient.buildIssueAri(issueId);

        // Try the Polaris GraphQL API
        try {
          const response = await graphqlClient.execute<{
            polarisInsights: JpdInsight[];
          }>({
            query: GET_IDEA_INSIGHTS,
            variables: {
              projectAri,
              containerAri,
            },
          });

          if (response.success && response.data) {
            const insights = response.data.polarisInsights || [];

            return {
              content: [{
                type: 'text' as const,
                text: JSON.stringify({
                  success: true,
                  ideaId: validatedParams.ideaId,
                  insights,
                  pagination: {
                    total: insights.length,
                    count: insights.length,
                    hasMore: false,
                  },
                  usage_guidance: insights.length > 0
                    ? `Found ${insights.length} insight(s) for this idea. Use "get_insight" for full details, or "create_insight" to add more evidence.`
                    : 'No insights found for this idea. Use "create_insight" to add supporting evidence.',
                  suggested_next_steps: insights.length > 0
                    ? [
                        `Use "analyze_idea_insights" for aggregate analysis`,
                        `Use "create_insight" to add new evidence`,
                      ]
                    : [
                        `Use "create_insight" to add evidence for this idea`,
                      ],
                }, null, 2),
              }],
            };
          }
        } catch (graphqlError: any) {
          // If Polaris API fails, this project may not have insights enabled
          // or the GraphQL schema differs
          logger.warn('Polaris JPD API failed, insights may not be available', {
            error: graphqlError.message,
          });
        }

        // Return a helpful message if insights aren't available
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              ideaId: validatedParams.ideaId,
              insights: [],
              pagination: {
                total: 0,
                count: 0,
                hasMore: false,
              },
              note: 'Insights API may not be available for this project. Jira Product Discovery insights require specific JPD features to be enabled.',
              usage_guidance: 'If you have JPD enabled, insights can be created and managed through the Jira web interface.',
            }, null, 2),
          }],
        };
      } catch (error: any) {
        let enhancedSuggestion = 'Verify the idea exists and you have permission to view it';

        if (error.message?.includes('not found')) {
          enhancedSuggestion = 'Idea not found. Use "get_ideas" to find valid idea keys';
        } else if (error.message?.includes('GraphQL')) {
          enhancedSuggestion = 'GraphQL API error. JPD insights may not be available for this instance';
        }

        logger.error('Failed to get insights', { error: error.message, ideaId: params.ideaId });
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_INSIGHTS_ERROR',
                message: error.message,
                suggestion: enhancedSuggestion,
                related_tools: ['get_ideas', 'get_idea'],
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // REMOVED: The following 4 insight tools require undocumented Polaris GraphQL schema
  // See backlog.json for details. Insights can be managed via Jira UI.

  /*
  // Tool: get_insight (Read Tool)
  server.registerTool(
    'get_insight',
    {
      title: 'Get Insight',
      description: '📖 READ: Get full details of a specific insight by ID. Use "get_insights" first to find insight IDs.',
      inputSchema: getInsightInputSchema as any,
      annotations: {
        title: 'Get Insight',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = getInsightSchema.parse(params);

        const response = await graphqlClient.execute<{
          polaris: {
            insights: {
              insight: JpdInsight;
            };
          };
        }>({
          query: GET_INSIGHT,
          variables: {
            insightId: validatedParams.insightId,
          },
        });

        if (response.success && response.data?.polaris?.insights?.insight) {
          const insight = response.data.polaris.insights.insight;

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                insight,
                usage_guidance: 'Insight retrieved successfully. Use "update_insight" to modify or "delete_insight" to remove.',
                suggested_next_steps: [
                  `Use "update_insight" to modify this insight`,
                  `Use "delete_insight" to remove this insight`,
                ],
              }, null, 2),
            }],
          };
        }

        throw new Error('Insight not found or Polaris GraphQL API unavailable');
      } catch (error: any) {
        logger.error('Failed to get insight', { error: error.message, insightId: params.insightId });
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_INSIGHT_ERROR',
                message: error.message,
                suggestion: 'Verify the insight ID is correct. Use "get_insights" to find valid IDs.',
                related_tools: ['get_insights'],
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: create_insight (Create Tool)
  server.registerTool(
    'create_insight',
    {
      title: 'Create Insight',
      description: '🆕 CREATE: Create a new insight (evidence) for an idea. Insights represent customer feedback, research findings, interview notes, or any supporting data. Use "get_ideas" first to find the target idea.',
      inputSchema: createInsightInputSchema as any,
      annotations: {
        title: 'Create Insight',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = createInsightSchema.parse(params);

        // First, get the issue details (ID and project ID) from the key if needed
        let issueId = validatedParams.ideaId;
        let projectId: string | null = null;

        if (issueId.includes('-')) {
          const issueResponse = await restClient.makeRequest<{
            id: string;
            fields: { project: { id: string } };
          }>({
            method: 'GET',
            path: `/issue/${validatedParams.ideaId}`,
            params: { fields: 'project' },
          });
          if (issueResponse.success && issueResponse.data) {
            issueId = issueResponse.data.id;
            projectId = issueResponse.data.fields.project.id;
          }
        }

        if (!projectId) {
          throw new Error('Could not determine project ID for this idea');
        }

        // Get cloudId for the Polaris API
        const cloudId = await graphqlClient.getPublicCloudId();

        // Try Polaris API
        // Note: Snippets are not supported via GraphQL mutation - they can be added via UI
        // Schema requires: cloudID (String), projectID (Int), issueID (Int), description (JSON)
        try {
          const response = await graphqlClient.execute<{
            createPolarisInsight: {
              success: boolean;
              errors: string[] | null;
            };
          }>({
            query: CREATE_INSIGHT,
            variables: {
              cloudId,
              projectId: parseInt(projectId, 10),
              issueId: parseInt(issueId, 10),
              description: validatedParams.description,
            },
          });

          if (response.success && response.data?.createPolarisInsight?.success) {
            logger.info('Insight created successfully', { ideaId: validatedParams.ideaId });

            return {
              content: [{
                type: 'text' as const,
                text: JSON.stringify({
                  success: true,
                  ideaId: validatedParams.ideaId,
                  message: 'Insight created successfully',
                  usage_guidance: 'Insight has been attached to the idea. Use "get_insights" to see all insights including the new one.',
                  suggested_next_steps: [
                    `Use "get_insights" with ideaId="${validatedParams.ideaId}" to see all insights`,
                    `Use "analyze_idea_insights" for aggregate analysis`,
                  ],
                }, null, 2),
              }],
            };
          }

          // Check for errors returned by the mutation
          if (response.data?.createPolarisInsight?.errors?.length) {
            throw new Error(`Mutation failed: ${response.data.createPolarisInsight.errors.join(', ')}`);
          }
        } catch (graphqlError: any) {
          logger.warn('Polaris API failed for insight creation', { error: graphqlError.message });
          throw graphqlError;
        }

        throw new Error('Failed to create insight: Polaris GraphQL API returned no data');
      } catch (error: any) {
        let suggestion = 'JPD insight mutations require undocumented Polaris GraphQL schema. Use Jira UI to manage insights.';

        if (error.message?.includes('not found')) {
          suggestion = 'Idea not found. Use "get_ideas" to find valid idea keys';
        } else if (error.message?.includes('permission')) {
          suggestion = 'You may not have permission to create insights';
        } else if (error.message?.includes('GraphQL')) {
          suggestion = 'JPD insights API may not be available. Check if JPD is enabled for this project';
        }

        logger.error('Failed to create insight', { error: error.message, ideaId: params.ideaId });
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'CREATE_INSIGHT_ERROR',
                message: error.message,
                suggestion,
                related_tools: ['get_ideas', 'get_jpd_projects'],
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: update_insight (Update Tool)
  server.registerTool(
    'update_insight',
    {
      title: 'Update Insight',
      description: '✏️ UPDATE: Update an existing insight. Use "get_insights" first to find insight IDs.',
      inputSchema: updateInsightInputSchema as any,
      annotations: {
        title: 'Update Insight',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = updateInsightSchema.parse(params);

        // Note: Snippets updates not supported via GraphQL - only description can be updated
        const response = await graphqlClient.execute<{
          updatePolarisInsight: JpdInsight;
        }>({
          query: UPDATE_INSIGHT,
          variables: {
            id: validatedParams.insightId,
            description: validatedParams.description,
          },
        });

        if (response.success && response.data?.updatePolarisInsight) {
          const insight = response.data.updatePolarisInsight;

          logger.info('Insight updated successfully', { insightId: validatedParams.insightId });

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                insight,
                message: 'Insight updated successfully',
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to update insight: Polaris GraphQL API returned no data');
      } catch (error: any) {
        logger.error('Failed to update insight', { error: error.message, insightId: params.insightId });
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'UPDATE_INSIGHT_ERROR',
                message: error.message,
                suggestion: 'Verify the insight ID is correct. Use "get_insights" to find valid IDs.',
                related_tools: ['get_insights'],
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: delete_insight (Delete Tool)
  server.registerTool(
    'delete_insight',
    {
      title: 'Delete Insight',
      description: '🗑️ DELETE: Permanently delete an insight. This cannot be undone. Use "get_insights" first to find insight IDs.',
      inputSchema: deleteInsightInputSchema as any,
      annotations: {
        title: 'Delete Insight',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = deleteInsightSchema.parse(params);

        const response = await graphqlClient.execute<{
          deletePolarisInsight: {
            success: boolean;
          };
        }>({
          query: DELETE_INSIGHT,
          variables: {
            id: validatedParams.insightId,
          },
        });

        if (response.success && response.data?.deletePolarisInsight?.success) {
          logger.info('Insight deleted successfully', { insightId: validatedParams.insightId });

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                deletedInsightId: validatedParams.insightId,
                message: 'Insight deleted successfully',
                warning: 'This action cannot be undone',
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to delete insight: Polaris GraphQL API returned no success');
      } catch (error: any) {
        logger.error('Failed to delete insight', { error: error.message, insightId: params.insightId });
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'DELETE_INSIGHT_ERROR',
                message: error.message,
                suggestion: 'Verify the insight ID is correct. It may have already been deleted.',
                related_tools: ['get_insights'],
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );
  */

  // Tool: analyze_idea_insights (Analysis Tool)
  server.registerTool(
    'analyze_idea_insights',
    {
      title: 'Analyze Idea Insights',
      description: '📊 ANALYSIS: Aggregate analysis of all insights for an idea. Returns summary statistics, themes, and patterns in the evidence.',
      inputSchema: analyzeIdeaInsightsInputSchema as any,
      annotations: {
        title: 'Analyze Idea Insights',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = analyzeIdeaInsightsSchema.parse(params);

        // First, get the issue details (ID and project ID) from the key if needed
        let issueId = validatedParams.ideaId;
        let projectId: string | null = null;

        if (issueId.includes('-')) {
          const issueResponse = await restClient.makeRequest<{
            id: string;
            fields: { project: { id: string } };
          }>({
            method: 'GET',
            path: `/issue/${validatedParams.ideaId}`,
            params: { fields: 'project' },
          });
          if (issueResponse.success && issueResponse.data) {
            issueId = issueResponse.data.id;
            projectId = issueResponse.data.fields.project.id;
          }
        }

        if (!projectId) {
          throw new Error('Could not determine project ID for this idea');
        }

        // Build ARIs for the Polaris API
        const projectAri = await graphqlClient.buildProjectAri(projectId);
        const containerAri = await graphqlClient.buildIssueAri(issueId);

        // Try the Polaris GraphQL API for insights analysis
        try {
          const response = await graphqlClient.execute<{
            polarisInsights: JpdInsight[];
          }>({
            query: GET_IDEA_INSIGHTS,
            variables: {
              projectAri,
              containerAri,
            },
          });

          if (response.success && response.data) {
            const insights = response.data.polarisInsights || [];

            // Perform basic analysis
            const analysis = {
              totalInsights: insights.length,
              analyzedCount: insights.length,
              sources: {
                withUrls: insights.filter(i => i.snippets?.some(s => s.url)).length,
                withData: insights.filter(i => i.snippets?.some(s => s.data)).length,
              },
              timeline: insights.length > 0 ? {
                oldest: insights.reduce((min, i) => i.created && i.created < min ? i.created : min, insights[0]?.created || ''),
                newest: insights.reduce((max, i) => i.created && i.created > max ? i.created : max, insights[0]?.created || ''),
              } : null,
              authors: [...new Set(insights.map(i => i.author?.displayName).filter(Boolean))],
            };

            return {
              content: [{
                type: 'text' as const,
                text: JSON.stringify({
                  success: true,
                  ideaId: validatedParams.ideaId,
                  analysis,
                  insights: insights.map(i => ({
                    id: i.id,
                    description: i.description?.substring(0, 200) + (i.description && i.description.length > 200 ? '...' : ''),
                    created: i.created,
                    author: i.author?.displayName,
                    snippetCount: i.snippets?.length || 0,
                  })),
                  usage_guidance: `Analysis complete for ${analysis.totalInsights} insight(s). Review the themes and patterns to inform prioritization decisions.`,
                }, null, 2),
              }],
            };
          }
        } catch (graphqlError: any) {
          // If Polaris GraphQL API fails, insights may not be available
          // Return a graceful response instead of failing
          logger.warn('Polaris GraphQL API not available for insights analysis', {
            error: graphqlError.message,
          });
        }

        // Return a helpful message if insights analysis isn't available
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              ideaId: validatedParams.ideaId,
              analysis: {
                totalInsights: 0,
                analyzedCount: 0,
                note: 'JPD insights API not available. Insights analysis requires Jira Product Discovery with the insights feature enabled.',
              },
              usage_guidance: 'If you have JPD enabled, insights can be managed through the Jira web interface. The GraphQL API for insights may not be available in all configurations.',
            }, null, 2),
          }],
        };
      } catch (error: any) {
        logger.error('Failed to analyze insights', { error: error.message, ideaId: params.ideaId });
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'ANALYZE_INSIGHTS_ERROR',
                message: error.message,
                suggestion: 'Verify the idea exists and JPD is enabled for this project',
                related_tools: ['get_ideas', 'get_insights'],
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );
}
