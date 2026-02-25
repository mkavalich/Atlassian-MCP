/**
 * Optimized Server Factory
 *
 * Creates an optimized MCP server by wrapping a base server with
 * optimization hooks (caching, deferred schema loading, response
 * formatting, telemetry).
 *
 * Auth and HTTP transport are handled externally.
 * Servers are standalone MCP servers.
 */

import {
  createOptimizationHooks,
  type OptimizationHooksConfig,
  type SupportedServer,
} from '../hooks/index.js';

/**
 * Configuration for optimized server creation.
 */
export interface OptimizedServerConfig {
  /** Server name (e.g., 'jira-projects') */
  name: string;
  /** Server type for hook configuration (e.g., 'jira-projects') */
  serverType?: SupportedServer;
  /** Base server's createServer function */
  createBaseServer: (config: any) => Promise<any>;
  /** Enable response caching (default: true) */
  enableCaching?: boolean;
  /** Enable deferred schema loading (default: true) */
  enableSchemaRegistry?: boolean;
  /** Enable debug logging (default: from DEBUG env) */
  debug?: boolean;
  /** Additional hooks to merge */
  additionalHooks?: Record<string, (...args: any[]) => Promise<any>>;
  /** Cache configuration */
  cacheConfig?: OptimizationHooksConfig['cacheConfig'];
}

/**
 * Create an optimized MCP server.
 *
 * @example
 * ```typescript
 * import { createServer } from 'jira-projects-mcp-server/exports';
 * import { createOptimizedServer } from '@atlassian-mcp/optimizations';
 *
 * const { server, start, stop, metrics } = await createOptimizedServer({
 *   name: 'jira-projects',
 *   createBaseServer: createServer,
 * });
 *
 * await start();
 * ```
 */
export async function createOptimizedServer(config: OptimizedServerConfig) {
  const {
    name,
    serverType,
    createBaseServer,
    enableCaching = true,
    enableSchemaRegistry = true,
    debug = process.env.DEBUG === 'true',
    additionalHooks = {},
    cacheConfig = {},
  } = config;

  // Derive serverType from name if not provided
  const derivedServerType = serverType || (name as SupportedServer);

  // Create optimization hooks
  const optimizations = createOptimizationHooks({
    serverName: derivedServerType,
    enableCaching,
    enableSchemaRegistry,
    debug,
    cacheConfig,
  });

  // Merge hooks, including schema transformation for optimized parameters
  const mergedHooks = {
    ...optimizations.hooks,
    // Add transformToolConfig to inject responseFormat parameter into tool schemas
    transformToolConfig: optimizations.schemaTransformer
      ? (name: string, config: unknown) => optimizations.schemaTransformer!.transformToolConfig(name, config)
      : undefined,
    ...additionalHooks,
  };

  // Create the server with optimization hooks
  const serverInstance = await createBaseServer({
    name,
    hooks: mergedHooks,
  });

  // Finalize setup (register load_tool_schema, etc.)
  optimizations.finalizeSetup(serverInstance.server);

  // Log startup
  if (debug) {
    console.log(`[${name}] Optimizations enabled:`);
    console.log(`  - Caching: ${enableCaching}`);
    console.log(`  - Schema Registry: ${enableSchemaRegistry}`);
  }

  return {
    ...serverInstance,
    optimizations,
    getMetrics: () => ({
      ...optimizations.getMetrics(),
      server: {
        name,
        version: '2.0.0',
      },
    }),
  };
}

/**
 * Start an optimized server with standard configuration.
 * Convenience function for Docker containers.
 *
 * The server starts via stdio. External infrastructure handles HTTP transport,
 * OAuth endpoints, and license validation.
 */
export async function startServer(config: OptimizedServerConfig) {
  const instance = await createOptimizedServer(config);

  // Determine transport from environment
  const transport = (process.env.TRANSPORT || 'stdio') as 'stdio' | 'http';

  await instance.start(transport);

  // Log metrics periodically in debug mode
  if (process.env.DEBUG === 'true') {
    setInterval(() => {
      const metrics = instance.getMetrics();
      console.log(`[${config.name}] Metrics:`, JSON.stringify(metrics, null, 2));
    }, 60000);
  }

  return instance;
}
