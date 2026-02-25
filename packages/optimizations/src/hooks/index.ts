/**
 * Optimization Hooks
 *
 * Pre-built hooks for server optimizations:
 * - Caching: Response caching via SemanticCache
 * - Schema Registry: Deferred schema loading
 * - Response Formatting: TOON/TSV compact formats
 * - Telemetry: Audit logging and MCP-native logging
 *
 * Auth is handled by the transport layer, not server-side hooks.
 */

import {
  createCachingHook,
  defaultCachingHook,
  type CachingHookConfig,
} from './caching.js';

import {
  createSchemaRegistryHook,
  type SchemaRegistryHookConfig,
} from './schema-registry.js';

import {
  createResponseFormatterHook,
  defaultResponseFormatter,
  type ResponseFormatterConfig,
} from './response-formatter.js';

import {
  createSchemaTransformer,
  defaultSchemaTransformer,
  type SchemaTransformerConfig,
} from './schema-transformer.js';

import {
  createTelemetryHooksWithAudit,
  AuditLogger,
  type TelemetryWithAuditConfig,
  type AuditLoggerConfig,
  type LogLevel,
} from '../telemetry/index.js';

// Re-export caching
export {
  createCachingHook,
  defaultCachingHook,
  type CachingHookConfig,
};

// Re-export schema registry
export {
  createSchemaRegistryHook,
  type SchemaRegistryHookConfig,
};

// Re-export response formatting
export {
  createResponseFormatterHook,
  defaultResponseFormatter,
  type ResponseFormatterConfig,
};

// Re-export schema transformer
export {
  createSchemaTransformer,
  defaultSchemaTransformer,
  type SchemaTransformerConfig,
};

// Re-export telemetry hooks
export {
  createTelemetryHooksWithAudit,
  AuditLogger,
  type TelemetryWithAuditConfig,
  type AuditLoggerConfig,
  type LogLevel,
};

/**
 * Server names supported by this package.
 */
export type SupportedServer =
  | 'jira-projects'
  | 'jira-workflows'
  | 'jira-fields-permissions'
  | 'jira-service-desk'
  | 'jira-system-admin'
  | 'jira-organization'
  | 'jira-product-discovery'
  | 'confluence';

/**
 * Combined optimization hooks configuration.
 */
export interface OptimizationHooksConfig {
  /** Server name for logging and error messages */
  serverName: SupportedServer;
  /** Enable response caching */
  enableCaching?: boolean;
  /** Enable deferred schema loading */
  enableSchemaRegistry?: boolean;
  /** Enable response formatting (TOON/TSV) */
  enableResponseFormatting?: boolean;
  /** Default response format */
  defaultResponseFormat?: 'concise' | 'standard' | 'detailed';
  /** Enable debug logging */
  debug?: boolean;
  /** Cache configuration overrides */
  cacheConfig?: {
    maxEntries?: number;
    defaultTTL?: number;
    excludePaths?: string[];
  };
  /** Enable MCP-native telemetry logging */
  enableTelemetry?: boolean;
  /** Minimum log level for telemetry (default: 'info') */
  telemetryLogLevel?: LogLevel;
  /** Enable audit logging */
  enableAuditLogging?: boolean;
  /** Audit logger configuration */
  auditConfig?: AuditLoggerConfig;
}

/**
 * Create a complete set of optimization hooks.
 *
 * @example
 * ```typescript
 * import { createOptimizationHooks } from '@atlassian-mcp/optimizations';
 * import { createServer } from 'jira-projects-mcp-server/exports';
 *
 * const opts = createOptimizationHooks({
 *   serverName: 'jira-projects',
 *   enableCaching: true,
 *   enableSchemaRegistry: true,
 * });
 *
 * const { start } = await createServer({
 *   hooks: opts.hooks,
 * });
 *
 * // After tool registration
 * opts.finalizeSetup(server);
 *
 * await start();
 * ```
 */
