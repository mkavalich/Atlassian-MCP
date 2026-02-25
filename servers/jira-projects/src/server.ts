/**
 * Jira Projects MCP Server - Server Factory
 *
 * This module provides a factory function for creating server instances
 * with optional hooks for extension.
 *
 * Extension usage:
 * ```typescript
 * import { createServer, type ServerHooks } from 'jira-projects-mcp-server/exports';
 *
 * const { server, start } = await createServer({
 *   hooks: {
 *     transformResponse: async (toolName, result) => {
 *       return TokenOptimizer.compress(result);
 *     }
 *   }
 * });
 * await start();
 * ```
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { z } from 'zod';
import { AuthManager } from './auth/index.js';
import { JiraApiClient } from './api/client.js';
import { logger } from './utils/logger.js';
import type { AuthConfig } from './types/index.js';

// Import tool modules
import { registerProjectTools } from './tools/projects.js';
import { registerIssueTypeTools } from './tools/issue-types.js';
import { registerDashboardTools } from './tools/dashboards.js';
import { registerReportingTools } from './tools/reporting.js';
import { registerIssueTools } from './tools/issues.js';
import { registerAttachmentTools } from './tools/attachments.js';
import { registerAgileTools } from './tools/agile.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Hooks for extension of server behavior.
 * All hooks are optional and async.
 */
export interface ServerHooks {
  /** Called before each tool execution. Use for telemetry, rate limiting, audit logging. */
  onToolCall?: (toolName: string, params: unknown) => Promise<void>;

  /**
   * Called after tool execution, can transform the result.
   * Primary hook for token optimization (TOON format, field filtering).
   */
  transformResponse?: (toolName: string, result: unknown, params?: unknown) => Promise<unknown>;

  /** Called on tool errors. Use for error aggregation, custom formatting. */
  onToolError?: (toolName: string, error: Error) => Promise<void>;

  /** Called during tool registration to transform tool config (e.g., add parameters). */
  transformToolConfig?: (toolName: string, config: unknown) => unknown;

  /** Called after MCP server is created, before tools are registered. */
  onServerCreate?: (server: McpServer) => Promise<void>;

  /** Called after API client is created. Use for request interceptors, custom headers. */
  onClientCreate?: (client: JiraApiClient) => Promise<void>;
}

/**
 * Configuration for creating a server instance.
 */
export interface ServerConfig {
  /** Override the server name (default: 'jira-projects-mcp-server') */
  name?: string;

  /** Override the server version (default: '1.0.0') */
  version?: string;

  /** Extension hooks */
  hooks?: ServerHooks;

  /** Override auth config (for testing or custom auth). If not provided, reads from env. */
  authConfig?: AuthConfig;
}

/**
 * A running server instance with control methods.
 */
export interface ServerInstance {
  /** The underlying MCP server */
  server: McpServer;

  /** Jira API client */
  apiClient: JiraApiClient;

  /** Start the server with specified transport */
  start: (transport?: 'stdio' | 'http') => Promise<void>;

  /** Stop the server gracefully */
  stop: () => Promise<void>;
}

// ============================================================================
// Tool Catalog (for progressive disclosure)
// ============================================================================

/**
 * Catalog of all tools in this server, for discovery and documentation.
 */
