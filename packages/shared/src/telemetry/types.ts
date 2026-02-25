/**
 * Telemetry Types for MCP Servers
 *
 * This module defines interfaces for:
 * - MCP-native logging (RFC 5424 syslog levels)
 * - OpenTelemetry context propagation (W3C trace context)
 * - Audit event logging (interface only - The optimizations package implements)
 * - Hook integration for telemetry injection
 *
 * Design principles:
 * - Interface-first: Interface-first design with hook-based injection
 * - Hook-based injection: No core server modifications needed
 * - Dual-path logging: MCP-native AND OpenTelemetry simultaneously
 * - Security by default: Automatic sanitization of sensitive data
 *
 * References:
 * - MCP Logging Spec: https://modelcontextprotocol.io/specification/2025-03-26/server/utilities/logging
 * - OpenTelemetry for MCP: https://github.com/modelcontextprotocol/modelcontextprotocol/discussions/269
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// ============================================================================
// MCP Logging (RFC 5424 Syslog Levels)
// ============================================================================

/**
 * Log levels per RFC 5424 syslog specification.
 * Ordered from most severe (emergency) to least severe (debug).
 */
export type LogLevel =
  | 'emergency' // System unusable
  | 'alert' // Immediate action required
  | 'critical' // Critical conditions
  | 'error' // Error conditions
  | 'warning' // Warning conditions
  | 'notice' // Normal but significant
  | 'info' // Informational
  | 'debug'; // Debug-level messages

/**
 * MCP-native logger interface.
 * Sends log messages via notifications/message to MCP client.
 */
export interface McpLogger {
  /**
   * Log a message at the specified level.
   * @param level - Severity level (RFC 5424)
   * @param logger - Logger name/namespace
   * @param data - Structured log data (will be sanitized)
   */
  log(level: LogLevel, logger: string, data: Record<string, unknown>): void;

  /**
   * Set the minimum log level. Messages below this level are not sent.
   */
  setMinLevel(level: LogLevel): void;

  // Convenience methods
  debug(logger: string, data: Record<string, unknown>): void;
  info(logger: string, data: Record<string, unknown>): void;
  notice(logger: string, data: Record<string, unknown>): void;
  warning(logger: string, data: Record<string, unknown>): void;
  error(logger: string, data: Record<string, unknown>): void;
  critical(logger: string, data: Record<string, unknown>): void;
  alert(logger: string, data: Record<string, unknown>): void;
  emergency(logger: string, data: Record<string, unknown>): void;
}

// ============================================================================
// OpenTelemetry Context Propagation
// ============================================================================

/**
 * W3C Trace Context for distributed tracing.
 * Used for context propagation between MCP client and server.
 *
 * @see https://www.w3.org/TR/trace-context/
 */
export interface TraceContext {
  /**
   * W3C traceparent header value.
   * Format: "00-{trace_id}-{span_id}-{trace_flags}"
   * Example: "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01"
   */
  traceparent?: string;

  /**
   * W3C tracestate header value.
   * Vendor-specific trace data in key=value pairs.
   */
  tracestate?: string;
}

/**
 * A telemetry span representing a unit of work.
 * Wraps OpenTelemetry Span interface for MCP usage.
 */
export interface TelemetrySpan {
  /**
   * Set an attribute on this span.
   */
  setAttribute(key: string, value: string | number | boolean): void;

  /**
   * Add an event to this span.
   */
  addEvent(name: string, attributes?: Record<string, unknown>): void;

  /**
   * Record an exception that occurred during this span.
   */
  recordException(error: Error): void;

  /**
   * Set the status of this span.
   */
  setStatus(code: 'ok' | 'error', message?: string): void;

  /**
   * Get the trace context for propagation.
   */
  getContext(): TraceContext;
}

/**
 * Configuration for telemetry providers.
 */
export interface TelemetryConfig {
  /** Service/server name for trace attribution */
  serviceName: string;

  /** Service version */
  serviceVersion?: string;

  /** Sampling rate (0.0 to 1.0, default 1.0) */
  samplingRate?: number;

  /** Custom attributes to add to all spans */
  resourceAttributes?: Record<string, string>;

  /** Exporter configuration (optimizations package) */
  exporter?: {
    type: 'console' | 'otlp' | 'none';
    endpoint?: string;
    headers?: Record<string, string>;
  };
}

/**
 * Telemetry provider interface.
 * The optimizations package implements full OpenTelemetry; base provides no-op stub.
 */
