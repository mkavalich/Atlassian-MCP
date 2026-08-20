/**
 * Schema Registry Hook
 *
 * Enables deferred tool schema loading via the load_tool_schema tool.
 * Captures schemas so `load_tool_schema` can serve them. NOTE: this hook alone
 * does NOT shrink `tools/list` - it passes the tool config through unmodified.
 * The listing minimisation lives in ./deferred-listing.ts and is opt-in.
 */

import {
  ToolSchemaRegistry,
  registerLoadToolSchemaTool,
  type ToolSchemaEntry,
} from '../tools/index.js';

/**
 * Schema registry hook configuration.
 */
export interface SchemaRegistryHookConfig {
  /** Server name for error messages */
  serverName: string;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Creates a schema registry hook for deferred schema loading.
 *
 * This hook:
 * 1. Captures tool schemas during registration
 * 2. Registers a load_tool_schema tool for on-demand retrieval
 *
 * @example
 * ```typescript
 * import { createSchemaRegistryHook } from './hooks/schema-registry.js';
 *
 * const { wrapServer, onServerCreate } = createSchemaRegistryHook({
 *   serverName: 'jira-projects',
 * });
 *
 * // Use wrapServer to capture schemas during tool registration
 * const wrappedServer = wrapServer(server);
 * await registerTools(wrappedServer, client);
 *
 * // Or use onServerCreate hook
 * const { start } = await createServer({
 *   hooks: { onServerCreate }
 * });
 * ```
 */
export function createSchemaRegistryHook(config: SchemaRegistryHookConfig) {
  const { serverName, debug = false } = config;

  // Create registry instance
  const registry = new ToolSchemaRegistry();

  /**
   * Log helper.
   */
  function log(message: string) {
    if (debug) {
      console.log(`[SchemaRegistry:${serverName}] ${message}`);
    }
  }

  /**
   * Wrap a server to capture schemas during tool registration.
   */
  function wrapServer(server: any): any {
    const originalRegisterTool = server.registerTool.bind(server);

    server.registerTool = (name: string, config: any, handler: any) => {
      // Capture schema
      const entry: ToolSchemaEntry = {
        name,
        title: config.title,
        description: config.description || '',
        inputSchema: config.inputSchema,
        annotations: config.annotations,
        examples: config.examples,
      };
      registry.register(entry);
      log(`Registered schema: ${name}`);

      // Call original
      return originalRegisterTool(name, config, handler);
    };

    return server;
  }

  /**
   * Register the load_tool_schema tool on the server.
   * Call this after all other tools are registered.
   */
  function registerSchemaLoader(server: any): void {
    registerLoadToolSchemaTool(server, registry, serverName);
    log(`Registered load_tool_schema tool (${registry.size} schemas available)`);
  }

  /**
   * Hook for onServerCreate - wraps the server automatically.
   */
  async function onServerCreate(server: any): Promise<void> {
    wrapServer(server);
    log('Server wrapped for schema capture');
  }

  /**
   * Get the registry for direct access.
   */
  function getRegistry(): ToolSchemaRegistry {
    return registry;
  }

  /**
   * Get metadata for all registered tools.
   */
  function getToolMetadata() {
    return registry.getMetadata();
  }

  return {
    wrapServer,
    registerSchemaLoader,
    onServerCreate,
    getRegistry,
    getToolMetadata,
    registry, // Expose for advanced usage
  };
}