export const toolCatalog = [
  // Projects
  { name: 'search_projects', category: 'projects', type: 'discovery', description: 'Search and discover Jira projects' },
  { name: 'create_project', category: 'projects', type: 'create', description: 'Create a new Jira project' },
  { name: 'get_project', category: 'projects', type: 'read', description: 'Get project details by ID/key' },
  { name: 'update_project', category: 'projects', type: 'update', description: 'Update project configuration' },
  { name: 'delete_project', category: 'projects', type: 'delete', description: 'Delete a project permanently' },
  // Issues
  { name: 'get_issue_createmeta_issuetypes', category: 'issues', type: 'discovery', description: 'Get issue types for create metadata' },
  { name: 'get_issue_createmeta_fields', category: 'issues', type: 'discovery', description: 'Get fields for create metadata' },
  { name: 'get_issue_editmeta_fields', category: 'issues', type: 'discovery', description: 'Get fields for edit metadata' },
  { name: 'create_issue', category: 'issues', type: 'create', description: 'Create a new issue' },
  { name: 'bulk_create_issues', category: 'issues', type: 'create', description: 'Bulk create multiple issues' },
  { name: 'get_issue', category: 'issues', type: 'read', description: 'Get issue details by key/ID' },
  { name: 'update_issue', category: 'issues', type: 'update', description: 'Update issue fields' },
  { name: 'delete_issue', category: 'issues', type: 'delete', description: 'Delete an issue permanently' },
  { name: 'transition_issue', category: 'issues', type: 'update', description: 'Change issue workflow status' },
  { name: 'assign_issue', category: 'issues', type: 'update', description: 'Assign issue to a user' },
  { name: 'get_transitions', category: 'issues', type: 'read', description: 'Get available workflow transitions' },
  // Comments
  { name: 'add_comment', category: 'comments', type: 'create', description: 'Add comment to an issue' },
  { name: 'get_comments', category: 'comments', type: 'read', description: 'Get comments on an issue' },
  { name: 'update_comment', category: 'comments', type: 'update', description: 'Update a comment' },
  { name: 'delete_comment', category: 'comments', type: 'delete', description: 'Delete a comment' },
  // Issue Types
  { name: 'get_issue_types', category: 'issue-types', type: 'discovery', description: 'List all issue types' },
  { name: 'create_issue_type', category: 'issue-types', type: 'create', description: 'Create new issue type' },
  { name: 'update_issue_type', category: 'issue-types', type: 'update', description: 'Update issue type config' },
  { name: 'delete_issue_type', category: 'issue-types', type: 'delete', description: 'Delete an issue type' },
  // Schemes
  { name: 'get_issue_type_schemes', category: 'schemes', type: 'discovery', description: 'List issue type schemes' },
  { name: 'get_issue_type_scheme_mappings', category: 'schemes', type: 'read', description: 'Get issue type scheme mappings' },
  { name: 'create_issue_type_scheme', category: 'schemes', type: 'create', description: 'Create issue type scheme' },
  { name: 'add_issue_types_to_scheme', category: 'schemes', type: 'update', description: 'Add issue types to scheme' },
  { name: 'assign_issue_type_scheme_to_project', category: 'schemes', type: 'update', description: 'Assign issue type scheme to project' },
  { name: 'update_issue_type_scheme', category: 'schemes', type: 'update', description: 'Update scheme config' },
  { name: 'delete_issue_type_scheme', category: 'schemes', type: 'delete', description: 'Delete a scheme' },
  // Dashboards
  { name: 'get_dashboards', category: 'dashboards', type: 'discovery', description: 'List available dashboards' },
  { name: 'create_dashboard', category: 'dashboards', type: 'create', description: 'Create a new dashboard' },
  { name: 'get_dashboard', category: 'dashboards', type: 'read', description: 'Get dashboard details' },
  { name: 'update_dashboard', category: 'dashboards', type: 'update', description: 'Update dashboard config' },
  { name: 'delete_dashboard', category: 'dashboards', type: 'delete', description: 'Delete a dashboard' },
  // Reporting
  { name: 'search_jql', category: 'reporting', type: 'discovery', description: 'Search issues with JQL' },
  { name: 'generate_project_report', category: 'reporting', type: 'read', description: 'Generate project report' },
  { name: 'get_project_analytics', category: 'reporting', type: 'read', description: 'Get project analytics' },
  // Attachments
  { name: 'add_attachment', category: 'attachments', type: 'create', description: 'Add attachment to issue' },
  { name: 'get_attachment', category: 'attachments', type: 'read', description: 'Get attachment metadata' },
  { name: 'list_issue_attachments', category: 'attachments', type: 'read', description: 'List attachments on issue' },
  { name: 'delete_attachment', category: 'attachments', type: 'delete', description: 'Delete an attachment' },
  { name: 'get_attachment_meta', category: 'attachments', type: 'discovery', description: 'Get attachment settings' },
  // Meta
  { name: 'search_tools', category: 'meta', type: 'discovery', description: 'Discover available tools by category or type' },
  // Agile (Sprints & Boards)
  { name: 'get_boards', category: 'agile', type: 'discovery', description: 'List all Jira Software boards' },
  { name: 'get_board', category: 'agile', type: 'read', description: 'Get board details by ID' },
  { name: 'get_board_configuration', category: 'agile', type: 'read', description: 'Get board column and estimation config' },
  { name: 'get_board_backlog', category: 'agile', type: 'read', description: 'Get backlog issues for a board' },
  { name: 'create_board', category: 'agile', type: 'create', description: 'Create a new Scrum or Kanban board' },
  { name: 'delete_board', category: 'agile', type: 'delete', description: 'Delete a board' },
  { name: 'get_sprints_for_board', category: 'agile', type: 'discovery', description: 'List sprints for a Scrum board' },
  { name: 'create_sprint', category: 'agile', type: 'create', description: 'Create a new sprint' },
  { name: 'get_sprint', category: 'agile', type: 'read', description: 'Get sprint details by ID' },
  { name: 'update_sprint', category: 'agile', type: 'update', description: 'Update sprint (name, dates, state)' },
  { name: 'delete_sprint', category: 'agile', type: 'delete', description: 'Delete a sprint' },
  { name: 'get_sprint_issues', category: 'agile', type: 'read', description: 'Get all issues in a sprint' },
  { name: 'move_issues_to_sprint', category: 'agile', type: 'update', description: 'Move issues into a sprint' },
  { name: 'move_issues_to_backlog', category: 'agile', type: 'update', description: 'Move issues to backlog' },
];

