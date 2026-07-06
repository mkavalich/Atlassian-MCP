import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { JiraApiClient } from '../api/client.js';
import { getJpdProjectsSchema } from '../validation/schemas.js';
import { getJpdProjectsInputSchema } from '../validation/input-schemas.js';
import { JpdProject } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { sanitizeErrorMessage } from '../utils/errors.js';

// Tool catalog for progressive disclosure (11 tools - 4 removed for Polaris GraphQL API limitations)
const toolCatalog = [
  // Discovery
  { name: 'search_tools', category: 'discovery', type: 'discovery', description: 'Search and discover available JPD tools' },
  { name: 'get_jpd_projects', category: 'projects', type: 'discovery', description: 'List Jira Product Discovery projects' },
  // Ideas (REST)
  { name: 'get_ideas', category: 'ideas', type: 'discovery', description: 'List ideas in a JPD project' },
  { name: 'search_ideas', category: 'ideas', type: 'discovery', description: 'Search ideas using JQL' },
  { name: 'get_idea', category: 'ideas', type: 'read', description: 'Get details of a specific idea' },
  { name: 'create_idea', category: 'ideas', type: 'create', description: 'Create a new idea in a JPD project' },
  { name: 'update_idea', category: 'ideas', type: 'update', description: 'Update an existing idea' },
  { name: 'delete_idea', category: 'ideas', type: 'delete', description: 'Delete an idea permanently' },
  // Insights (GraphQL) - REMOVED: get_insight, create_insight, update_insight, delete_insight (Polaris GraphQL schema undocumented)
  { name: 'get_insights', category: 'insights', type: 'discovery', description: 'List insights attached to an idea' },
  // Analysis (GraphQL)
  { name: 'analyze_idea_insights', category: 'analysis', type: 'read', description: 'Aggregate analysis of idea insights' },
  { name: 'get_idea_scoring', category: 'analysis', type: 'read', description: 'Get impact/effort/confidence scores' },
];

