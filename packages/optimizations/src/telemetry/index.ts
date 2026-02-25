/**
 * Telemetry Module
 *
 * Provides full implementations of the telemetry interfaces:
 * - AuditLogger: Compliance logging with multiple backends
 * - Enhanced telemetry hooks with audit integration
 *
 * @example
 * ```typescript
 * import { AuditLogger, createTelemetryHooksWithAudit } from '@atlassian-mcp/optimizations';
 *
 * const auditLogger = new AuditLogger({
 *   backend: 'file',
 *   filePath: '/var/log/mcp-audit.jsonl',
 * });
 *
 * const hooks = createTelemetryHooksWithAudit({
 *   mcpLogging: { enabled: true },
 *   auditLogging: { enabled: true, logger: auditLogger },
 * });
 * ```
 */

// Re-export shared types for convenience
export type {
  LogLevel,
  McpLogger,
  TraceContext,
  TelemetrySpan,
  TelemetryConfig,
  TelemetryProvider,
  OperationType,
  AuditEvent,
  AuditLoggerInterface,
  TelemetryHookContext,
  TelemetryHookOptions,
  TelemetryHooks,
} from '@atlassian-mcp/shared/telemetry';

// Export shared utilities
export {
  SimpleMcpLogger,
  createTelemetryHooks,
  createTelemetryContext,
  LOG_LEVELS,
  LOG_LEVEL_SEVERITY,
  REDACT_KEYS,
} from '@atlassian-mcp/shared/telemetry';

// Export audit implementations
export { AuditLogger, type AuditLoggerConfig, type AuditBackendType } from './audit-logger.js';

// Export telemetry hooks with audit integration
export { createTelemetryHooksWithAudit, type TelemetryWithAuditConfig } from './audit-hooks.js';
