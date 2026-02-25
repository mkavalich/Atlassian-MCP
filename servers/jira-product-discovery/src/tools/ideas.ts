import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { JiraApiClient } from '../api/client.js';
import {
  getIdeasSchema,
  searchIdeasSchema,
  getIdeaSchema,
  createIdeaSchema,
  updateIdeaSchema,
  deleteIdeaSchema,
} from '../validation/schemas.js';
import {
  getIdeasInputSchema,
  searchIdeasInputSchema,
  getIdeaInputSchema,
  createIdeaInputSchema,
  updateIdeaInputSchema,
  deleteIdeaInputSchema,
} from '../validation/input-schemas.js';
import { JpdIdea, JiraSearchResult, JiraCreateIssueResponse } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { wrapUserContent } from '../utils/sanitize.js';

export async function registerIdeaTools(server: McpServer, apiClient: JiraApiClient) {
  // Tool: get_ideas (Discovery Tool)
  server.registerTool(
    'get_ideas',
    {
      title: 'Get Ideas',
      description: '🔍 DISCOVERY: List all ideas in a JPD project. Use "get_jpd_projects" first to find valid project keys. Returns ideas with summary, status, and basic fields.',
      inputSchema: getIdeasInputSchema as any,
      annotations: {
        title: 'Get Ideas',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = getIdeasSchema.parse(params);
        const { projectKey, fields, ...pagination } = validatedParams;

        // Build JQL to search for ideas in the project
        const jql = `project = "${projectKey}" ORDER BY created DESC`;

        // Use new /search/jql endpoint (old /search deprecated Aug 2025)
        // See: https://developer.atlassian.com/changelog/#CHANGE-2046
        const response = await apiClient.makeRequest<JiraSearchResult>({
          method: 'POST',
          path: '/search/jql',
          data: {
            jql,
            maxResults: pagination.maxResults || 20,
            fields: fields === 'summary'
              ? ['summary', 'status', 'issuetype', 'priority', 'created', 'updated']
              : ['*all'],
          },
        });

        if (response.success && response.data) {
          const ideas: JpdIdea[] = response.data.issues.map(issue => ({
            id: issue.id,
            key: issue.key,
            self: issue.self,
            summary: wrapUserContent(issue.fields?.summary),
            description: fields === 'full' ? wrapUserContent(issue.fields?.description) : undefined,
            status: issue.fields?.status,
            priority: issue.fields?.priority,
            issuetype: issue.fields?.issuetype,
            created: issue.fields?.created,
            updated: issue.fields?.updated,
            assignee: fields === 'full' ? issue.fields?.assignee : undefined,
            reporter: fields === 'full' ? issue.fields?.reporter : undefined,
            labels: fields === 'full' ? issue.fields?.labels : undefined,
          }));

          // New API uses nextPageToken/isLast instead of startAt/total
          const hasMore = !response.data.isLast;

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                ideas,
                projectKey,
                pagination: {
                  count: ideas.length,
                  maxResults: pagination.maxResults || 20,
                  hasMore,
                  nextPageToken: response.data.nextPageToken || null,
                },
                fieldsMode: fields,
                usage_guidance: ideas.length > 0
                  ? `Found ${ideas.length} idea(s) in ${projectKey}.${hasMore ? ' More results available via nextPageToken.' : ''} Use "get_idea" with an idea key for full details, or "get_insights" to see attached evidence.`
                  : `No ideas found in project ${projectKey}. Use "create_idea" to add the first idea.`,
                suggested_next_steps: ideas.length > 0
                  ? [
                      `Use "get_idea" with ideaIdOrKey="${ideas[0].key}" for full details`,
                      `Use "get_insights" to see evidence attached to an idea`,
                      `Use "get_idea_scoring" to see prioritization scores`,
                    ]
                  : [
                      `Use "create_idea" to create a new idea in ${projectKey}`,
                    ],
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get ideas: No data returned');
      } catch (error: any) {
        let enhancedSuggestion = 'Verify the project key and your permissions';
        let nextSteps: string[] = [];

        if (error.message?.includes('project') || error.message?.includes('not found')) {
          enhancedSuggestion = `Project "${params.projectKey}" not found or not a JPD project`;
          nextSteps = [
            '1. Use "get_jpd_projects" to find valid project keys',
            '2. Ensure the project is a Product Discovery project',
            '3. Check your project permissions',
          ];
        } else if (error.message?.includes('permission') || error.message?.includes('FORBIDDEN')) {
          enhancedSuggestion = 'Insufficient permissions to view ideas';
          nextSteps = [
            '1. Verify you have Browse Projects permissions',
            '2. Contact your project administrator',
          ];
        }

        logger.error('Failed to get ideas', { error: error.message, projectKey: params.projectKey });
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_IDEAS_ERROR',
                message: error.message,
                suggestion: enhancedSuggestion,
                next_steps: nextSteps.length > 0 ? nextSteps : undefined,
                related_tools: ['get_jpd_projects'],
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: search_ideas (Discovery Tool)
  server.registerTool(
    'search_ideas',
    {
      title: 'Search Ideas',
      description: '🔍 DISCOVERY: Search for ideas using JQL (Jira Query Language). Supports complex queries like status, labels, assignee, custom fields. Example: "project = JPD AND status = Open AND labels = priority-high".',
      inputSchema: searchIdeasInputSchema as any,
      annotations: {
        title: 'Search Ideas',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = searchIdeasSchema.parse(params);
        const { jql, fields, expand, ...pagination } = validatedParams;

        // Use new /search/jql endpoint (old /search deprecated Aug 2025)
        // See: https://developer.atlassian.com/changelog/#CHANGE-2046
        const requestData: Record<string, any> = {
          jql,
          maxResults: pagination.maxResults || 20,
          fields: fields === 'summary'
            ? ['summary', 'status', 'issuetype', 'priority', 'created', 'updated']
            : ['*all'],
        };

        if (expand) {
          requestData.expand = expand.split(',');
        }

        const response = await apiClient.makeRequest<JiraSearchResult>({
          method: 'POST',
          path: '/search/jql',
          data: requestData,
        });

        if (response.success && response.data) {
          const ideas: JpdIdea[] = response.data.issues.map(issue => ({
            id: issue.id,
            key: issue.key,
            self: issue.self,
            summary: wrapUserContent(issue.fields?.summary),
            description: fields === 'full' ? wrapUserContent(issue.fields?.description) : undefined,
            status: issue.fields?.status,
            priority: issue.fields?.priority,
            issuetype: issue.fields?.issuetype,
            created: issue.fields?.created,
            updated: issue.fields?.updated,
            assignee: fields === 'full' ? issue.fields?.assignee : undefined,
            reporter: fields === 'full' ? issue.fields?.reporter : undefined,
            labels: fields === 'full' ? issue.fields?.labels : undefined,
          }));

          // New API uses nextPageToken/isLast instead of startAt/total
          const hasMore = !response.data.isLast;

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                ideas,
                jql,
                pagination: {
                  count: ideas.length,
                  maxResults: pagination.maxResults || 20,
                  hasMore,
                  nextPageToken: response.data.nextPageToken || null,
                },
                fieldsMode: fields,
                usage_guidance: ideas.length > 0
                  ? `Found ${ideas.length} idea(s) matching your query.${hasMore ? ' More results available via nextPageToken.' : ''}`
                  : 'No ideas matched your JQL query. Try broadening your search criteria.',
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to search ideas: No data returned');
      } catch (error: any) {
        let enhancedSuggestion = 'Check JQL syntax and field names';

        if (error.message?.includes('JQL') || error.message?.includes('parse')) {
          enhancedSuggestion = 'JQL syntax error. Check field names and operators';
        } else if (error.message?.includes('field')) {
          enhancedSuggestion = 'Unknown field in JQL. Verify field names exist';
        }

        logger.error('Failed to search ideas', { error: error.message, jql: params.jql });
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'SEARCH_IDEAS_ERROR',
                message: error.message,
                suggestion: enhancedSuggestion,
                jql_examples: [
                  'project = JPD',
                  'project = JPD AND status = Open',
                  'project = JPD AND labels = high-priority',
                  'project = JPD AND assignee = currentUser()',
                ],
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: get_idea (Read Tool)
  server.registerTool(
    'get_idea',
    {
      title: 'Get Idea',
      description: '📖 READ: Get full details of a specific idea by ID or key. Use expand parameter to include additional data like changelog, transitions, or rendered fields.',
      inputSchema: getIdeaInputSchema as any,
      annotations: {
        title: 'Get Idea',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = getIdeaSchema.parse(params);

        const queryParams: Record<string, any> = {};
        if (validatedParams.expand) {
          queryParams.expand = validatedParams.expand;
        }
        if (validatedParams.fields === 'summary') {
          queryParams.fields = 'summary,status,issuetype,priority,created,updated,assignee,reporter,labels,description';
        }

        const response = await apiClient.makeRequest<JpdIdea>({
          method: 'GET',
          path: `/issue/${validatedParams.ideaIdOrKey}`,
          params: queryParams,
        });

        if (response.success && response.data) {
          const idea = response.data;

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                idea: {
                  id: idea.id,
                  key: idea.key,
                  self: idea.self,
                  fields: {
                    summary: wrapUserContent(idea.fields?.summary),
                    description: wrapUserContent(idea.fields?.description),
                    status: idea.fields?.status,
                    priority: idea.fields?.priority,
                    issuetype: idea.fields?.issuetype,
                    assignee: idea.fields?.assignee,
                    reporter: idea.fields?.reporter,
                    created: idea.fields?.created,
                    updated: idea.fields?.updated,
                    labels: idea.fields?.labels,
                    project: idea.fields?.project,
                  },
                  transitions: idea.transitions,
                  changelog: idea.changelog,
                },
                usage_guidance: `Idea ${idea.key} retrieved successfully. Use "get_insights" to see attached evidence, or "get_idea_scoring" to see prioritization scores.`,
                suggested_next_steps: [
                  `Use "get_insights" with ideaId="${idea.key}" to see evidence`,
                  `Use "get_idea_scoring" with ideaId="${idea.key}" to see scores`,
                  `Use "update_idea" to modify this idea`,
                  `Use "create_insight" to add new evidence`,
                ],
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get idea: No data returned');
      } catch (error: any) {
        let enhancedSuggestion = 'Verify the idea key or ID is correct';

        if (error.message?.includes('not found') || error.message?.includes('does not exist')) {
          enhancedSuggestion = 'Idea not found. Use "get_ideas" or "search_ideas" to find valid keys';
        } else if (error.message?.includes('permission')) {
          enhancedSuggestion = 'You may not have permission to view this idea';
        }

        logger.error('Failed to get idea', { error: error.message, ideaIdOrKey: params.ideaIdOrKey });
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_IDEA_ERROR',
                message: error.message,
                suggestion: enhancedSuggestion,
                related_tools: ['get_ideas', 'search_ideas'],
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: create_idea (Create Tool)
  server.registerTool(
    'create_idea',
    {
      title: 'Create Idea',
      description: '🆕 CREATE: Create a new idea in a JPD project. Requires project key and summary. Use "get_jpd_projects" to find valid project keys.',
      inputSchema: createIdeaInputSchema as any,
      annotations: {
        title: 'Create Idea',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = createIdeaSchema.parse(params);

        // Build the idea fields object for Jira API
        const fields: Record<string, any> = {
          project: { key: validatedParams.projectKey },
          issuetype: { name: validatedParams.issueType || 'Idea' },
          summary: validatedParams.summary,
        };

        // Add optional description - convert to ADF if plain text
        if (validatedParams.description) {
          const descStr = validatedParams.description;
          if (descStr.trim().startsWith('{') && descStr.includes('"type"') && descStr.includes('"doc"')) {
            try {
              fields.description = JSON.parse(descStr);
            } catch {
              fields.description = {
                type: 'doc',
                version: 1,
                content: [{
                  type: 'paragraph',
                  content: [{ type: 'text' as const, text: descStr }]
                }]
              };
            }
          } else {
            fields.description = {
              type: 'doc',
              version: 1,
              content: [{
                type: 'paragraph',
                content: [{ type: 'text' as const, text: descStr }]
              }]
            };
          }
        }

        if (validatedParams.assignee) {
          fields.assignee = { accountId: validatedParams.assignee };
        }
        if (validatedParams.priority) {
          fields.priority = { name: validatedParams.priority };
        }
        if (validatedParams.labels && validatedParams.labels.length > 0) {
          fields.labels = validatedParams.labels;
        }

        // Add custom fields
        if (validatedParams.customFields) {
          for (const [fieldId, value] of Object.entries(validatedParams.customFields)) {
            fields[fieldId] = value;
          }
        }

        const response = await apiClient.makeRequest<JiraCreateIssueResponse>({
          method: 'POST',
          path: '/issue',
          data: { fields },
        });

        if (response.success && response.data) {
          logger.info('Idea created successfully', {
            ideaKey: response.data.key,
            ideaId: response.data.id,
          });

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                idea: {
                  id: response.data.id,
                  key: response.data.key,
                  self: response.data.self,
                },
                message: `Idea ${response.data.key} created successfully in project ${validatedParams.projectKey}`,
                usage_guidance: `Idea has been created. Now you can add insights (evidence) to support it, or set prioritization scores.`,
                suggested_next_steps: [
                  `Use "get_idea" with ideaIdOrKey="${response.data.key}" to view full details`,
                  `Use "create_insight" to add supporting evidence`,
                  `Use "update_idea" to modify the idea`,
                ],
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to create idea: No data returned');
      } catch (error: any) {
        let suggestion = 'Check project key, issue type, and required fields';

        if (error.message?.includes('project')) {
          suggestion = 'Verify the project key exists. Use "get_jpd_projects" to find valid keys';
        } else if (error.message?.includes('issuetype') || error.message?.includes('issue type')) {
          suggestion = 'Issue type "Idea" may not exist in this project. Check project configuration';
        } else if (error.message?.includes('permission')) {
          suggestion = 'You may not have permission to create ideas in this project';
        } else if (error.message?.includes('required')) {
          suggestion = 'Missing required field. Check the project\'s required fields configuration';
        }

        logger.error('Failed to create idea', { error: error.message });
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'CREATE_IDEA_ERROR',
                message: error.message,
                suggestion,
                workflow_guidance: 'Proper workflow: get_jpd_projects → create_idea',
                related_tools: ['get_jpd_projects'],
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: update_idea (Update Tool)
  server.registerTool(
    'update_idea',
    {
      title: 'Update Idea',
      description: '✏️ UPDATE: Update fields on an existing idea. Only specified fields will be modified. Use "get_idea" first to see current values.',
      inputSchema: updateIdeaInputSchema as any,
      annotations: {
        title: 'Update Idea',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = updateIdeaSchema.parse(params);
        const { ideaIdOrKey, customFields, ...updateFields } = validatedParams;

        // Build update payload
        const fields: Record<string, any> = {};

        if (updateFields.summary !== undefined) {
          fields.summary = updateFields.summary;
        }

        if (updateFields.description !== undefined) {
          const descStr = updateFields.description;
          if (descStr.trim().startsWith('{') && descStr.includes('"type"') && descStr.includes('"doc"')) {
            try {
              fields.description = JSON.parse(descStr);
            } catch {
              fields.description = {
                type: 'doc',
                version: 1,
                content: [{
                  type: 'paragraph',
                  content: [{ type: 'text' as const, text: descStr }]
                }]
              };
            }
          } else {
            fields.description = {
              type: 'doc',
              version: 1,
              content: [{
                type: 'paragraph',
                content: [{ type: 'text' as const, text: descStr }]
              }]
            };
          }
        }

        if (updateFields.assignee !== undefined) {
          fields.assignee = updateFields.assignee === null ? null : { accountId: updateFields.assignee };
        }
        if (updateFields.priority !== undefined) {
          fields.priority = { name: updateFields.priority };
        }
        if (updateFields.labels !== undefined) {
          fields.labels = updateFields.labels;
        }

        // Add custom fields
        if (customFields) {
          for (const [fieldId, value] of Object.entries(customFields)) {
            fields[fieldId] = value;
          }
        }

        const response = await apiClient.makeRequest<void>({
          method: 'PUT',
          path: `/issue/${ideaIdOrKey}`,
          data: { fields },
        });

        if (response.success) {
          logger.info('Idea updated successfully', { ideaKey: ideaIdOrKey });

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                ideaIdOrKey,
                updatedFields: Object.keys(fields),
                message: `Idea ${ideaIdOrKey} updated successfully`,
                suggested_next_steps: [
                  `Use "get_idea" with ideaIdOrKey="${ideaIdOrKey}" to verify changes`,
                ],
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to update idea');
      } catch (error: any) {
        let suggestion = 'Verify the idea exists and you have edit permissions';

        if (error.message?.includes('not found')) {
          suggestion = 'Idea not found. Verify the idea key is correct';
        } else if (error.message?.includes('permission')) {
          suggestion = 'You may not have permission to edit this idea';
        } else if (error.message?.includes('required')) {
          suggestion = 'A required field is missing or invalid';
        }

        logger.error('Failed to update idea', { error: error.message, ideaIdOrKey: params.ideaIdOrKey });
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'UPDATE_IDEA_ERROR',
                message: error.message,
                suggestion,
                workflow_guidance: 'Use "get_idea" first to verify the idea exists and see current values',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: delete_idea (Delete Tool)
  server.registerTool(
    'delete_idea',
    {
      title: 'Delete Idea',
      description: '🗑️ DELETE: Permanently delete an idea and all its associated insights. This action cannot be undone. Use with extreme caution.',
      inputSchema: deleteIdeaInputSchema as any,
      annotations: {
        title: 'Delete Idea',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = deleteIdeaSchema.parse(params);

        const response = await apiClient.makeRequest<void>({
          method: 'DELETE',
          path: `/issue/${validatedParams.ideaIdOrKey}`,
        });

        if (response.success) {
          logger.info('Idea deleted successfully', { ideaKey: validatedParams.ideaIdOrKey });

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                deletedIdea: validatedParams.ideaIdOrKey,
                message: `Idea ${validatedParams.ideaIdOrKey} has been permanently deleted`,
                warning: 'This action cannot be undone. All associated insights have also been deleted.',
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to delete idea');
      } catch (error: any) {
        let suggestion = 'Verify the idea exists and you have delete permissions';

        if (error.message?.includes('not found')) {
          suggestion = 'Idea not found. It may have already been deleted';
        } else if (error.message?.includes('permission')) {
          suggestion = 'You may not have permission to delete this idea';
        }

        logger.error('Failed to delete idea', { error: error.message, ideaIdOrKey: params.ideaIdOrKey });
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'DELETE_IDEA_ERROR',
                message: error.message,
                suggestion,
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );
}
