/**
 * Jira Workflows MCP Server - Server Factory
 *
 * This module provides a factory function for creating server instances
 * with optional hooks for extension.
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
import { registerWorkflowTools } from './tools/workflows.js';
import { registerScreenTools } from './tools/screens.js';
import { registerWorkflowSchemeTools } from './tools/workflow-schemes.js';
import { registerGuidedWorkflowTools } from './tools/guided-workflows.js';
import { registerAutomationTools } from './tools/automation.js';

// ============================================================================
// Types
// ============================================================================

export interface ServerHooks {
  onToolCall?: (toolName: string, params: unknown) => Promise<void>;
  transformResponse?: (toolName: string, result: unknown, params?: unknown) => Promise<unknown>;

  /** Called on tool errors. Use for error aggregation, custom formatting. */
  onToolError?: (toolName: string, error: Error) => Promise<void>;

  /** Called during tool registration to transform tool config (e.g., add parameters). */
  transformToolConfig?: (toolName: string, config: unknown) => unknown;
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
  // Workflows
  { name: 'get_workflows', category: 'workflows', type: 'discovery', description: 'Search and list workflows' },
  { name: 'get_statuses', category: 'workflows', type: 'discovery', description: 'Get available statuses and categories' },
  { name: 'create_workflow', category: 'workflows', type: 'create', description: 'Create a new workflow' },
  { name: 'delete_workflow', category: 'workflows', type: 'delete', description: 'Delete a workflow by entity ID' },
  { name: 'get_workflow_schemes_basic', category: 'workflows', type: 'discovery', description: 'List workflow schemes (basic info)' },
  // Screens
  { name: 'get_screen_schemes', category: 'screens', type: 'discovery', description: 'List screen schemes' },
  { name: 'create_screen_scheme', category: 'screens', type: 'create', description: 'Create a screen scheme' },
  { name: 'delete_screen_scheme', category: 'screens', type: 'delete', description: 'Delete screen scheme' },
  { name: 'get_screens', category: 'screens', type: 'discovery', description: 'List all screens' },
  { name: 'create_screen', category: 'screens', type: 'create', description: 'Create a new screen' },
  { name: 'update_screen', category: 'screens', type: 'update', description: 'Update screen configuration' },
  { name: 'delete_screen', category: 'screens', type: 'delete', description: 'Delete a screen' },
  { name: 'get_screen_tabs', category: 'screens', type: 'read', description: 'Get tabs for a screen' },
  { name: 'create_screen_tab', category: 'screens', type: 'create', description: 'Create a screen tab' },
  { name: 'update_screen_tab', category: 'screens', type: 'update', description: 'Update a screen tab' },
  { name: 'delete_screen_tab', category: 'screens', type: 'delete', description: 'Delete a screen tab' },
  { name: 'get_screen_tab_fields', category: 'screens', type: 'read', description: 'Get fields in a screen tab' },
  { name: 'remove_field_from_screen_tab', category: 'screens', type: 'delete', description: 'Remove field from screen tab' },
  { name: 'move_screen_tab_field', category: 'screens', type: 'update', description: 'Move field position in tab' },
  { name: 'add_field_to_screen', category: 'screens', type: 'create', description: 'Add field to a screen tab' },
  { name: 'add_field_to_default_screen', category: 'screens', type: 'create', description: 'Add field to default screen' },
  { name: 'get_screen_available_fields', category: 'screens', type: 'read', description: 'Get available fields for screen' },
  { name: 'assign_issue_type_screen_scheme_to_project', category: 'screens', type: 'update', description: 'Assign ITSS to project' },
  // Workflow Schemes
  { name: 'get_workflow_schemes_detailed', category: 'schemes', type: 'discovery', description: 'List workflow schemes (detailed)' },
  { name: 'create_workflow_scheme', category: 'schemes', type: 'create', description: 'Create workflow scheme' },
  { name: 'update_workflow_scheme', category: 'schemes', type: 'update', description: 'Update workflow scheme' },
  { name: 'set_workflow_scheme_issue_type', category: 'schemes', type: 'update', description: 'Set workflow for issue type' },
  { name: 'assign_workflow_scheme_to_project', category: 'schemes', type: 'update', description: 'Assign workflow scheme to project' },
  { name: 'delete_workflow_scheme_issue_type', category: 'schemes', type: 'delete', description: 'Remove issue type mapping' },
  // Guided Workflows
  { name: 'setup_workflow_guided', category: 'guided', type: 'create', description: 'Guided workflow creation wizard' },
  // Automation
  { name: 'get_automation_rules', category: 'automation', type: 'discovery', description: 'List automation rules' },
  { name: 'get_automation_rule_details', category: 'automation', type: 'read', description: 'Get automation rule details' },
  { name: 'get_automation_templates', category: 'automation', type: 'discovery', description: 'List automation templates' },
  { name: 'get_automation_component_types', category: 'automation', type: 'discovery', description: 'Discover automation component types and value schemas' },
  { name: 'create_automation_rule', category: 'automation', type: 'create', description: 'Create automation rule' },
  { name: 'update_automation_rule', category: 'automation', type: 'update', description: 'Update automation rule' },
  { name: 'enable_disable_automation_rule', category: 'automation', type: 'update', description: 'Enable or disable rule' },
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
          // Security: strip the optimization-only 'responseFormat' param before the handler's
          // strict input validation runs, so .strict() schemas don't reject it. The original
          // params (incl. responseFormat) are still passed to transformResponse below.
          const handlerParams: Record<string, unknown> = { ...(params ?? {}) };
          delete handlerParams.responseFormat;
          let result = await handler(handlerParams);

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
        category: z.enum(['workflows', 'screens', 'schemes', 'guided', 'automation', 'all']).optional().default('all')
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

