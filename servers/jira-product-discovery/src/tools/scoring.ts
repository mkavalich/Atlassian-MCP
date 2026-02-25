import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { JpdGraphQLClient } from '../api/graphql-client.js';
import { JiraApiClient } from '../api/client.js';
import { getIdeaScoringSchema } from '../validation/schemas.js';
import { getIdeaScoringInputSchema } from '../validation/input-schemas.js';
import { GET_IDEA_SCORING } from '../graphql/queries.js';
import { JpdScoringData, JpdScore } from '../types/index.js';
import { logger } from '../utils/logger.js';

export async function registerScoringTools(
  server: McpServer,
  graphqlClient: JpdGraphQLClient,
  restClient: JiraApiClient
) {
  // Tool: get_idea_scoring (Read Tool)
  server.registerTool(
    'get_idea_scoring',
    {
      title: 'Get Idea Scoring',
      description: '📊 READ: Get the prioritization scoring data for an idea. Includes impact, effort, confidence, reach, and other scoring fields configured in JPD. Use "get_ideas" first to find idea keys.',
      inputSchema: getIdeaScoringInputSchema as any,
      annotations: {
        title: 'Get Idea Scoring',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = getIdeaScoringSchema.parse(params);

        // First, get the issue ID from the key if needed
        let issueId = validatedParams.ideaId;
        if (issueId.includes('-')) {
          const issueResponse = await restClient.makeRequest<{ id: string }>({
            method: 'GET',
            path: `/issue/${validatedParams.ideaId}`,
            params: { fields: 'id' },
          });
          if (issueResponse.success && issueResponse.data) {
            issueId = issueResponse.data.id;
          }
        }

        // Try the GraphQL API for scoring data
        try {
          const response = await graphqlClient.execute<{
            jira: {
              issueById: {
                id: string;
                key: string;
                productDiscovery: {
                  scoring: JpdScoringData;
                };
              };
            };
          }>({
            query: GET_IDEA_SCORING,
            variables: {
              issueId,
            },
          });

          if (response.success && response.data?.jira?.issueById?.productDiscovery?.scoring) {
            const scoring = response.data.jira.issueById.productDiscovery.scoring;

            return {
              content: [{
                type: 'text' as const,
                text: JSON.stringify({
                  success: true,
                  ideaId: validatedParams.ideaId,
                  scoring: {
                    fields: scoring.fields,
                    totalScore: scoring.totalScore,
                    rank: scoring.rank,
                  },
                  summary: {
                    fieldCount: scoring.fields?.length || 0,
                    scoredFields: scoring.fields?.filter(f => f.value !== null && f.value !== undefined).length || 0,
                    totalScore: scoring.totalScore,
                    rank: scoring.rank,
                  },
                  usage_guidance: scoring.totalScore !== undefined
                    ? `Idea has a total score of ${scoring.totalScore}${scoring.rank ? ` and is ranked #${scoring.rank}` : ''}. Review individual field scores for detailed breakdown.`
                    : 'Scoring data retrieved. Some fields may not have values yet.',
                  scoring_interpretation: {
                    note: 'JPD typically uses RICE or custom scoring frameworks',
                    common_fields: [
                      'Reach - How many users will this impact?',
                      'Impact - How significant is the impact per user?',
                      'Confidence - How confident are we in our estimates?',
                      'Effort - How much work is required?',
                    ],
                  },
                }, null, 2),
              }],
            };
          }
        } catch (graphqlError: any) {
          logger.warn('GraphQL scoring API failed', { error: graphqlError.message });
        }

        // If GraphQL fails, try to get scoring from REST custom fields
        // JPD often stores scoring in custom fields that can be accessed via REST
        try {
          const issueResponse = await restClient.makeRequest<{
            id: string;
            key: string;
            fields: Record<string, any>;
          }>({
            method: 'GET',
            path: `/issue/${validatedParams.ideaId}`,
            params: { fields: '*all' },
          });

          if (issueResponse.success && issueResponse.data) {
            const fields = issueResponse.data.fields;

            // Look for potential JPD scoring fields in custom fields
            const scoringFields: JpdScore[] = [];

            for (const [fieldId, value] of Object.entries(fields)) {
              if (fieldId.startsWith('customfield_') && value !== null) {
                // For now, just capture numeric custom fields
                if (typeof value === 'number') {
                  scoringFields.push({
                    fieldId: fieldId,
                    fieldName: fieldId, // Would be better with field metadata
                    value: value,
                  });
                }
              }
            }

            return {
              content: [{
                type: 'text' as const,
                text: JSON.stringify({
                  success: true,
                  ideaId: validatedParams.ideaId,
                  scoring: {
                    fields: scoringFields,
                    source: 'rest_api_custom_fields',
                  },
                  note: 'Scoring data retrieved from custom fields. For full JPD scoring integration, ensure GraphQL API is accessible.',
                  usage_guidance: scoringFields.length > 0
                    ? `Found ${scoringFields.length} potential scoring field(s). Field names may need mapping to your JPD configuration.`
                    : 'No scoring fields detected in custom fields. Scoring may be configured differently in your JPD instance.',
                }, null, 2),
              }],
            };
          }
        } catch (restError: any) {
          logger.warn('REST API fallback failed for scoring', { error: restError.message });
        }

        // Return helpful message if scoring isn't available
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              ideaId: validatedParams.ideaId,
              scoring: null,
              note: 'Scoring data is not available via API for this idea. This may be because: (1) JPD scoring is not configured, (2) GraphQL API is not accessible, or (3) Scoring data exists only in the JPD web interface.',
              suggestion: 'Check the idea in the Jira Product Discovery web interface to view and edit scoring values.',
            }, null, 2),
          }],
        };
      } catch (error: any) {
        let enhancedSuggestion = 'Verify the idea exists and you have permission to view it';

        if (error.message?.includes('not found')) {
          enhancedSuggestion = 'Idea not found. Use "get_ideas" to find valid idea keys';
        } else if (error.message?.includes('GraphQL')) {
          enhancedSuggestion = 'GraphQL API error. JPD scoring API may not be available';
        }

        logger.error('Failed to get idea scoring', { error: error.message, ideaId: params.ideaId });
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_SCORING_ERROR',
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
}