export interface TelemetryProvider {
  /**
   * Initialize the telemetry provider.
   */
  initialize(server: McpServer, config: TelemetryConfig): Promise<void>;

  /**
   * Start a span for a tool call.
   * @param toolName - Name of the tool being called
   * @param params - Tool parameters (sanitized before recording)
   * @param ctx - Optional trace context from client
   */
  startToolSpan(
    toolName: string,
    params: unknown,
    ctx?: TraceContext
  ): TelemetrySpan;

  /**
   * End a tool span with result or error.
   */
  endToolSpan(span: TelemetrySpan, result?: unknown, error?: Error): void;

  /**
   * Extract trace context from tool params._meta.
   * Per MCP convention, clients pass traceparent in params._meta.traceparent
   */
  extractTraceContext(params: unknown): TraceContext | undefined;

  /**
   * Shutdown and flush pending spans.
   */
  shutdown(): Promise<void>;
}

// ============================================================================
// Audit Events (Interface Only - Optimizations Package Implements)
// ============================================================================

/**
 * Operation types for audit classification.
 */
export type OperationType = 'read' | 'create' | 'update' | 'delete' | 'discovery';

/**
 * Audit event structure for compliance logging.
 *
 * NOTE: This is an interface only. Actual audit logging is in the optimizations package.
 * The pre-commit hook blocks keywords like `AuditLogger` (class) in code.
 */
export interface AuditEvent {
  /** Unique event identifier (UUID) */
  eventId: string;

  /** ISO 8601 timestamp */
  timestamp: string;

  /** Event type */
  eventType: 'tool_call_start' | 'tool_call_success' | 'tool_call_error';

  /** Name of the tool that was called */
  toolName: string;

  /** Classification of the operation */
  operationType: OperationType;

  /** Whether the operation succeeded */
  success: boolean;

  /** Duration in milliseconds */
  durationMs: number;

  /** Request details (sanitized - no sensitive values) */
  request: {
    /** Parameter keys (not values, for privacy) */
    parameterKeys: string[];

    /** Response size if available */
    responseSizeBytes?: number;
  };

  /** Trace context if available */
  trace?: TraceContext;

  /** Error details if failed */
  error?: {
    type: string;
    message: string;
  };
}

/**
 * Audit logger interface for compliance logging.
 *
 * NOTE: Implementation is in the optimizations package.
 */
export interface AuditLoggerInterface {
  /**
   * Log an audit event.
   */
  log(event: AuditEvent): Promise<void>;

  /**
   * Flush pending audit events.
   */
  flush(): Promise<void>;
}

// ============================================================================
// Hook Integration
// ============================================================================

/**
 * Context passed through telemetry hooks.
 * Stores providers and state for a single tool call.
 */
export interface TelemetryHookContext {
  /** MCP logger instance */
  mcpLogger?: McpLogger;

  /** OpenTelemetry provider */
  telemetryProvider?: TelemetryProvider;

  /** Audit logger */
  auditLogger?: AuditLoggerInterface;

  /** Current span for this tool call */
  currentSpan?: TelemetrySpan;

  /** Start time for duration calculation */
  startTime?: number;
}

/**
 * Options for creating telemetry hooks.
 */
export interface TelemetryHookOptions {
  /** MCP logging configuration */
  mcpLogging?: {
    enabled: boolean;
    /** Minimum log level (default: 'info') */
    minLevel?: LogLevel;
    /** Logger name prefix */
    loggerPrefix?: string;
  };

  /** OpenTelemetry configuration (optimizations package) */
  openTelemetry?: {
    enabled: boolean;
    config?: TelemetryConfig;
    /** Custom provider instance */
    provider?: TelemetryProvider;
  };

  /** Audit logging configuration (optimizations package) */
  auditLogging?: {
    enabled: boolean;
    /** Custom audit logger instance */
    logger?: AuditLoggerInterface;
  };
}

/**
 * Hooks returned by createTelemetryHooks.
 * These integrate with the ServerHooks interface in server.ts.
 */
export interface TelemetryHooks {
  /** Called before tool execution */
  onToolCall?: (toolName: string, params: unknown) => Promise<void>;

  /** Called after tool execution to transform/log response */
  transformResponse?: (
    toolName: string,
    result: unknown,
    params?: unknown
  ) => Promise<unknown>;

  /** Called on tool errors */
  onToolError?: (toolName: string, error: Error) => Promise<void>;

  /** Called after server creation for initialization */
  onServerCreate?: (server: McpServer) => Promise<void>;
}
