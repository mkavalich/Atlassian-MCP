import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { JiraApiClient } from '../api/client.js';
import {
  getBoardsSchema,
  getBoardSchema,
  getBoardConfigurationSchema,
  getBoardBacklogSchema,
  createBoardSchema,
  deleteBoardSchema,
  getSprintsForBoardSchema,
  createSprintSchema,
  getSprintSchema,
  updateSprintSchema,
  deleteSprintSchema,
  getSprintIssuesSchema,
  moveIssuesToSprintSchema,
  moveIssuesToBacklogSchema,
} from '../validation/schemas.js';
import {
  getBoardsInputSchema,
  getBoardInputSchema,
  getBoardConfigurationInputSchema,
  getBoardBacklogInputSchema,
  createBoardInputSchema,
  deleteBoardInputSchema,
  getSprintsForBoardInputSchema,
  createSprintInputSchema,
  getSprintInputSchema,
  updateSprintInputSchema,
  deleteSprintInputSchema,
  getSprintIssuesInputSchema,
  moveIssuesToSprintInputSchema,
  moveIssuesToBacklogInputSchema,
} from '../validation/input-schemas.js';
import {
  JiraBoard,
  JiraBoardPage,
  JiraBoardConfiguration,
  JiraSprint,
  JiraSprintPage,
  JiraAgileIssuePage,
} from '../types/index.js';
import { sanitizeErrorMessage } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { wrapUserContent } from '../utils/sanitize.js';
import { toolExamples } from '../validation/tool-examples.js';

const AGILE_API_BASE = '/rest/agile/1.0';

/**
 * Wrap user-generated content (summary/description) in issue fields with
 * boundary markers to defend against prompt injection (F-008).
 */
