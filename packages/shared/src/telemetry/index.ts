/**
 * Telemetry Module for MCP Servers
 *
 * Provides:
 * - Type definitions for MCP logging, OpenTelemetry, and audit events
 * - SimpleMcpLogger for MCP-native logging
 * - Hook factory for telemetry integration
 * - Constants for log levels
 *
 * @example
 * ```typescript
 * import {
 *   type McpLogger,
 *   type TelemetryProvider,
 *   LOG_LEVELS,
 *   createTelemetryHooks
 * } from '@atlassian-mcp/shared/telemetry';
 *
 * const hooks = createTelemetryHooks({
 *   mcpLogging: { enabled: true, minLevel: 'info' }
 * });
 * ```
 *
 * @packageDocumentation
 */

// ============================================================================
// Type Exports
// ============================================================================

export type {
  // MCP Logging
  LogLevel,
  McpLogger,
  // OpenTelemetry
  TraceContext,
  TelemetrySpan,
  TelemetryConfig,
  TelemetryProvider,
  // Audit Events (Interface only)
  OperationType,
  AuditEvent,
  AuditLoggerInterface,
  // Hook Integration
  TelemetryHookContext,
  TelemetryHookOptions,
  TelemetryHooks,
} from './types.js';

// ============================================================================
// Implementation Exports
// ============================================================================

export { SimpleMcpLogger } from './mcp-logger.js';
export { createTelemetryHooks, createTelemetryContext } from './hooks.js';

// ============================================================================
// Constants
// ============================================================================

/**
 * Log levels in order from most to least severe.
 * Per RFC 5424 syslog specification.
 */
export const LOG_LEVELS = [
  'emergency',
  'alert',
  'critical',
  'error',
  'warning',
  'notice',
  'info',
  'debug',
] as const;

/**
 * Numeric severity for each log level (lower = more severe).
 * Used for filtering by minimum level.
 */
export const LOG_LEVEL_SEVERITY: Record<(typeof LOG_LEVELS)[number], number> = {
  emergency: 0,
  alert: 1,
  critical: 2,
  error: 3,
  warning: 4,
  notice: 5,
  info: 6,
  debug: 7,
};

/**
 * Keys that should be redacted from log data for security.
 * Case-insensitive partial match.
 */
export const REDACT_KEYS = [
  'password',
  'token',
  'apikey',
  'api_key',
  'secret',
  'authorization',
  'credential',
  'bearer',
  'cookie',
  'session',
  'private',
] as const;
