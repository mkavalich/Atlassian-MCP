/**
 * Jira Fields & Permissions MCP Server - Server Factory
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

import { registerPermissionTools } from './tools/permissions.js';
import { registerFieldTools } from './tools/fields.js';
import { registerFieldContextTools } from './tools/field-contexts.js';
import { registerFieldConfigurationTools } from './tools/field-configurations.js';
import { registerNotificationScreenTools } from './tools/notifications-screens.js';

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
  // Permissions
  { name: 'get_permission_schemes', category: 'permissions', type: 'discovery', description: 'List permission schemes' },
  { name: 'create_permission_scheme', category: 'permissions', type: 'create', description: 'Create permission scheme' },
  { name: 'update_permission_scheme', category: 'permissions', type: 'update', description: 'Update permission scheme' },
  { name: 'delete_permission_scheme', category: 'permissions', type: 'delete', description: 'Delete permission scheme' },
  { name: 'get_permission_grants', category: 'permissions', type: 'read', description: 'Get permission grants' },
  { name: 'create_permission_grant', category: 'permissions', type: 'create', description: 'Create permission grant' },
  { name: 'delete_permission_grant', category: 'permissions', type: 'delete', description: 'Delete permission grant' },
  { name: 'get_global_permissions', category: 'permissions', type: 'discovery', description: 'Get global permissions' },
  { name: 'get_my_permissions', category: 'permissions', type: 'read', description: 'Get my permissions' },
  // Fields
  { name: 'get_fields_paginated', category: 'fields', type: 'discovery', description: 'List fields with pagination' },
  { name: 'create_custom_field', category: 'fields', type: 'create', description: 'Create custom field' },
  { name: 'update_custom_field', category: 'fields', type: 'update', description: 'Update custom field' },
  { name: 'delete_custom_field', category: 'fields', type: 'delete', description: 'Delete custom field' },
  // Field Contexts
  { name: 'get_custom_field_contexts', category: 'field-contexts', type: 'discovery', description: 'Get field contexts' },
  { name: 'get_field_project_mapping', category: 'field-contexts', type: 'read', description: 'Map custom fields to the projects they apply to (union-enumerated; global=all-projects; 404=unverifiable, never a false zero)' },
  { name: 'create_custom_field_context', category: 'field-contexts', type: 'create', description: 'Create field context' },
  { name: 'update_custom_field_context', category: 'field-contexts', type: 'update', description: 'Update field context' },
  { name: 'delete_custom_field_context', category: 'field-contexts', type: 'delete', description: 'Delete field context' },
  { name: 'get_custom_field_options', category: 'field-contexts', type: 'read', description: 'Get field options' },
  { name: 'create_custom_field_options', category: 'field-contexts', type: 'create', description: 'Create field options' },
  // Field Configuration
  { name: 'get_field_configurations', category: 'field-config', type: 'discovery', description: 'List field configurations' },
  { name: 'create_field_configuration', category: 'field-config', type: 'create', description: 'Create field configuration' },
  { name: 'update_field_configuration', category: 'field-config', type: 'update', description: 'Update field configuration' },
  { name: 'get_field_configuration_schemes', category: 'field-config', type: 'discovery', description: 'List field config schemes' },
  { name: 'create_field_configuration_scheme', category: 'field-config', type: 'create', description: 'Create field config scheme' },
  // Notifications
  { name: 'get_notification_schemes', category: 'notifications', type: 'discovery', description: 'List notification schemes' },
  { name: 'create_notification_scheme', category: 'notifications', type: 'create', description: 'Create notification scheme' },
  { name: 'get_notification_screens', category: 'notifications', type: 'discovery', description: 'List notification screens' },
  { name: 'create_notification_screen', category: 'notifications', type: 'create', description: 'Create notification screen' },
  { name: 'add_field_to_notification_screen', category: 'notifications', type: 'create', description: 'Add field to screen' },
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
      // Transform config if hook is provided
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
        category: z.enum(['permissions', 'fields', 'field-contexts', 'field-config', 'notifications', 'all']).optional().default('all'),
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
  const serverName = config.name || 'jira-fields-permissions-mcp-server';
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
  await registerPermissionTools(registrarServer, apiClient);
  await registerFieldTools(registrarServer, apiClient);
  await registerFieldContextTools(registrarServer, apiClient);
  await registerFieldConfigurationTools(registrarServer, apiClient);
  await registerNotificationScreenTools(registrarServer, apiClient);

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

export { registerPermissionTools } from './tools/permissions.js';
export { registerFieldTools } from './tools/fields.js';
export { registerFieldContextTools } from './tools/field-contexts.js';
export { registerFieldConfigurationTools } from './tools/field-configurations.js';
export { registerNotificationScreenTools } from './tools/notifications-screens.js';
