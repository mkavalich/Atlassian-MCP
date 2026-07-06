/**
 * Jira Product Discovery MCP Server - Server Factory
 *
 * This module provides a factory function for creating server instances
 * with optional hooks for extension.
 *
 * Extension usage:
 * ```typescript
 * import { createServer, type ServerHooks } from 'jira-product-discovery-mcp-server/exports';
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
import { AuthManager } from './auth/index.js';
import { JiraApiClient } from './api/client.js';
import { JpdGraphQLClient } from './api/graphql-client.js';
import { logger } from './utils/logger.js';
import type { AuthConfig } from './types/index.js';

// Import tool modules
import { registerDiscoveryTools } from './tools/discovery.js';
import { registerIdeaTools } from './tools/ideas.js';
import { registerInsightTools } from './tools/insights.js';
import { registerScoringTools } from './tools/scoring.js';

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

  /** Called during tool registration to transform tool config (e.g., add parameters). */
  transformToolConfig?: (toolName: string, config: unknown) => unknown;

  /** Called on tool errors. Use for error aggregation, custom formatting. */
  onToolError?: (toolName: string, error: Error) => Promise<void>;

  /** Called after MCP server is created, before tools are registered. */
  onServerCreate?: (server: McpServer) => Promise<void>;

  /** Called after API clients are created. Use for request interceptors, custom headers. */
  onClientCreate?: (restClient: JiraApiClient, graphqlClient: JpdGraphQLClient) => Promise<void>;
}

/**
 * Configuration for creating a server instance.
 */
export interface ServerConfig {
  /** Override the server name (default: 'jira-product-discovery-mcp-server') */
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

  /** REST API client for Jira operations (ideas are Jira issues) */
  restClient: JiraApiClient;

  /** GraphQL client for Polaris operations (insights, scoring) */
  graphqlClient: JpdGraphQLClient;

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
  // Insights (GraphQL)
  { name: 'get_insights', category: 'insights', type: 'discovery', description: 'List insights attached to an idea' },
  // Analysis (GraphQL)
  { name: 'analyze_idea_insights', category: 'analysis', type: 'read', description: 'Aggregate analysis of idea insights' },
  { name: 'get_idea_scoring', category: 'analysis', type: 'read', description: 'Get impact/effort/confidence scores' },
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
      // Transform config if hook provided
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
          // Security: strip the optimization-only 'responseFormat' param before the handler's
          // strict input validation runs, so .strict() schemas don't reject it. The original
          // params (incl. responseFormat) are still passed to transformResponse below.
          const handlerParams: Record<string, unknown> = { ...(params ?? {}) };
          delete handlerParams.responseFormat;
          let result = await handler(handlerParams);

          // Post-execution hook (transform response, pass params for context)
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
// Server Factory
// ============================================================================

/**
 * Creates a new JPD MCP server instance with optional hooks.
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
  const serverName = config.name || 'jira-product-discovery-mcp-server';
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

  // 2. Initialize API clients
  const authConfig = config.authConfig || getAuthConfigFromEnv();
  const authManager = new AuthManager(authConfig);

  // REST client for Ideas (Jira issues)
  const restClient = new JiraApiClient(authManager);

  // GraphQL client for Insights and Scoring
  const graphqlClient = new JpdGraphQLClient(authManager);

  // Call onClientCreate hook
  if (config.hooks?.onClientCreate) {
    await config.hooks.onClientCreate(restClient, graphqlClient);
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

  await registerDiscoveryTools(registrarServer, restClient);
  await registerIdeaTools(registrarServer, restClient);
  await registerInsightTools(registrarServer, graphqlClient, restClient);
  await registerScoringTools(registrarServer, graphqlClient, restClient);

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

    // Handle graceful shutdown
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

    // Health check endpoint
    app.get('/health', (_req, res) => {
      res.json({
        status: 'healthy',
        server: serverName,
        version: serverVersion,
        features: ['ideas', 'insights', 'scoring'],
      });
    });

    // MCP endpoint
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
      logger.info(`JPD MCP server running on http://localhost:${port}/mcp`);
      logger.info(`Health check at http://localhost:${port}/health`);
    });

    // Handle graceful shutdown
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
    restClient,
    graphqlClient,
    start,
    stop,
  };
}

// ============================================================================
// Tool Registration Exports (for custom tool composition)
// ============================================================================

export { registerDiscoveryTools } from './tools/discovery.js';
export { registerIdeaTools } from './tools/ideas.js';
export { registerInsightTools } from './tools/insights.js';
export { registerScoringTools } from './tools/scoring.js';