export async function registerDiscoveryTools(server: McpServer, apiClient: JiraApiClient) {
  // Tool: search_tools (Meta Discovery Tool)
  server.registerTool(
    'search_tools',
    {
      title: 'Search JPD Tools',
      description: '🔍 META DISCOVERY: Find available Jira Product Discovery tools by category or capability. Start here to understand what operations are available. Categories: projects, ideas, insights, analysis. Types: discovery, read, create, update, delete.',
      inputSchema: {
        category: z.enum(['projects', 'ideas', 'insights', 'analysis', 'all']).optional()
          .describe('Filter by category: "projects", "ideas", "insights", "analysis", or "all"'),
        type: z.enum(['discovery', 'read', 'create', 'update', 'delete', 'all']).optional()
          .describe('Filter by operation type: "discovery", "read", "create", "update", "delete", or "all"'),
        query: z.string().optional()
          .describe('Search tool names and descriptions'),
      } as any,
      annotations: {
        title: 'Search JPD Tools',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: { category?: string; type?: string; query?: string }) => {
      try {
        let filteredTools = [...toolCatalog];

        // Filter by category
        if (params.category && params.category !== 'all') {
          filteredTools = filteredTools.filter(t => t.category === params.category);
        }

        // Filter by type
        if (params.type && params.type !== 'all') {
          filteredTools = filteredTools.filter(t => t.type === params.type);
        }

        // Filter by search query
        if (params.query) {
          const query = params.query.toLowerCase();
          filteredTools = filteredTools.filter(t =>
            t.name.toLowerCase().includes(query) ||
            t.description.toLowerCase().includes(query)
          );
        }

        // Group tools by category for better organization
        const grouped = filteredTools.reduce((acc, tool) => {
          if (!acc[tool.category]) {
            acc[tool.category] = [];
          }
          acc[tool.category].push(tool);
          return acc;
        }, {} as Record<string, typeof filteredTools>);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              tools: filteredTools,
              groupedByCategory: grouped,
              count: filteredTools.length,
              categories: [...new Set(toolCatalog.map(t => t.category))],
              types: [...new Set(toolCatalog.map(t => t.type))],
              usage_guidance: filteredTools.length > 0
                ? `Found ${filteredTools.length} tool(s). Recommended workflow: 1) Use "get_jpd_projects" to find JPD projects, 2) Use "get_ideas" to list ideas, 3) Use "get_insights" or "get_idea_scoring" for deeper analysis.`
                : 'No tools matched your criteria. Try broader filters or search.',
              getting_started: [
                '1. Start with "get_jpd_projects" to find Product Discovery projects',
                '2. Use "get_ideas" with a project key to list ideas',
                '3. Use "get_insights" to see customer feedback and evidence',
                '4. Use "get_idea_scoring" to see prioritization scores',
              ],
            }, null, 2),
          }],
        };
      } catch (error: any) {
        logger.error('Failed to search tools', { error: error.message });
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: 'SEARCH_TOOLS_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: 'Try with different filter parameters',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: get_jpd_projects (Discovery Tool)
  server.registerTool(
    'get_jpd_projects',
    {
      title: 'Get JPD Projects',
      description: '🔍 DISCOVERY: List all Jira Product Discovery projects. Use this first to find project keys before working with ideas and insights. Returns projects with projectTypeKey="product_discovery".',
      inputSchema: getJpdProjectsInputSchema as any,
      annotations: {
        title: 'Get JPD Projects',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = getJpdProjectsSchema.parse(params);
        const { fields, ...apiParams } = validatedParams;

        // Search for projects with product_discovery type
        const queryParams: Record<string, any> = {
          ...apiParams,
          typeKey: 'product_discovery',
        };

        // If query provided, add it as a search filter
        if (validatedParams.query) {
          queryParams.query = validatedParams.query;
        }

        const response = await apiClient.makeRequest<{ values: JpdProject[]; total: number; isLast: boolean }>({
          method: 'GET',
          path: '/project/search',
          params: queryParams,
        });

        if (response.success && response.data) {
          // Apply field selection for token efficiency
          const projects = fields === 'summary'
            ? response.data.values.map(p => ({
                id: p.id,
                key: p.key,
                name: p.name,
                projectTypeKey: p.projectTypeKey,
              }))
            : response.data.values;

          const hasMore = !response.data.isLast;
          const startAt = validatedParams.startAt || 0;
          const maxResults = validatedParams.maxResults || 20;

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                projects,
                pagination: {
                  total: response.data.total,
                  count: projects.length,
                  startAt,
                  maxResults,
                  hasMore,
                  nextStartAt: hasMore ? startAt + projects.length : null,
                },
                fieldsMode: fields,
                usage_guidance: projects.length > 0
                  ? `Found ${projects.length} of ${response.data.total} JPD project(s).${hasMore ? ' Use startAt=' + (startAt + projects.length) + ' for next page.' : ''} Use "get_ideas" with a project key to list ideas.`
                  : 'No JPD projects found. This instance may not have Product Discovery enabled, or you may lack access permissions.',
                suggested_next_steps: projects.length > 0
                  ? [
                      `Use "get_ideas" with projectKey="${projects[0].key}" to list ideas`,
                      `Use "search_ideas" to find specific ideas via JQL`,
                    ]
                  : [
                      'Check if Jira Product Discovery is enabled for your instance',
                      'Verify you have access to JPD projects',
                    ],
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get JPD projects: No data returned');
      } catch (error: any) {
        let enhancedSuggestion = 'Ensure you have permission to view projects';
        let nextSteps: string[] = [];

        if (error.message?.includes('not found') || error.message?.includes('NOT_FOUND')) {
          enhancedSuggestion = 'No JPD projects found in this instance';
          nextSteps = [
            '1. Verify Jira Product Discovery is enabled',
            '2. Check your project permissions',
            '3. Contact your Jira administrator',
          ];
        } else if (error.message?.includes('permission') || error.message?.includes('FORBIDDEN')) {
          enhancedSuggestion = 'Insufficient permissions to view JPD projects';
          nextSteps = [
            '1. Verify you have Browse Projects permissions',
            '2. Contact your Jira administrator for access',
          ];
        }

        logger.error('Failed to get JPD projects', { error: error.message });
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_JPD_PROJECTS_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: enhancedSuggestion,
                next_steps: nextSteps.length > 0 ? nextSteps : undefined,
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );
}
