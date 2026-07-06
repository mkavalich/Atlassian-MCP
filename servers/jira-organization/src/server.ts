/**
 * Jira Organization MCP Server - Server Factory
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

import { registerGlobalOrganizationTools } from './tools/global-organization.js';
import { registerIdentityProviderTools } from './tools/identity-providers.js';
import { registerGlobalUserTools } from './tools/global-users.js';
import { registerCrossProductAnalyticsTools } from './tools/cross-product-analytics.js';
import { registerDirectoryHealthTools } from './tools/directory-health.js';
import { registerOrganizationManagementTools } from './tools/organization-management.js';
import { registerEnhancedDirectoryAnalyticsTools } from './tools/enhanced-directory-analytics.js';
import { registerApiSecurityMonitoringTools } from './tools/api-security-monitoring.js';

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
  // Organization Management
  { name: 'get_organizations', category: 'organization', type: 'discovery', description: 'List organizations' },
  { name: 'get_organization_details', category: 'organization', type: 'read', description: 'Get organization details' },
  { name: 'get_organization_info', category: 'organization', type: 'read', description: 'Get organization info' },
  { name: 'get_organization_policies', category: 'organization', type: 'read', description: 'Get organization policies' },
  { name: 'get_organization_domains', category: 'organization', type: 'read', description: 'Get organization domains' },
  { name: 'get_organization_workspaces', category: 'organization', type: 'read', description: 'Get organization workspaces' },
  { name: 'get_organization_events', category: 'organization', type: 'read', description: 'Get organization events' },
  // Identity Providers
  { name: 'get_identity_providers', category: 'identity', type: 'discovery', description: 'List identity providers' },
  { name: 'get_directory_info', category: 'identity', type: 'read', description: 'Get directory information' },
  { name: 'get_directory_sync_status', category: 'identity', type: 'read', description: 'Get directory sync status' },
  { name: 'get_directory_sync_settings', category: 'identity', type: 'read', description: 'Get directory sync settings' },
  { name: 'get_directory_users', category: 'identity', type: 'read', description: 'Get directory users' },
  { name: 'get_user_last_active', category: 'identity', type: 'read', description: 'Get user last active time' },
  // Global Users
  { name: 'get_organization_users', category: 'users', type: 'discovery', description: 'List organization users' },
  { name: 'search_organization_users', category: 'users', type: 'discovery', description: 'Search organization users' },
  { name: 'get_user_role_assignments', category: 'users', type: 'read', description: 'Get user role assignments' },
  { name: 'get_user_group_memberships', category: 'users', type: 'read', description: 'Get user group memberships' },
  { name: 'analyze_user_access', category: 'users', type: 'read', description: 'Analyze user access patterns' },
  // Enhanced Directory Analytics
  { name: 'get_cross_product_user_activity', category: 'analytics', type: 'read', description: 'Get cross-product user activity' },
  { name: 'get_enhanced_identity_provider_insights', category: 'analytics', type: 'read', description: 'Get enhanced IdP insights' },
  { name: 'get_advanced_directory_health_monitoring', category: 'directory', type: 'read', description: 'Get advanced directory health' },
  { name: 'get_user_behavior_pattern_analysis', category: 'analytics', type: 'read', description: 'Analyze user behavior patterns' },
  // Directory Health
  { name: 'get_directory_health_status', category: 'directory', type: 'read', description: 'Get directory health status' },
  { name: 'get_provisioning_insights', category: 'directory', type: 'read', description: 'Get provisioning insights' },
  // API Security Monitoring
  { name: 'get_user_manage', category: 'users', type: 'read', description: 'Get user management permissions' },
  { name: 'get_user_manage_profile', category: 'users', type: 'read', description: 'Get user management profile' },
  { name: 'get_user_manage_api_tokens', category: 'users', type: 'read', description: 'Get user API tokens' },
  { name: 'get_org_user_stats', category: 'analytics', type: 'read', description: 'Get organization user statistics' },
  { name: 'get_org_group_stats', category: 'analytics', type: 'read', description: 'Get organization group statistics' },
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
    orgAdminToken: process.env.ATLASSIAN_ORG_ADMIN_TOKEN,
    orgId: process.env.ATLASSIAN_ORG_ID,
  };
}

function registerSearchTools(server: McpServer) {
  server.registerTool(
    'search_tools',
    {
      title: 'Search Tools',
      description: 'Discover available tools by category or type.',
      inputSchema: {
        category: z.enum(['organization', 'identity', 'users', 'analytics', 'directory', 'all']).optional().default('all'),
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
  const serverName = config.name || 'jira-organization-mcp-server';
  const serverVersion = config.version || '1.0.0';

  const server = new McpServer({ name: serverName, version: serverVersion });

  if (config.hooks?.onServerCreate) await config.hooks.onServerCreate(server);

  const authConfig = config.authConfig || getAuthConfigFromEnv();
  const authManager = new AuthManager(authConfig);
  const apiClient = new JiraApiClient(authManager);

  if (config.hooks?.onClientCreate) await config.hooks.onClientCreate(apiClient);

  // Note: We must bind registerTool to preserve 'this' context
  const boundRegisterTool = config.hooks
    ? createHookedToolRegistrar(server, config.hooks).registerTool
    : server.registerTool.bind(server);

  // Register all tools using a proxy that preserves method binding
  const registrarServer = new Proxy(server, {
    get(target, prop) {
      if (prop === 'registerTool') {
        return boundRegisterTool;
      }
      return target[prop as keyof typeof target];
    },
  }) as McpServer;

  registerSearchTools(registrarServer);
  await registerGlobalOrganizationTools(registrarServer, apiClient);
  await registerIdentityProviderTools(registrarServer, apiClient);
  await registerGlobalUserTools(registrarServer, apiClient);
  await registerCrossProductAnalyticsTools(registrarServer, apiClient);
  await registerDirectoryHealthTools(registrarServer, apiClient);
  await registerOrganizationManagementTools(registrarServer, apiClient);
  await registerEnhancedDirectoryAnalyticsTools(registrarServer, apiClient);
  await registerApiSecurityMonitoringTools(registrarServer, apiClient);

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

export { registerGlobalOrganizationTools } from './tools/global-organization.js';
export { registerIdentityProviderTools } from './tools/identity-providers.js';
export { registerGlobalUserTools } from './tools/global-users.js';
export { registerCrossProductAnalyticsTools } from './tools/cross-product-analytics.js';
export { registerDirectoryHealthTools } from './tools/directory-health.js';
export { registerOrganizationManagementTools } from './tools/organization-management.js';
export { registerEnhancedDirectoryAnalyticsTools } from './tools/enhanced-directory-analytics.js';
export { registerApiSecurityMonitoringTools } from './tools/api-security-monitoring.js';
