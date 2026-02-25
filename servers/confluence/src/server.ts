/**
 * Confluence MCP Server - Server Factory
 *
 * Note: This server uses ConfluenceApiClient instead of JiraApiClient.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { z } from 'zod';
import { AuthManager } from './auth/index.js';
import { ConfluenceApiClient } from './api/client.js';
import { logger } from './utils/logger.js';
import type { AuthConfig } from './types/index.js';

import { registerPageTools } from './tools/pages.js';
import { registerSpaceTools } from './tools/spaces.js';
import { registerPermissionTools } from './tools/permissions.js';
import { registerCommentTools } from './tools/comments.js';
import { registerAttachmentTools } from './tools/attachments.js';
import { registerContentTools } from './tools/content.js';
import { registerAdminTools } from './tools/admin.js';

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
  onClientCreate?: (client: ConfluenceApiClient) => Promise<void>;
}

export interface ServerConfig {
  name?: string;
  version?: string;
  hooks?: ServerHooks;
  authConfig?: AuthConfig;
}

export interface ServerInstance {
  server: McpServer;
  apiClient: ConfluenceApiClient;
  start: (transport?: 'stdio' | 'http') => Promise<void>;
  stop: () => Promise<void>;
}

// ============================================================================
// Tool Catalog
// ============================================================================

export const toolCatalog = [
  // Spaces
  { name: 'search_spaces', category: 'spaces', type: 'discovery', description: 'Search for spaces - START HERE' },
  { name: 'get_space', category: 'spaces', type: 'read', description: 'Get space details' },
  { name: 'create_space', category: 'spaces', type: 'create', description: 'Create a new space' },
  { name: 'delete_space', category: 'spaces', type: 'delete', description: 'Delete a space' },
  { name: 'restore_space', category: 'spaces', type: 'update', description: 'Restore archived space' },
  { name: 'get_space_content', category: 'spaces', type: 'read', description: 'Get space pages' },
  { name: 'get_space_settings', category: 'spaces', type: 'read', description: 'Get space settings' },
  { name: 'update_space_settings', category: 'spaces', type: 'update', description: 'Update space settings' },
  { name: 'set_space_theme', category: 'spaces', type: 'update', description: 'Set space theme' },
  // Pages
  { name: 'search_pages', category: 'pages', type: 'discovery', description: 'Search for pages in a space' },
  { name: 'get_page', category: 'pages', type: 'read', description: 'Get page details and content' },
  { name: 'create_page', category: 'pages', type: 'create', description: 'Create a new page' },
  { name: 'update_page', category: 'pages', type: 'update', description: 'Update page content' },
  { name: 'delete_page', category: 'pages', type: 'delete', description: 'Delete a page' },
  { name: 'get_page_versions', category: 'pages', type: 'read', description: 'Get page version history' },
  { name: 'get_page_version', category: 'pages', type: 'read', description: 'Get specific page version' },
  { name: 'get_page_children', category: 'pages', type: 'read', description: 'Get child pages' },
  { name: 'get_page_ancestors', category: 'pages', type: 'read', description: 'Get parent pages' },
  { name: 'move_page', category: 'pages', type: 'update', description: 'Move page in hierarchy' },
  { name: 'copy_page', category: 'pages', type: 'create', description: 'Copy a page' },
  { name: 'get_page_restrictions', category: 'pages', type: 'read', description: 'Get page permissions' },
  { name: 'set_page_restrictions', category: 'pages', type: 'update', description: 'Set page permissions' },
  { name: 'get_page_likes', category: 'pages', type: 'read', description: 'Get page likes' },
  // Permissions
  { name: 'get_space_permissions', category: 'permissions', type: 'read', description: 'Get space permissions' },
  { name: 'get_permission_types', category: 'permissions', type: 'discovery', description: 'List permission types' },
  { name: 'check_content_permission', category: 'permissions', type: 'read', description: 'Check content permission' },
  // Comments
  { name: 'get_page_comments', category: 'comments', type: 'read', description: 'Get all comments' },
  { name: 'get_footer_comments', category: 'comments', type: 'read', description: 'Get footer comments' },
  { name: 'get_inline_comments', category: 'comments', type: 'read', description: 'Get inline comments' },
  { name: 'add_footer_comment', category: 'comments', type: 'create', description: 'Add footer comment' },
  { name: 'update_comment', category: 'comments', type: 'update', description: 'Edit comment' },
  { name: 'delete_comment', category: 'comments', type: 'delete', description: 'Delete comment' },
  { name: 'get_comment_children', category: 'comments', type: 'read', description: 'Get comment replies' },
  // Attachments
  { name: 'get_attachments', category: 'attachments', type: 'read', description: 'Get page attachments' },
  { name: 'get_attachment', category: 'attachments', type: 'read', description: 'Get attachment details' },
  { name: 'upload_attachment', category: 'attachments', type: 'create', description: 'Upload file' },
  { name: 'update_attachment', category: 'attachments', type: 'update', description: 'Update attachment' },
  { name: 'delete_attachment', category: 'attachments', type: 'delete', description: 'Delete attachment' },
  { name: 'download_attachment', category: 'attachments', type: 'read', description: 'Get download URL' },
  { name: 'get_attachment_versions', category: 'attachments', type: 'read', description: 'Get attachment versions' },
  { name: 'copy_attachment', category: 'attachments', type: 'create', description: 'Copy attachment' },
  // Templates
  { name: 'get_templates', category: 'templates', type: 'discovery', description: 'List templates' },
  { name: 'get_template', category: 'templates', type: 'read', description: 'Get template details' },
  { name: 'create_template', category: 'templates', type: 'create', description: 'Create template' },
  { name: 'delete_template', category: 'templates', type: 'delete', description: 'Delete template' },
  // Labels
  { name: 'get_labels', category: 'labels', type: 'read', description: 'Get content labels' },
  { name: 'add_labels', category: 'labels', type: 'create', description: 'Add labels' },
  { name: 'get_space_labels', category: 'labels', type: 'read', description: 'Get space labels' },
  // Search
  { name: 'search_cql', category: 'search', type: 'discovery', description: 'CQL search' },
  { name: 'search_content', category: 'search', type: 'discovery', description: 'Text search' },
  // Blogs
  { name: 'get_blog_posts', category: 'blogs', type: 'discovery', description: 'List blog posts' },
  { name: 'get_blog_post', category: 'blogs', type: 'read', description: 'Get blog post' },
  { name: 'create_blog_post', category: 'blogs', type: 'create', description: 'Create blog post' },
  { name: 'update_blog_post', category: 'blogs', type: 'update', description: 'Update blog post' },
  { name: 'delete_blog_post', category: 'blogs', type: 'delete', description: 'Delete blog post' },
  // Properties
  { name: 'get_content_properties', category: 'properties', type: 'read', description: 'Get properties' },
  { name: 'create_content_property', category: 'properties', type: 'create', description: 'Create property' },
  { name: 'update_content_property', category: 'properties', type: 'update', description: 'Update property' },
  { name: 'delete_content_property', category: 'properties', type: 'delete', description: 'Delete property' },
  // Watchers
  { name: 'get_content_watchers', category: 'watchers', type: 'read', description: 'Get watchers' },
  { name: 'add_content_watch', category: 'watchers', type: 'create', description: 'Watch content' },
  { name: 'remove_content_watch', category: 'watchers', type: 'delete', description: 'Unwatch content' },
  { name: 'get_space_watchers', category: 'watchers', type: 'read', description: 'Get space watchers' },
  // Admin
  { name: 'get_audit_records', category: 'admin', type: 'read', description: 'Get audit logs' },
  { name: 'get_system_info', category: 'admin', type: 'read', description: 'Get system info' },
  { name: 'get_content_states', category: 'admin', type: 'read', description: 'List content states' },
  { name: 'set_content_state', category: 'admin', type: 'update', description: 'Set content state' },
  // Meta
  { name: 'search_tools', category: 'meta', type: 'discovery', description: 'Discover available tools by category or type' },
];

// Pre-computed Sets for efficient lookups
const TOOL_CATEGORIES = new Set(toolCatalog.map(t => t.category));
const TOOL_TYPES = new Set(toolCatalog.map(t => t.type));

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
      const finalConfig = hooks.transformToolConfig
        ? hooks.transformToolConfig(name, config)
        : config;
      const wrappedHandler = async (params: any) => {
        if (hooks.onToolCall) await hooks.onToolCall(name, params);
        try {
          let result = await handler(params);
          if (hooks.transformResponse) result = await hooks.transformResponse(name, result, params);
          return result;
        } catch (error) {
          if (hooks.onToolError) await hooks.onToolError(name, error as Error);
          throw error;
        }
      };
      server.registerTool(name, finalConfig, wrappedHandler);
    }) as McpServer['registerTool'],
  };
}

function getAuthConfigFromEnv(): AuthConfig {
  return {
    type: 'basic',
    baseUrl: process.env.ATLASSIAN_SITE_URL || '',
    email: process.env.ATLASSIAN_USER_EMAIL || '',
    apiToken: process.env.ATLASSIAN_API_TOKEN || '',
  };
}

function registerSearchTools(server: McpServer) {
  server.registerTool(
    'search_tools',
    {
      title: 'Search Confluence Tools',
      description: 'Find available Confluence tools by category or operation type. START HERE.',
      inputSchema: {
        category: z.enum(['spaces', 'pages', 'permissions', 'comments', 'attachments', 'templates', 'labels', 'search', 'blogs', 'properties', 'watchers', 'admin', 'all']).optional().default('all'),
        type: z.enum(['discovery', 'read', 'create', 'update', 'delete', 'all']).optional().default('all'),
        query: z.string().optional().describe('Search tool names and descriptions'),
      },
      annotations: { title: 'Search Confluence Tools', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params: { category?: string; type?: string; query?: string }) => {
      const category = params.category || 'all';
      const type = params.type || 'all';
      let tools = [...toolCatalog];
      if (category !== 'all') tools = tools.filter(t => t.category === category);
      if (type !== 'all') tools = tools.filter(t => t.type === type);
      if (params.query) {
        const query = params.query.toLowerCase();
        tools = tools.filter(t => t.name.toLowerCase().includes(query) || t.description.toLowerCase().includes(query));
      }
      const grouped = tools.reduce((acc, tool) => {
        if (!acc[tool.category]) acc[tool.category] = [];
        acc[tool.category].push(tool);
        return acc;
      }, {} as Record<string, typeof tools>);
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            tools,
            groupedByCategory: grouped,
            count: tools.length,
            totalAvailable: toolCatalog.length,
            availableCategories: [...TOOL_CATEGORIES],
            availableTypes: [...TOOL_TYPES],
            getting_started: [
              '1. Use "search_spaces" to find Confluence spaces',
              '2. Use "search_pages" with a spaceId to find pages',
              '3. Use "get_page" with a pageId to read content',
            ],
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
  const serverName = config.name || 'confluence-mcp-server';
  const serverVersion = config.version || '1.0.0';

  const server = new McpServer({ name: serverName, version: serverVersion });

  if (config.hooks?.onServerCreate) await config.hooks.onServerCreate(server);

  const authConfig = config.authConfig || getAuthConfigFromEnv();
  const authManager = new AuthManager(authConfig);
  const apiClient = new ConfluenceApiClient(authManager);

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
  await registerSpaceTools(registrarServer, apiClient);
  await registerPageTools(registrarServer, apiClient);
  await registerPermissionTools(registrarServer, apiClient);
  await registerCommentTools(registrarServer, apiClient);
  await registerAttachmentTools(registrarServer, apiClient);
  await registerContentTools(registrarServer, apiClient);
  await registerAdminTools(registrarServer, apiClient);

  let httpServer: ReturnType<typeof express.application.listen> | null = null;

  const start = async (transport: 'stdio' | 'http' = 'stdio') => {
    if (transport === 'http') {
      const app = express();
      app.use(express.json());
      app.get('/health', (_req, res) => res.json({ status: 'healthy', server: serverName, version: serverVersion, timestamp: new Date().toISOString() }));
      app.post('/mcp', async (req, res) => {
        const t = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
        res.on('close', () => t.close());
        await server.connect(t);
        await t.handleRequest(req, res, req.body);
      });
      const port = parseInt(process.env.MCP_PORT || '3000');
      httpServer = app.listen(port, () => {
        logger.info(`HTTP server listening on port ${port}`);
        console.error(`Confluence MCP Server running on http://localhost:${port}`);
      });
    } else {
      const t = new StdioServerTransport();
      await server.connect(t);
      logger.info('Server connected via stdio transport');
    }
    const shutdown = async () => {
      logger.info('Shutting down...');
      if (httpServer) httpServer.close();
      await server.close();
      process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  };

  const stop = async () => { if (httpServer) httpServer.close(); await server.close(); };

  return { server, apiClient, start, stop };
}

export { registerPageTools } from './tools/pages.js';
export { registerSpaceTools } from './tools/spaces.js';
export { registerPermissionTools } from './tools/permissions.js';
export { registerCommentTools } from './tools/comments.js';
export { registerAttachmentTools } from './tools/attachments.js';
export { registerContentTools } from './tools/content.js';
export { registerAdminTools } from './tools/admin.js';