export async function createServer(config: ServerConfig = {}): Promise<ServerInstance> {
  const serverName = config.name || 'jira-workflows-mcp-server';
  const serverVersion = config.version || '1.0.0';

  const server = new McpServer({ name: serverName, version: serverVersion });

  if (config.hooks?.onServerCreate) {
    await config.hooks.onServerCreate(server);
  }

  const authConfig = config.authConfig || getAuthConfigFromEnv();
  const authManager = new AuthManager(authConfig);
  const apiClient = new JiraApiClient(authManager);

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
  await registerWorkflowTools(registrarServer, apiClient);
  await registerScreenTools(registrarServer, apiClient);
  await registerWorkflowSchemeTools(registrarServer, apiClient);
  await registerGuidedWorkflowTools(registrarServer, apiClient);
  await registerAutomationTools(registrarServer, apiClient);

  let httpServer: ReturnType<typeof express.application.listen> | null = null;

  const start = async (transport: 'stdio' | 'http' = 'stdio') => {
    if (transport === 'http') {
      const app = express();
      app.use(express.json());
      app.get('/health', (_req, res) => {
        res.json({ status: 'healthy', server: serverName, version: serverVersion });
      });
      app.post('/mcp', async (req, res) => {
        const t = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
        res.on('close', () => t.close());
        await server.connect(t);
        await t.handleRequest(req, res, req.body);
      });
      const port = parseInt(process.env.MCP_PORT || process.env.PORT || '3000');
      httpServer = app.listen(port, () => {
        logger.info(`MCP server running on http://localhost:${port}/mcp`);
      });
    } else {
      const t = new StdioServerTransport();
      await server.connect(t);
    }
    const shutdown = async () => {
      if (httpServer) httpServer.close();
      await server.close();
      process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  };

  const stop = async () => {
    if (httpServer) httpServer.close();
    await server.close();
  };

  return { server, apiClient, start, stop };
}

// Tool Registration Exports
export { registerWorkflowTools } from './tools/workflows.js';
export { registerScreenTools } from './tools/screens.js';
export { registerWorkflowSchemeTools } from './tools/workflow-schemes.js';
export { registerGuidedWorkflowTools } from './tools/guided-workflows.js';
export { registerAutomationTools } from './tools/automation.js';
