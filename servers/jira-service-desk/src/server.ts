/**
 * Jira Service Desk MCP Server - Server Factory
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

import { registerServiceDeskTools } from './tools/service-desk.js';
import { registerCustomerOrganizationTools } from './tools/customer-organizations.js';

// ============================================================================
// Types
// ============================================================================

export interface ServerHooks {
  onToolCall?: (toolName: string, params: unknown) => Promise<void>;
  transformResponse?: (toolName: string, result: unknown, params?: unknown) => Promise<unknown>;
  /** Called during tool registration to transform tool config (e.g., add parameters). */
  transformToolConfig?: (toolName: string, config: unknown) => unknown;
  onToolError?: (toolName: string, error: Error) => Promise<void>;
  onServerCreate?: (server: McpServer) => Promise<void>;
  onClientCreate?: (client: JiraApiClient) => Promise<void>;
}

export interface ServerConfig {
  name?: string;
  version?: string;
  hooks?: ServerHooks;
  authConfig?: AuthConfig;
}

export interface ServerInstance {
  server: McpServer;
  apiClient: JiraApiClient;
  start: (transport?: 'stdio' | 'http') => Promise<void>;
  stop: () => Promise<void>;
}

// ============================================================================
// Tool Catalog
// ============================================================================

export const toolCatalog = [
  { name: 'get_service_desks', category: 'service-desks', type: 'discovery', description: 'List all service desks' },
  { name: 'get_request_types', category: 'service-desks', type: 'discovery', description: 'List request types for a service desk' },
  { name: 'create_request_type', category: 'service-desks', type: 'create', description: 'Create new request type' },
  { name: 'get_request_type_fields', category: 'service-desks', type: 'read', description: 'Get request type field configuration' },
  { name: 'configure_request_type_workflow', category: 'service-desks', type: 'update', description: 'Configure request type workflow' },
  { name: 'get_customer_organizations', category: 'customers', type: 'discovery', description: 'List customer organizations' },
  { name: 'get_organization_customers', category: 'customers', type: 'read', description: 'List customers in an organization' },
  { name: 'get_customer_organization_membership', category: 'customers', type: 'read', description: 'Check customer organization membership' },
  { name: 'get_project_customer_organizations', category: 'customers', type: 'read', description: 'List organizations for a project' },
  { name: 'analyze_customer_visibility', category: 'customers', type: 'read', description: 'Analyze customer visibility issues' },
  // Meta
  { name: 'search_tools', category: 'meta', type: 'discovery', description: 'Discover available tools by category or type' },
];

// ============================================================================
// Hooked Tool Registrar
// ============================================================================

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
        if (hooks.onToolCall) await hooks.onToolCall(name, params);
        try {
          // Security: strip the optimization-only 'responseFormat' param before the handler's
          // strict input validation runs, so .strict() schemas don't reject it. The original
          // params (incl. responseFormat) are still passed to transformResponse below.
          const handlerParams: Record<string, unknown> = { ...(params ?? {}) };
          delete handlerParams.responseFormat;
          let result = await handler(handlerParams);
          if (hooks.transformResponse) result = await hooks.transformResponse(name, result, params);
          return result;
        } catch (error) {
          if (hooks.onToolError) await hooks.onToolError(name, error as Error);
          throw error;
        }
      };
      server.registerTool(name, transformedConfig, wrappedHandler);
    }) as McpServer['registerTool'],
  };
}

function getAuthConfigFromEnv(): AuthConfig {
  return {
    type: 'basic' as const,
    baseUrl: process.env.ATLASSIAN_SITE_URL || '',
    email: process.env.ATLASSIAN_USER_EMAIL,
    apiToken: process.env.ATLASSIAN_API_TOKEN,
  };
}

function registerSearchTools(server: McpServer) {
  server.registerTool(
    'search_tools',
    {
      title: 'Search Tools',
      description: 'Discover available tools by category or type.',
      inputSchema: {
        category: z.enum(['service-desks', 'customers', 'all']).optional().default('all'),
        type: z.enum(['discovery', 'create', 'read', 'update', 'delete', 'all']).optional().default('all'),
      },
      annotations: { title: 'Search Tools', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params: { category?: string; type?: string }) => {
      const category = params.category || 'all';
      const type = params.type || 'all';
      let tools = [...toolCatalog];
      if (category !== 'all') tools = tools.filter(t => t.category === category);
      if (type !== 'all') tools = tools.filter(t => t.type === type);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            tools,
            count: tools.length,
            totalAvailable: toolCatalog.length,
            availableCategories: [...new Set(toolCatalog.map(t => t.category))],
            availableTypes: [...new Set(toolCatalog.map(t => t.type))],
          }, null, 2),
        }],
      };
    }
  );
}

// ============================================================================
// Server Factory
// ============================================================================

export async function createServer(config: ServerConfig = {}): Promise<ServerInstance> {
  const serverName = config.name || 'jira-service-desk-mcp-server';
  const serverVersion = config.version || '1.0.0';

  const server = new McpServer({ name: serverName, version: serverVersion });

  if (config.hooks?.onServerCreate) await config.hooks.onServerCreate(server);

  const authConfig = config.authConfig || getAuthConfigFromEnv();
  const authManager = new AuthManager(authConfig);
  const apiClient = new JiraApiClient(authManager);

  if (config.hooks?.onClientCreate) await config.hooks.onClientCreate(apiClient);

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
  await registerServiceDeskTools(registrarServer, apiClient);
  await registerCustomerOrganizationTools(registrarServer, apiClient);

  let httpServer: ReturnType<typeof express.application.listen> | null = null;

  const start = async (transport: 'stdio' | 'http' = 'stdio') => {
    if (transport === 'http') {
      const app = express();
      app.use(express.json());
      app.get('/health', (_req, res) => res.json({ status: 'healthy', server: serverName, version: serverVersion }));
      app.post('/mcp', async (req, res) => {
        const t = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
        res.on('close', () => t.close());
        await server.connect(t);
        await t.handleRequest(req, res, req.body);
      });
      const port = parseInt(process.env.MCP_PORT || process.env.PORT || '3000');
      httpServer = app.listen(port, () => logger.info(`MCP server running on http://localhost:${port}/mcp`));
    } else {
      const t = new StdioServerTransport();
      await server.connect(t);
    }
    const shutdown = async () => { if (httpServer) httpServer.close(); await server.close(); process.exit(0); };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  };

  const stop = async () => { if (httpServer) httpServer.close(); await server.close(); };

  return { server, apiClient, start, stop };
}

export { registerServiceDeskTools } from './tools/service-desk.js';
export { registerCustomerOrganizationTools } from './tools/customer-organizations.js';