function sanitizeAgileIssueFields(issue: any): any {
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

export async function registerAgileTools(server: McpServer, apiClient: JiraApiClient) {
  // =====================
  // Board Tools
  // =====================

  // Tool: get_boards
  server.registerTool(
    'get_boards',
    {
      title: 'Get Boards',
      description: `🔍 DISCOVERY TOOL: Primary discovery method for Agile operations. Use this first to find board IDs before working with sprints or backlogs.

Returns board ID, name, type (scrum/kanban), and associated project. Only Scrum boards have sprints - Kanban boards use continuous flow.

**Common workflow:**
1. get_boards → find board ID
2. For Scrum: get_sprints_for_board → find sprint IDs
3. For Kanban: get_board_backlog → see backlog issues`,
      inputSchema: getBoardsInputSchema,
      annotations: {
        title: 'Get Boards',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = getBoardsSchema.parse(params);

        const queryParams: Record<string, any> = {
          startAt: validatedParams.startAt,
          maxResults: validatedParams.maxResults,
        };

        if (validatedParams.type) queryParams.type = validatedParams.type;
        if (validatedParams.name) queryParams.name = validatedParams.name;
        if (validatedParams.projectKeyOrId) queryParams.projectKeyOrId = validatedParams.projectKeyOrId;

        const response = await apiClient.makeRequest<JiraBoardPage>({
          method: 'GET',
          path: '/board',
          params: queryParams,
          apiBase: AGILE_API_BASE,
        });

        if (response.success && response.data) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                boards: response.data.values,
                pagination: {
                  startAt: response.data.startAt,
                  maxResults: response.data.maxResults,
                  total: response.data.total,
                  isLast: response.data.isLast,
                },
                usage_hints: {
                  scrum_boards: 'Scrum boards have sprints. Use get_sprints_for_board with the board ID.',
                  kanban_boards: 'Kanban boards use the backlog. Use get_board_backlog for issues.',
                },
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get boards');
      } catch (error: any) {
        logger.error('Failed to get boards', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: sanitizeErrorMessage(error.message) || 'Failed to get boards',
              code: error.code || 'BOARD_FETCH_ERROR',
              suggestion: 'Check that you have access to Jira Software projects',
            }, null, 2),
          }],
        };
      }
    }
  );

  // Tool: get_board
  server.registerTool(
    'get_board',
    {
      title: 'Get Board',
      description: 'Get details of a specific Jira Software board by ID.',
      inputSchema: getBoardInputSchema,
      annotations: {
        title: 'Get Board',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = getBoardSchema.parse(params);

        const response = await apiClient.makeRequest<JiraBoard>({
          method: 'GET',
          path: `/board/${validatedParams.boardId}`,
          apiBase: AGILE_API_BASE,
        });

        if (response.success && response.data) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                board: response.data,
                next_steps: response.data.type === 'scrum'
                  ? ['Use get_sprints_for_board to see sprints', 'Use get_board_configuration for column settings']
                  : ['Use get_board_backlog to see issues', 'Use get_board_configuration for column settings'],
              }, null, 2),
            }],
          };
        }

        throw new Error('Board not found');
      } catch (error: any) {
        logger.error('Failed to get board', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: sanitizeErrorMessage(error.message) || 'Failed to get board',
              code: error.code || 'BOARD_NOT_FOUND',
              suggestion: 'Use get_boards to find valid board IDs',
            }, null, 2),
          }],
        };
      }
    }
  );

  // Tool: get_board_configuration
  server.registerTool(
    'get_board_configuration',
    {
      title: 'Get Board Configuration',
      description: 'Get the configuration of a board including columns, estimation settings, and filters.',
      inputSchema: getBoardConfigurationInputSchema,
      annotations: {
        title: 'Get Board Configuration',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = getBoardConfigurationSchema.parse(params);

        const response = await apiClient.makeRequest<JiraBoardConfiguration>({
          method: 'GET',
          path: `/board/${validatedParams.boardId}/configuration`,
          apiBase: AGILE_API_BASE,
        });

        if (response.success && response.data) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                configuration: response.data,
              }, null, 2),
            }],
          };
        }

        throw new Error('Board configuration not found');
      } catch (error: any) {
        logger.error('Failed to get board configuration', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: sanitizeErrorMessage(error.message) || 'Failed to get board configuration',
              code: error.code || 'CONFIG_FETCH_ERROR',
              suggestion: 'Verify the board ID exists using get_boards',
            }, null, 2),
          }],
        };
      }
    }
  );

  // Tool: get_board_backlog
  server.registerTool(
    'get_board_backlog',
    {
      title: 'Get Board Backlog',
      description: `Get issues from the backlog of a Scrum board. Returns issues not yet assigned to any sprint.

⚠️ NOTE: This endpoint works best with Scrum boards. Kanban boards may return errors or empty results since they don't have a traditional backlog. For Kanban boards, use search_jql with the board's filter instead.`,
      inputSchema: getBoardBacklogInputSchema,
      annotations: {
        title: 'Get Board Backlog',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = getBoardBacklogSchema.parse(params);

        const queryParams: Record<string, any> = {
          startAt: validatedParams.startAt,
          maxResults: validatedParams.maxResults,
        };

        if (validatedParams.jql) queryParams.jql = validatedParams.jql;
        if (validatedParams.fields) queryParams.fields = validatedParams.fields.join(',');

        const response = await apiClient.makeRequest<JiraAgileIssuePage>({
          method: 'GET',
          path: `/board/${validatedParams.boardId}/backlog`,
          params: queryParams,
          apiBase: AGILE_API_BASE,
        });

        if (response.success && response.data) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                issues: (response.data.issues || []).map(sanitizeAgileIssueFields),
                pagination: {
                  startAt: response.data.startAt,
                  maxResults: response.data.maxResults,
                  total: response.data.total,
                },
                next_steps: [
                  'Use move_issues_to_sprint to add issues to a sprint',
                  'Use get_sprints_for_board to find available sprints',
                ],
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get backlog');
      } catch (error: any) {
        logger.error('Failed to get board backlog', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: sanitizeErrorMessage(error.message) || 'Failed to get backlog',
              code: error.code || 'BACKLOG_FETCH_ERROR',
              suggestion: 'Verify the board ID exists using get_boards',
            }, null, 2),
          }],
        };
      }
    }
  );

  // Tool: create_board
  server.registerTool(
    'create_board',
    {
      title: 'Create Board',
      description: `⚠️ PREREQUISITE: Use "create_filter" in jira-system-admin FIRST to create a JQL filter, then use the returned filter ID here.

Create a new Scrum or Kanban board. The board displays issues matching the filter's JQL query.

**Typical workflow:**
1. create_filter (jira-system-admin) with JQL like "project = PROJ ORDER BY rank"
2. create_board with the returned filterId
3. For Scrum boards: create_sprint to add sprints

**Board types:**
- **scrum**: Enables sprints, backlog, and velocity tracking
- **kanban**: Continuous flow with WIP limits, no sprints`,
      inputSchema: createBoardInputSchema,
      annotations: {
        title: 'Create Board',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = createBoardSchema.parse(params);

        const boardData: Record<string, any> = {
          name: validatedParams.name,
          type: validatedParams.type,
          filterId: validatedParams.filterId,
        };

        if (validatedParams.projectKeyOrId) {
          boardData.location = {
            type: 'project',
            projectKeyOrId: validatedParams.projectKeyOrId,
          };
        }

        const response = await apiClient.makeRequest<JiraBoard>({
          method: 'POST',
          path: '/board',
          data: boardData,
          apiBase: AGILE_API_BASE,
        });

        if (response.success && response.data) {
          logger.info('Board created successfully', { boardId: response.data.id, name: response.data.name });
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                board: response.data,
                message: `Board "${response.data.name}" created successfully`,
                next_steps: response.data.type === 'scrum'
                  ? [
                      'Use create_sprint to create sprints on this board',
                      'Use get_board_backlog to see issues in the backlog',
                    ]
                  : [
                      'Use get_board_backlog to see issues in the backlog',
                      'Use get_board_configuration to see column settings',
                    ],
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to create board');
      } catch (error: any) {
        logger.error('Failed to create board', { error: error.message });

        let suggestion = 'Check that filterId is valid and you have permission to create boards';
        if (error.message?.includes('filter')) {
          suggestion = 'The filter ID is invalid or you do not have access to it. Use create_filter in jira-system-admin first.';
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: sanitizeErrorMessage(error.message) || 'Failed to create board',
              code: error.code || 'BOARD_CREATE_ERROR',
              suggestion,
              prerequisite: 'Use create_filter in jira-system-admin to create a JQL filter first',
            }, null, 2),
          }],
        };
      }
    }
  );

  // Tool: delete_board
  server.registerTool(
    'delete_board',
    {
      title: 'Delete Board',
      description: `⚠️ DESTRUCTIVE: Permanently delete a board. This removes the board view but does NOT delete any issues - they remain in the project.

The associated JQL filter is also NOT deleted automatically.`,
      inputSchema: deleteBoardInputSchema,
      annotations: {
        title: 'Delete Board',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = deleteBoardSchema.parse(params);

        await apiClient.makeRequest<void>({
          method: 'DELETE',
          path: `/board/${validatedParams.boardId}`,
          apiBase: AGILE_API_BASE,
        });

        logger.info('Board deleted successfully', { boardId: validatedParams.boardId });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Board ${validatedParams.boardId} deleted successfully. Issues were not affected.`,
            }, null, 2),
          }],
        };
      } catch (error: any) {
        logger.error('Failed to delete board', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: sanitizeErrorMessage(error.message) || 'Failed to delete board',
              code: error.code || 'BOARD_DELETE_ERROR',
              suggestion: 'Check board ID and ensure you have permission to delete boards',
            }, null, 2),
          }],
        };
      }
    }
  );

  // =====================
  // Sprint Tools
  // =====================

  // Tool: get_sprints_for_board
  server.registerTool(
    'get_sprints_for_board',
    {
      title: 'Get Sprints for Board',
      description: `🔍 DISCOVERY TOOL: List all sprints for a Scrum board. Use this to discover sprint IDs before moving issues or managing sprints.

⚠️ PREREQUISITE: Use "get_boards" first to find valid board IDs. Only Scrum boards have sprints (not Kanban).

Filter by state to find relevant sprints:
- **future**: Planned sprints not yet started
- **active**: Currently running sprint (usually only one)
- **closed**: Completed sprints (for historical reference)`,
      inputSchema: getSprintsForBoardInputSchema,
      annotations: {
        title: 'Get Sprints for Board',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = getSprintsForBoardSchema.parse(params);

        const queryParams: Record<string, any> = {
          startAt: validatedParams.startAt,
          maxResults: validatedParams.maxResults,
        };

        if (validatedParams.state) queryParams.state = validatedParams.state;

        const response = await apiClient.makeRequest<JiraSprintPage>({
          method: 'GET',
          path: `/board/${validatedParams.boardId}/sprint`,
          params: queryParams,
          apiBase: AGILE_API_BASE,
        });

        if (response.success && response.data) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                sprints: response.data.values,
                pagination: {
                  startAt: response.data.startAt,
                  maxResults: response.data.maxResults,
                  total: response.data.total,
                  isLast: response.data.isLast,
                },
                usage_hints: {
                  active_sprint: 'Issues can be added to future or active sprints',
                  closed_sprints: 'Closed sprints are read-only',
                },
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get sprints');
      } catch (error: any) {
        logger.error('Failed to get sprints', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: sanitizeErrorMessage(error.message) || 'Failed to get sprints',
              code: error.code || 'SPRINT_FETCH_ERROR',
              suggestion: 'Ensure this is a Scrum board (not Kanban). Use get_boards to verify board type.',
            }, null, 2),
          }],
        };
      }
    }
  );

  // Tool: create_sprint
  server.registerTool(
    'create_sprint',
    {
      title: 'Create Sprint',
      description: `⚠️ PREREQUISITE: Use "get_boards" first to find a valid Scrum board ID.

Create a new sprint on a Scrum board. Sprints are created in "future" state by default.

**Workflow after creation:**
1. Use move_issues_to_sprint to add issues from backlog
2. Use update_sprint with state="active" to start the sprint (requires start/end dates)
3. When complete, use update_sprint with state="closed" to finish`,
      inputSchema: createSprintInputSchema,
      annotations: {
        title: 'Create Sprint',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      examples: toolExamples['create_sprint'],
    },
    async (params) => {
      try {
        const validatedParams = createSprintSchema.parse(params);

        const sprintData: Record<string, any> = {
          name: validatedParams.name,
          originBoardId: validatedParams.originBoardId,
        };

        if (validatedParams.goal) sprintData.goal = validatedParams.goal;
        if (validatedParams.startDate) sprintData.startDate = validatedParams.startDate;
        if (validatedParams.endDate) sprintData.endDate = validatedParams.endDate;

        const response = await apiClient.makeRequest<JiraSprint>({
          method: 'POST',
          path: '/sprint',
          data: sprintData,
          apiBase: AGILE_API_BASE,
        });

        if (response.success && response.data) {
          logger.info('Sprint created successfully', { sprintId: response.data.id, name: response.data.name });
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                sprint: response.data,
                message: `Sprint "${response.data.name}" created successfully`,
                next_steps: [
                  'Use move_issues_to_sprint to add issues',
                  'Use update_sprint with state="active" to start the sprint',
                ],
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to create sprint');
      } catch (error: any) {
        logger.error('Failed to create sprint', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: sanitizeErrorMessage(error.message) || 'Failed to create sprint',
              code: error.code || 'SPRINT_CREATE_ERROR',
              suggestion: 'Ensure the board is a Scrum board and you have permissions to manage sprints',
            }, null, 2),
          }],
        };
      }
    }
  );

  // Tool: get_sprint
  server.registerTool(
    'get_sprint',
    {
      title: 'Get Sprint',
      description: 'Get details of a specific sprint by ID.',
      inputSchema: getSprintInputSchema,
      annotations: {
        title: 'Get Sprint',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = getSprintSchema.parse(params);

        const response = await apiClient.makeRequest<JiraSprint>({
          method: 'GET',
          path: `/sprint/${validatedParams.sprintId}`,
          apiBase: AGILE_API_BASE,
        });

        if (response.success && response.data) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                sprint: response.data,
              }, null, 2),
            }],
          };
        }

        throw new Error('Sprint not found');
      } catch (error: any) {
        logger.error('Failed to get sprint', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: sanitizeErrorMessage(error.message) || 'Failed to get sprint',
              code: error.code || 'SPRINT_NOT_FOUND',
              suggestion: 'Use get_sprints_for_board to find valid sprint IDs',
            }, null, 2),
          }],
        };
      }
    }
  );

  // Tool: update_sprint
  server.registerTool(
    'update_sprint',
    {
      title: 'Update Sprint',
      description: `⚠️ PREREQUISITE: Use "get_sprints_for_board" to find sprint ID.

Update sprint details including name, dates, goal, or state.

**State transitions (must follow this order):**
- future → active: Starts the sprint. Requires startDate and endDate.
- active → closed: Completes the sprint. All incomplete issues move to backlog or next sprint.

⚠️ Cannot skip states or go backwards. Only one sprint can be active at a time.`,
      inputSchema: updateSprintInputSchema,
      annotations: {
        title: 'Update Sprint',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = updateSprintSchema.parse(params);

        const updateData: Record<string, any> = {};
        if (validatedParams.name) updateData.name = validatedParams.name;
        if (validatedParams.goal !== undefined) updateData.goal = validatedParams.goal;
        if (validatedParams.startDate) updateData.startDate = validatedParams.startDate;
        if (validatedParams.endDate) updateData.endDate = validatedParams.endDate;
        if (validatedParams.state) updateData.state = validatedParams.state;
        if (validatedParams.completeDate) updateData.completeDate = validatedParams.completeDate;

        const response = await apiClient.makeRequest<JiraSprint>({
          method: 'PUT',
          path: `/sprint/${validatedParams.sprintId}`,
          data: updateData,
          apiBase: AGILE_API_BASE,
        });

        if (response.success && response.data) {
          logger.info('Sprint updated successfully', { sprintId: response.data.id });
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                sprint: response.data,
                message: `Sprint "${response.data.name}" updated successfully`,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to update sprint');
      } catch (error: any) {
        logger.error('Failed to update sprint', { error: error.message });

        let suggestion = 'Check sprint ID and update parameters';
        if (error.message?.includes('state')) {
          suggestion = 'Sprints must progress: future -> active -> closed. Cannot skip states or go backwards.';
        }
        if (error.message?.includes('date')) {
          suggestion = 'Start and end dates are required to activate a sprint.';
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: sanitizeErrorMessage(error.message) || 'Failed to update sprint',
              code: error.code || 'SPRINT_UPDATE_ERROR',
              suggestion,
            }, null, 2),
          }],
        };
      }
    }
  );

  // Tool: delete_sprint
  server.registerTool(
    'delete_sprint',
    {
      title: 'Delete Sprint',
      description: 'Delete a sprint. Issues in the sprint will be moved to the backlog. This action cannot be undone.',
      inputSchema: deleteSprintInputSchema,
      annotations: {
        title: 'Delete Sprint',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = deleteSprintSchema.parse(params);

        await apiClient.makeRequest<void>({
          method: 'DELETE',
          path: `/sprint/${validatedParams.sprintId}`,
          apiBase: AGILE_API_BASE,
        });

        logger.info('Sprint deleted successfully', { sprintId: validatedParams.sprintId });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Sprint ${validatedParams.sprintId} deleted. Issues have been moved to backlog.`,
            }, null, 2),
          }],
        };
      } catch (error: any) {
        logger.error('Failed to delete sprint', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: sanitizeErrorMessage(error.message) || 'Failed to delete sprint',
              code: error.code || 'SPRINT_DELETE_ERROR',
              suggestion: 'Check sprint ID and ensure you have permission to delete sprints',
            }, null, 2),
          }],
        };
      }
    }
  );

  // Tool: get_sprint_issues
  server.registerTool(
    'get_sprint_issues',
    {
      title: 'Get Sprint Issues',
      description: 'Get all issues in a specific sprint. Useful for sprint reviews and tracking progress.',
      inputSchema: getSprintIssuesInputSchema,
      annotations: {
        title: 'Get Sprint Issues',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = getSprintIssuesSchema.parse(params);

        const queryParams: Record<string, any> = {
          startAt: validatedParams.startAt,
          maxResults: validatedParams.maxResults,
        };

        if (validatedParams.jql) queryParams.jql = validatedParams.jql;
        if (validatedParams.fields) queryParams.fields = validatedParams.fields.join(',');

        const response = await apiClient.makeRequest<JiraAgileIssuePage>({
          method: 'GET',
          path: `/sprint/${validatedParams.sprintId}/issue`,
          params: queryParams,
          apiBase: AGILE_API_BASE,
        });

        if (response.success && response.data) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                issues: (response.data.issues || []).map(sanitizeAgileIssueFields),
                pagination: {
                  startAt: response.data.startAt,
                  maxResults: response.data.maxResults,
                  total: response.data.total,
                },
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get sprint issues');
      } catch (error: any) {
        logger.error('Failed to get sprint issues', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: sanitizeErrorMessage(error.message) || 'Failed to get sprint issues',
              code: error.code || 'SPRINT_ISSUES_ERROR',
              suggestion: 'Use get_sprints_for_board to find valid sprint IDs',
            }, null, 2),
          }],
        };
      }
    }
  );

  // Tool: move_issues_to_sprint
  server.registerTool(
    'move_issues_to_sprint',
    {
      title: 'Move Issues to Sprint',
      description: `⚠️ MULTIPLE PREREQUISITES:
1. Use "get_boards" to find board ID
2. Use "get_sprints_for_board" to find sprint ID
3. Use "get_board_backlog" or "search_jql" to find issue keys

Move issues into a sprint from backlog or other sprints. Only works with future or active sprints - closed sprints cannot accept new issues.`,
      inputSchema: moveIssuesToSprintInputSchema,
      annotations: {
        title: 'Move Issues to Sprint',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = moveIssuesToSprintSchema.parse(params);

        const moveData: Record<string, any> = {
          issues: validatedParams.issues,
        };

        if (validatedParams.rankBefore) moveData.rankBeforeIssue = validatedParams.rankBefore;
        if (validatedParams.rankAfter) moveData.rankAfterIssue = validatedParams.rankAfter;

        await apiClient.makeRequest<void>({
          method: 'POST',
          path: `/sprint/${validatedParams.sprintId}/issue`,
          data: moveData,
          apiBase: AGILE_API_BASE,
        });

        logger.info('Issues moved to sprint', { sprintId: validatedParams.sprintId, count: validatedParams.issues.length });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `${validatedParams.issues.length} issue(s) moved to sprint ${validatedParams.sprintId}`,
              issues: validatedParams.issues,
            }, null, 2),
          }],
        };
      } catch (error: any) {
        logger.error('Failed to move issues to sprint', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: sanitizeErrorMessage(error.message) || 'Failed to move issues to sprint',
              code: error.code || 'MOVE_ISSUES_ERROR',
              suggestion: 'Ensure the sprint is not closed and all issue keys are valid',
            }, null, 2),
          }],
        };
      }
    }
  );

  // Tool: move_issues_to_backlog
  server.registerTool(
    'move_issues_to_backlog',
    {
      title: 'Move Issues to Backlog',
      description: 'Move issues from any sprint back to the backlog. Removes them from their current sprint.',
      inputSchema: moveIssuesToBacklogInputSchema,
      annotations: {
        title: 'Move Issues to Backlog',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = moveIssuesToBacklogSchema.parse(params);

        await apiClient.makeRequest<void>({
          method: 'POST',
          path: '/backlog/issue',
          data: {
            issues: validatedParams.issues,
          },
          apiBase: AGILE_API_BASE,
        });

        logger.info('Issues moved to backlog', { count: validatedParams.issues.length });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `${validatedParams.issues.length} issue(s) moved to backlog`,
              issues: validatedParams.issues,
            }, null, 2),
          }],
        };
      } catch (error: any) {
        logger.error('Failed to move issues to backlog', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: sanitizeErrorMessage(error.message) || 'Failed to move issues to backlog',
              code: error.code || 'MOVE_BACKLOG_ERROR',
              suggestion: 'Ensure all issue keys are valid and you have permissions to modify them',
            }, null, 2),
          }],
        };
      }
    }
  );
}
