/**
 * Telemetry Hooks with Audit Logging
 *
 * Enhanced telemetry hooks that integrate:
 * - MCP-native logging
 * - Audit logging
 * - Operation classification and tracking
 *
 * Extends createTelemetryHooks with full audit capabilities.
 */

import {
  createTelemetryHooks,
  createTelemetryContext,
  SimpleMcpLogger,
  type TelemetryHookOptions,
  type TelemetryHooks,
  type OperationType,
  type TraceContext,
} from '@atlassian-mcp/shared/telemetry';
import { AuditLogger, type AuditLoggerConfig } from './audit-logger.js';

// Use 'any' for McpServer to avoid type incompatibility between SDK instances
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type McpServerAny = any;

/**
 * Telemetry configuration with audit support.
 * Extends base options with audit-specific settings.
 */
export interface TelemetryWithAuditConfig extends TelemetryHookOptions {
  /** Audit logging configuration */
  auditLogging?: {
    enabled: boolean;
    /** Pre-configured AuditLogger instance */
    logger?: AuditLogger;
    /** Or provide config to create one */
    config?: AuditLoggerConfig;
  };
}

/**
 * Extract trace context from tool parameters.
 * Per MCP convention, clients may pass traceparent in params._meta.traceparent
 */
function extractTraceContext(params: unknown): TraceContext | undefined {
  if (typeof params !== 'object' || params === null) {
    return undefined;
  }

  const meta = (params as Record<string, unknown>)._meta;
  if (typeof meta !== 'object' || meta === null) {
    return undefined;
  }

  const traceparent = (meta as Record<string, unknown>).traceparent;
  const tracestate = (meta as Record<string, unknown>).tracestate;

  if (typeof traceparent !== 'string') {
    return undefined;
  }

  return {
    traceparent,
    tracestate: typeof tracestate === 'string' ? tracestate : undefined,
  };
}

/**
 * Classify a tool name into an operation type for audit purposes.
 */
function classifyOperation(toolName: string): OperationType {
  const lower = toolName.toLowerCase();

  if (
    lower.startsWith('create_') ||
    lower.startsWith('add_') ||
    lower.startsWith('upload_')
  ) {
    return 'create';
  }

  if (
    lower.startsWith('update_') ||
    lower.startsWith('edit_') ||
    lower.startsWith('modify_') ||
    lower.startsWith('set_') ||
    lower.startsWith('transition_') ||
    lower.startsWith('assign_') ||
    lower.startsWith('move_')
  ) {
    return 'update';
  }

  if (lower.startsWith('delete_') || lower.startsWith('remove_')) {
    return 'delete';
  }

  if (
    lower.startsWith('search_') ||
    lower.startsWith('list_') ||
    lower.startsWith('get_') ||
    lower.startsWith('find_') ||
    lower.startsWith('discover_')
  ) {
    return 'discovery';
  }

  return 'read';
}

/**
 * Get the keys from an object for audit logging (values are not logged).
 */
function getParameterKeys(params: unknown): string[] {
  if (typeof params !== 'object' || params === null) {
    return [];
  }
  return Object.keys(params as Record<string, unknown>).filter(
    (key) => key !== '_meta'
  );
}

/**
 * Create telemetry hooks with full audit logging.
 *
 * Extends the base createTelemetryHooks with audit logging capabilities.
 *
 * @example
 * ```typescript
 * import { createTelemetryHooksWithAudit, AuditLogger } from './telemetry/index.js';
 *
 * const hooks = createTelemetryHooksWithAudit({
 *   mcpLogging: { enabled: true, minLevel: 'info', loggerPrefix: 'jira-projects' },
 *   auditLogging: {
 *     enabled: true,
 *     config: {
 *       backend: 'file',
 *       filePath: './audit.jsonl',
 *     },
 *   },
 * });
 *
 * const { start } = await createServer({ hooks });
 * ```
 */