// ============================================================================
// Hooked Tool Registrar
// ============================================================================

/**
 * Creates a wrapper around McpServer that intercepts tool registration
 * to inject hooks around tool execution.
 */
function createHookedToolRegistrar(
  server: McpServer,
  hooks: ServerHooks
): { registerTool: McpServer['registerTool'] } {
  return {
    registerTool: ((name: string, config: any, handler: (params: any) => Promise<any>) => {
      // Transform tool config if hook provided (e.g., add extra parameters)
      const transformedConfig = hooks.transformToolConfig
        ? hooks.transformToolConfig(name, config)
        : config;

      const wrappedHandler = async (params: any) => {
        // Pre-execution hook
        if (hooks.onToolCall) {
          await hooks.onToolCall(name, params);
        }

        try {
          // Execute original handler
          let result = await handler(params);

          // Post-execution hook (transform response, pass params for format selection)
          if (hooks.transformResponse) {
            result = await hooks.transformResponse(name, result, params);
          }

          return result;
        } catch (error) {
          // Error hook
          if (hooks.onToolError) {
            await hooks.onToolError(name, error as Error);
          }
          throw error;
        }
      };

      server.registerTool(name, transformedConfig, wrappedHandler);
    }) as McpServer['registerTool'],
  };
}

// ============================================================================
// Auth Config Helper
// ============================================================================

/**
 * Gets auth config from environment variables.
 */
function getAuthConfigFromEnv(): AuthConfig {
  return {
    type: 'basic' as const,
    baseUrl: process.env.ATLASSIAN_SITE_URL || '',
    email: process.env.ATLASSIAN_USER_EMAIL,
    apiToken: process.env.ATLASSIAN_API_TOKEN,
  };
}

// ============================================================================
// Search Tools Registration
// ============================================================================

function registerSearchTools(server: McpServer) {
  server.registerTool(
    'search_tools',
    {
      title: 'Search Tools',
      description: 'Discover available tools by category or type. Use this first to find the right tool for your task.',
      inputSchema: {
        category: z.enum(['projects', 'issues', 'comments', 'issue-types', 'schemes', 'dashboards', 'reporting', 'attachments', 'agile', 'all']).optional().default('all')
          .describe('Filter by tool category'),
        type: z.enum(['discovery', 'create', 'read', 'update', 'delete', 'all']).optional().default('all')
          .describe('Filter by operation type'),
      },
      annotations: {
        title: 'Search Tools',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: { category?: string; type?: string }) => {
      const category = params.category || 'all';
      const type = params.type || 'all';

      let tools = [...toolCatalog];

      if (category !== 'all') {
        tools = tools.filter(t => t.category === category);
      }
      if (type !== 'all') {
        tools = tools.filter(t => t.type === type);
      }

      const categories = [...new Set(toolCatalog.map(t => t.category))];
      const types = [...new Set(toolCatalog.map(t => t.type))];

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            tools,
            count: tools.length,
            totalAvailable: toolCatalog.length,
            filters: { category, type },
            availableCategories: categories,
            availableTypes: types,
            usage_guidance: `Found ${tools.length} tool(s). Discovery tools (type: 'discovery') should be called first to find valid IDs before using other tools.`,
          }, null, 2),
        }],
      };
    }
  );
}