export function createOptimizationHooks(config: OptimizationHooksConfig) {
  const {
    serverName,
    enableCaching = true,
    enableSchemaRegistry = true,
    enableResponseFormatting = true,
    defaultResponseFormat = 'concise',
    debug = process.env.DEBUG === 'true',
    cacheConfig = {},
    enableTelemetry = true,
    telemetryLogLevel = 'info',
    enableAuditLogging = false,
    auditConfig,
  } = config;

  // Initialize caching hook
  const caching = enableCaching
    ? createCachingHook({
        debug,
        ...cacheConfig,
      })
    : null;

  const schemaRegistry = enableSchemaRegistry
    ? createSchemaRegistryHook({
        serverName,
        debug,
      })
    : null;

  const responseFormatter = enableResponseFormatting
    ? createResponseFormatterHook({
        defaultFormat: defaultResponseFormat,
        debug,
      })
    : null;

  const schemaTransformer = enableResponseFormatting
    ? createSchemaTransformer({ debug })
    : null;

  // Initialize telemetry hooks
  const telemetryHooks = enableTelemetry || enableAuditLogging
    ? createTelemetryHooksWithAudit({
        mcpLogging: enableTelemetry
          ? {
              enabled: true,
              minLevel: telemetryLogLevel,
              loggerPrefix: serverName,
            }
          : undefined,
        auditLogging: enableAuditLogging && auditConfig
          ? {
              enabled: true,
              config: auditConfig,
            }
          : undefined,
      })
    : null;

  /**
   * Combined hooks object for createServer.
   */
  const hooks = {
    onClientCreate: async (client: any) => {
      if (caching) {
        await caching.onClientCreate(client);
      }
    },

    onServerCreate: async (server: any) => {
      if (schemaRegistry) {
        await schemaRegistry.onServerCreate(server);
      }
      // Initialize telemetry
      if (telemetryHooks?.onServerCreate) {
        await telemetryHooks.onServerCreate(server);
      }
    },

    onToolCall: async (toolName: string, params: unknown) => {
      // Telemetry and audit logging
      if (telemetryHooks?.onToolCall) {
        await telemetryHooks.onToolCall(toolName, params);
      }
    },

    transformResponse: async (toolName: string, result: unknown, params?: unknown) => {
      // Telemetry logging (pass-through)
      let transformedResult = result;
      if (telemetryHooks?.transformResponse) {
        transformedResult = await telemetryHooks.transformResponse(toolName, result, params);
      }
      // Response formatting (may modify result)
      if (responseFormatter) {
        return responseFormatter.transformResponse(toolName, transformedResult, params as Record<string, unknown>);
      }
      return transformedResult;
    },

    onToolError: async (toolName: string, error: Error) => {
      // Telemetry and audit logging
      if (telemetryHooks?.onToolError) {
        await telemetryHooks.onToolError(toolName, error);
      }
    },
  };

  /**
   * Finalize setup after all tools are registered.
   * Call this before starting the server.
   */
  function finalizeSetup(server: any): void {
    if (schemaRegistry) {
      schemaRegistry.registerSchemaLoader(server);
    }
  }

  /**
   * Get metrics from all enabled hooks.
   */
  function getMetrics() {
    return {
      cache: caching?.getMetrics() ?? null,
      schemaRegistry: schemaRegistry
        ? {
            toolCount: schemaRegistry.getRegistry().size,
            tools: schemaRegistry.getToolMetadata(),
          }
        : null,
      responseFormatting: responseFormatter ? { enabled: true } : null,
      telemetry: enableTelemetry ? { enabled: true, logLevel: telemetryLogLevel } : null,
      auditLogging: enableAuditLogging ? { enabled: true, backend: auditConfig?.backend } : null,
    };
  }

  /**
   * Shutdown all hooks gracefully.
   * Call this when stopping the server to flush audit logs.
   */
  async function shutdown(): Promise<void> {
    if (telemetryHooks?.shutdown) {
      await telemetryHooks.shutdown();
    }
  }

  /**
   * Wrap registerTool to inject optimization parameters into schemas.
   */
  function wrapRegisterTool(
    originalRegisterTool: (name: string, config: any, handler: any) => void
  ): (name: string, config: any, handler: any) => void {
    if (schemaTransformer) {
      return schemaTransformer.wrapRegisterTool(originalRegisterTool);
    }
    return originalRegisterTool;
  }

  return {
    hooks,
    finalizeSetup,
    getMetrics,
    shutdown,
    wrapRegisterTool,
    caching,
    schemaRegistry,
    responseFormatter,
    schemaTransformer,
    telemetryHooks,
  };
}
