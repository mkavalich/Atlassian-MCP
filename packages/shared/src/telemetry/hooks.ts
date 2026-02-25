/**
 * Telemetry Hooks Factory
 *
 * Creates hooks for integrating telemetry into MCP servers.
 * These hooks plug into the ServerHooks interface defined in each server.
 *
 * Base implementation provides:
 * - MCP-native logging via SimpleMcpLogger
 * - Basic context tracking (start time, etc.)
 *
 * The optimizations package extends with:
 * - Full OpenTelemetry instrumentation
 * - Audit logging with compliance backends
 *
 * @example
 * ```typescript
 * import { createTelemetryHooks } from '@atlassian-mcp/shared/telemetry';
 *
 * const hooks = createTelemetryHooks({
 *   mcpLogging: { enabled: true, minLevel: 'info' }
 * });
 *
 * const { start } = await createServer({ hooks });
 * ```
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type {
  TelemetryHookContext,
  TelemetryHookOptions,
  TelemetryHooks,
  TraceContext,
  OperationType,
} from './types.js';
import { SimpleMcpLogger } from './mcp-logger.js';

/**
 * Create a new telemetry context for tracking a tool call.
 */
export function createTelemetryContext(): TelemetryHookContext {
  return {
    startTime: Date.now(),
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
 * Uses naming conventions common in MCP servers.
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

  // Default to read for any unclassified operation
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
 * Create telemetry hooks for MCP server integration.
 *
 * This factory creates hooks that can be passed to createServer().
 * Base implementation provides MCP logging; The optimizations package extends with
 * OpenTelemetry and audit logging.
 *
 * @param options - Configuration for telemetry features
 * @returns Hooks compatible with ServerHooks interface
 *
 * @example
 * ```typescript
 * // Basic MCP logging
 * const hooks = createTelemetryHooks({
 *   mcpLogging: { enabled: true, minLevel: 'debug' }
 * });
 *
 * // With custom logger prefix
 * const hooks = createTelemetryHooks({
 *   mcpLogging: {
 *     enabled: true,
 *     loggerPrefix: 'confluence'
 *   }
 * });
 * ```
 */
export function createTelemetryHooks(
  options: TelemetryHookOptions
): TelemetryHooks {
  // Return empty hooks if nothing is enabled
  if (!options.mcpLogging?.enabled && !options.openTelemetry?.enabled) {
    return {};
  }

  // Per-call context storage (weak map keyed by something unique)
  // For simplicity, we use a closure variable that gets reset per call
  let ctx: TelemetryHookContext = createTelemetryContext();
  let mcpLogger: SimpleMcpLogger | undefined;
  let currentToolName: string | undefined;

  return {
    /**
     * Called after MCP server is created.
     * Initializes the MCP logger.
     */
    onServerCreate: async (server: McpServer): Promise<void> => {
      if (options.mcpLogging?.enabled) {
        const prefix = options.mcpLogging.loggerPrefix || 'mcp';
        mcpLogger = new SimpleMcpLogger(server, prefix);

        if (options.mcpLogging.minLevel) {
          mcpLogger.setMinLevel(options.mcpLogging.minLevel);
        }

        ctx.mcpLogger = mcpLogger;
      }

      // OpenTelemetry initialization is 
      if (options.openTelemetry?.enabled && options.openTelemetry.provider) {
        await options.openTelemetry.provider.initialize(
          server,
          options.openTelemetry.config || { serviceName: 'mcp-server' }
        );
        ctx.telemetryProvider = options.openTelemetry.provider;
      }

      // Audit logger is 
      if (options.auditLogging?.enabled && options.auditLogging.logger) {
        ctx.auditLogger = options.auditLogging.logger;
      }
    },

    /**
     * Called before tool execution.
     * Logs the start event and starts telemetry span.
     */
    onToolCall: async (toolName: string, params: unknown): Promise<void> => {
      // Reset context for this call
      ctx = createTelemetryContext();
      ctx.mcpLogger = mcpLogger;
      ctx.telemetryProvider = options.openTelemetry?.provider;
      ctx.auditLogger = options.auditLogging?.logger;
      currentToolName = toolName;

      const traceContext = extractTraceContext(params);
      const operationType = classifyOperation(toolName);
      const paramKeys = getParameterKeys(params);

      // MCP logging
      if (mcpLogger) {
        mcpLogger.info('tools', {
          event: 'tool_call_start',
          tool: toolName,
          operation: operationType,
          parameterCount: paramKeys.length,
          hasTraceContext: !!traceContext,
        });
      }

      // OpenTelemetry span (optimizations package)
      if (ctx.telemetryProvider) {
        try {
          ctx.currentSpan = ctx.telemetryProvider.startToolSpan(
            toolName,
            params,
            traceContext
          );
          ctx.currentSpan.setAttribute('mcp.tool_name', toolName);
          ctx.currentSpan.setAttribute('mcp.operation_type', operationType);
          ctx.currentSpan.addEvent('tool_call_start', {
            parameterKeys: paramKeys.join(','),
          });
        } catch (e) {
          // Telemetry errors should never break tool execution
          process.stderr.write(
            `[telemetry] Span creation failed: ${(e as Error).message}\n`
          );
        }
      }
    },

    /**
     * Called on tool errors.
     * Logs the error and records exception on span.
     */
    onToolError: async (toolName: string, error: Error): Promise<void> => {
      const duration = Date.now() - (ctx.startTime || Date.now());
      const operationType = classifyOperation(toolName);

      // MCP logging
      if (mcpLogger) {
        mcpLogger.error('tools', {
          event: 'tool_call_error',
          tool: toolName,
          operation: operationType,
          durationMs: duration,
          errorType: error.constructor.name,
          errorMessage: error.message,
        });
      }

      // OpenTelemetry span (optimizations package)
      if (ctx.currentSpan && ctx.telemetryProvider) {
        try {
          ctx.currentSpan.recordException(error);
          ctx.currentSpan.setStatus('error', error.message);
          ctx.currentSpan.setAttribute('mcp.duration_ms', duration);
          ctx.telemetryProvider.endToolSpan(
            ctx.currentSpan,
            undefined,
            error
          );
        } catch (e) {
          process.stderr.write(
            `[telemetry] Span error recording failed: ${(e as Error).message}\n`
          );
        }
      }
    },

    /**
     * Called after tool execution to transform/log response.
     * Logs success and ends telemetry span.
     *
     * NOTE: This hook does NOT modify the result - it passes through unchanged.
     * Response transformation (TOON format, etc.) is handled by other hooks.
     */
    transformResponse: async (
      toolName: string,
      result: unknown,
      _params?: unknown
    ): Promise<unknown> => {
      const duration = Date.now() - (ctx.startTime || Date.now());
      const operationType = classifyOperation(toolName);

      // Calculate response size (rough estimate)
      let responseSizeBytes = 0;
      try {
        responseSizeBytes = JSON.stringify(result).length;
      } catch {
        // Ignore serialization errors
      }

      // MCP logging
      if (mcpLogger) {
        mcpLogger.info('tools', {
          event: 'tool_call_success',
          tool: toolName,
          operation: operationType,
          durationMs: duration,
          responseSizeBytes,
        });
      }

      // OpenTelemetry span (optimizations package)
      if (ctx.currentSpan && ctx.telemetryProvider) {
        try {
          ctx.currentSpan.setStatus('ok');
          ctx.currentSpan.setAttribute('mcp.duration_ms', duration);
          ctx.currentSpan.setAttribute(
            'mcp.response_size_bytes',
            responseSizeBytes
          );
          ctx.currentSpan.addEvent('tool_call_success');
          ctx.telemetryProvider.endToolSpan(ctx.currentSpan, result, undefined);
        } catch (e) {
          process.stderr.write(
            `[telemetry] Span completion failed: ${(e as Error).message}\n`
          );
        }
      }

      // Pass through result unchanged
      return result;
    },
  };
}