// ============================================================================
// Server Factory
// ============================================================================

/**
 * Creates a new Jira Projects MCP server instance with optional hooks.
 *
 * @param config - Server configuration including optional hooks
 * @returns Server instance with control methods
 *
 * @example
 * ```typescript
 * // Basic usage
 * const { start } = await createServer();
 * await start();
 *
 * // With hooks
 * const { start } = await createServer({
 *   hooks: {
 *     transformResponse: async (tool, result) => compress(result),
 *     onToolCall: async (tool, params) => telemetry.track(tool),
 *   }
 * });
 * await start();
 * ```
 */
export async function createServer(config: ServerConfig = {}): Promise<ServerInstance> {
  const serverName = config.name || 'jira-projects-mcp-server';
  const serverVersion = config.version || '1.0.0';

  // 1. Create MCP server
  const server = new McpServer({
    name: serverName,
    version: serverVersion,
  });

  // Call onServerCreate hook
  if (config.hooks?.onServerCreate) {
    await config.hooks.onServerCreate(server);
  }

  // 2. Initialize API client
  const authConfig = config.authConfig || getAuthConfigFromEnv();
  const authManager = new AuthManager(authConfig);
  const apiClient = new JiraApiClient(authManager);

  // Call onClientCreate hook
  if (config.hooks?.onClientCreate) {
    await config.hooks.onClientCreate(apiClient);
  }

  // 3. Create tool registrar (with or without hooks)
  // Note: We must bind registerTool to preserve 'this' context
  const boundRegisterTool = config.hooks
    ? createHookedToolRegistrar(server, config.hooks).registerTool
    : server.registerTool.bind(server);

  // 4. Register all tools using a proxy that preserves method binding
  const registrarServer = new Proxy(server, {
    get(target, prop) {
      if (prop === 'registerTool') {
        return boundRegisterTool;
      }
      return target[prop as keyof typeof target];
    },
  }) as McpServer;

  registerSearchTools(registrarServer);
  await registerProjectTools(registrarServer, apiClient);
  await registerIssueTools(registrarServer, apiClient);
  await registerIssueTypeTools(registrarServer, apiClient);
  await registerDashboardTools(registrarServer, apiClient);
  await registerReportingTools(registrarServer, apiClient);
  await registerAttachmentTools(registrarServer, apiClient);
  await registerAgileTools(registrarServer, apiClient);

  // 5. Create start/stop functions
  let httpServer: ReturnType<typeof express.application.listen> | null = null;

  const start = async (transport: 'stdio' | 'http' = 'stdio') => {
    if (transport === 'http') {
      await startHttp();
    } else {
      await startStdio();
    }
  };

  const startStdio = async () => {
    const transport = new StdioServerTransport();
    await server.connect(transport);

    const shutdown = async () => {
      await server.close();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  };

  const startHttp = async () => {
    const app = express();
    app.use(express.json());

    app.get('/health', (_req, res) => {
      res.json({ status: 'healthy', server: serverName, version: serverVersion });
    });

    app.post('/mcp', async (req, res) => {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });

      res.on('close', () => transport.close());

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    });

    const port = parseInt(process.env.MCP_PORT || process.env.PORT || '3000');
    httpServer = app.listen(port, () => {
      logger.info(`MCP server running on http://localhost:${port}/mcp`);
      logger.info(`Health check at http://localhost:${port}/health`);
    });

    const shutdown = async () => {
      if (httpServer) {
        httpServer.close();
      }
      await server.close();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  };

  const stop = async () => {
    if (httpServer) {
      httpServer.close();
    }
    await server.close();
  };

  // 6. Return server instance
  return {
    server,
    apiClient,
    start,
    stop,
  };
}

// ============================================================================
// Tool Registration Exports (for custom tool composition)
// ============================================================================

export { registerProjectTools } from './tools/projects.js';
export { registerIssueTools } from './tools/issues.js';
export { registerIssueTypeTools } from './tools/issue-types.js';
export { registerDashboardTools } from './tools/dashboards.js';
export { registerReportingTools } from './tools/reporting.js';
export { registerAttachmentTools } from './tools/attachments.js';
export { registerAgileTools } from './tools/agile.js';