export function createTelemetryHooksWithAudit(
  config: TelemetryWithAuditConfig
): TelemetryHooks & { shutdown?: () => Promise<void> } {
  // Get base hooks
  const baseHooks = createTelemetryHooks(config);

  // If no audit logging, just return base hooks
  if (!config.auditLogging?.enabled) {
    return baseHooks;
  }

  // Initialize audit logger
  const auditLogger =
    config.auditLogging.logger ||
    (config.auditLogging.config
      ? new AuditLogger(config.auditLogging.config)
      : null);

  if (!auditLogger) {
    console.error(
      '[telemetry] Audit logging enabled but no logger or config provided'
    );
    return baseHooks;
  }

  // Context for tracking per-call state
  let ctx = createTelemetryContext();
  let currentParams: unknown;
  let mcpLogger: SimpleMcpLogger | undefined;

  return {
    /**
     * Called after MCP server is created.
     * Initializes MCP logger and audit logger.
     */
    onServerCreate: async (server: McpServerAny): Promise<void> => {
      // Call base hook
      if (baseHooks.onServerCreate) {
        await baseHooks.onServerCreate(server);
      }

      // Initialize MCP logger
      if (config.mcpLogging?.enabled) {
        const prefix = config.mcpLogging.loggerPrefix || 'mcp-server';
        mcpLogger = new SimpleMcpLogger(server, prefix);
        if (config.mcpLogging.minLevel) {
          mcpLogger.setMinLevel(config.mcpLogging.minLevel);
        }
      }
    },

    /**
     * Called before tool execution.
     * Logs start event to MCP and audit log.
     */
    onToolCall: async (toolName: string, params: unknown): Promise<void> => {
      // Reset context
      ctx = createTelemetryContext();
      currentParams = params;

      const traceContext = extractTraceContext(params);
      const operationType = classifyOperation(toolName);
      const paramKeys = getParameterKeys(params);

      // Call base hook (MCP logging)
      if (baseHooks.onToolCall) {
        await baseHooks.onToolCall(toolName, params);
      }

      // Audit log start event
      try {
        const startEvent = AuditLogger.createStartEvent(
          toolName,
          operationType,
          paramKeys,
          traceContext
        );
        await auditLogger.log(startEvent);
      } catch (e) {
        // Audit errors should never break tool execution
        console.error('[audit] Start event failed:', (e as Error).message);
      }
    },

    /**
     * Called on tool errors.
     * Logs error to MCP and audit log.
     */
    onToolError: async (toolName: string, error: Error): Promise<void> => {
      const duration = Date.now() - (ctx.startTime || Date.now());
      const operationType = classifyOperation(toolName);
      const paramKeys = getParameterKeys(currentParams);
      const traceContext = extractTraceContext(currentParams);

      // Call base hook (MCP logging)
      if (baseHooks.onToolError) {
        await baseHooks.onToolError(toolName, error);
      }

      // Audit log error event
      try {
        const errorEvent = AuditLogger.createErrorEvent(
          toolName,
          operationType,
          paramKeys,
          duration,
          error,
          traceContext
        );
        await auditLogger.log(errorEvent);
      } catch (e) {
        console.error('[audit] Error event failed:', (e as Error).message);
      }
    },

    /**
     * Called after tool execution.
     * Logs success to MCP and audit log.
     */
    transformResponse: async (
      toolName: string,
      result: unknown,
      params?: unknown
    ): Promise<unknown> => {
      const duration = Date.now() - (ctx.startTime || Date.now());
      const operationType = classifyOperation(toolName);
      const paramKeys = getParameterKeys(params || currentParams);
      const traceContext = extractTraceContext(params || currentParams);

      // Calculate response size
      let responseSizeBytes = 0;
      try {
        responseSizeBytes = JSON.stringify(result).length;
      } catch {
        // Ignore serialization errors
      }

      // Call base hook (MCP logging + pass-through)
      let transformedResult = result;
      if (baseHooks.transformResponse) {
        transformedResult = await baseHooks.transformResponse(
          toolName,
          result,
          params
        );
      }

      // Audit log success event
      try {
        const successEvent = AuditLogger.createSuccessEvent(
          toolName,
          operationType,
          paramKeys,
          duration,
          responseSizeBytes,
          traceContext
        );
        await auditLogger.log(successEvent);
      } catch (e) {
        console.error('[audit] Success event failed:', (e as Error).message);
      }

      return transformedResult;
    },

    /**
     * Shutdown the audit logger.
     * Call this when stopping the server to flush remaining events.
     */
    shutdown: async (): Promise<void> => {
      await auditLogger.shutdown();
    },
  };
}
