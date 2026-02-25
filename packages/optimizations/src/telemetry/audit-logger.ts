/**
 * Audit Logger
 *
 * Full implementation of the AuditLoggerInterface for compliance logging.
 * Supports multiple backends: console, file, and external services.
 *
 * Features:
 * - Structured audit events with correlation IDs
 * - Configurable backends (console, file, webhook)
 * - Automatic batching and flushing
 * - Sensitive data filtering
 */

import type {
  AuditEvent,
  AuditLoggerInterface,
  OperationType,
  TraceContext,
} from '@atlassian-mcp/shared/telemetry';
import { randomUUID } from 'crypto';
import { appendFile, mkdir } from 'fs/promises';
import { dirname } from 'path';

/**
 * Backend types for audit log output.
 */
export type AuditBackendType = 'console' | 'file' | 'webhook' | 'custom';

/**
 * Configuration for the audit logger.
 */
export interface AuditLoggerConfig {
  /** Backend type for log output */
  backend: AuditBackendType;

  /** File path for file backend */
  filePath?: string;

  /** Webhook URL for webhook backend */
  webhookUrl?: string;

  /** Custom handler for custom backend */
  customHandler?: (event: AuditEvent) => Promise<void>;

  /** Batch size before auto-flush (default: 100) */
  batchSize?: number;

  /** Maximum buffer size before dropping oldest events (default: 10000) */
  maxBufferSize?: number;

  /** Flush interval in ms (default: 5000) */
  flushIntervalMs?: number;

  /** Include trace context in logs (default: true) */
  includeTraceContext?: boolean;

  /** Enable debug output (default: false) */
  debug?: boolean;
}

/**
 * Audit Logger implementation.
 *
 * @example
 * ```typescript
 * const auditLogger = new AuditLogger({
 *   backend: 'file',
 *   filePath: '/var/log/mcp-audit.jsonl',
 *   batchSize: 50,
 * });
 *
 * await auditLogger.log({
 *   eventId: 'uuid',
 *   timestamp: new Date().toISOString(),
 *   eventType: 'tool_call_success',
 *   toolName: 'search_projects',
 *   operationType: 'discovery',
 *   success: true,
 *   durationMs: 150,
 *   request: { parameterKeys: ['query'] },
 * });
 *
 * await auditLogger.flush();
 * ```
 */
export class AuditLogger implements AuditLoggerInterface {
  private readonly config: Required<
    Pick<AuditLoggerConfig, 'batchSize' | 'maxBufferSize' | 'flushIntervalMs' | 'includeTraceContext' | 'debug'>
  > &
    AuditLoggerConfig;
  private buffer: AuditEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private fileInitialized = false;

  constructor(config: AuditLoggerConfig) {
    this.config = {
      batchSize: 100,
      maxBufferSize: 10000,
      flushIntervalMs: 5000,
      includeTraceContext: true,
      debug: false,
      ...config,
    };

    // Start flush timer
    this.startFlushTimer();
  }

  /**
   * Log an audit event.
   * Events are buffered and flushed periodically or when batch size is reached.
   */
  async log(event: AuditEvent): Promise<void> {
    // Strip trace context if not enabled
    const processedEvent = this.config.includeTraceContext
      ? event
      : { ...event, trace: undefined };

    this.buffer.push(processedEvent);

    // Drop oldest events if buffer exceeds max size to prevent unbounded growth
    if (this.buffer.length > this.config.maxBufferSize) {
      const dropped = this.buffer.length - this.config.maxBufferSize;
      this.buffer = this.buffer.slice(dropped);
      console.error(`[audit] Buffer overflow: dropped ${dropped} oldest events (max: ${this.config.maxBufferSize})`);
    }

    if (this.config.debug) {
      console.error(`[audit] Buffered event: ${event.eventType} for ${event.toolName}`);
    }

    // Auto-flush if batch size reached
    if (this.buffer.length >= this.config.batchSize) {
      await this.flush();
    }
  }

  /**
   * Flush all buffered events to the backend.
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) {
      return;
    }

    const events = [...this.buffer];
    this.buffer = [];

    if (this.config.debug) {
      console.error(`[audit] Flushing ${events.length} events to ${this.config.backend}`);
    }

    try {
      switch (this.config.backend) {
        case 'console':
          await this.flushToConsole(events);
          break;
        case 'file':
          await this.flushToFile(events);
          break;
        case 'webhook':
          await this.flushToWebhook(events);
          break;
        case 'custom':
          await this.flushToCustom(events);
          break;
      }
    } catch (error) {
      // Re-add events to buffer on failure, but cap at maxBufferSize
      this.buffer.unshift(...events);
      if (this.buffer.length > this.config.maxBufferSize) {
        this.buffer = this.buffer.slice(0, this.config.maxBufferSize);
      }
      console.error('[audit] Flush failed, events re-buffered:', (error as Error).message);
    }
  }

  /**
   * Stop the flush timer and flush remaining events.
   */
  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }

  /**
   * Create an audit event for a tool call start.
   */
  static createStartEvent(
    toolName: string,
    operationType: OperationType,
    parameterKeys: string[],
    trace?: TraceContext
  ): AuditEvent {
    return {
      eventId: randomUUID(),
      timestamp: new Date().toISOString(),
      eventType: 'tool_call_start',
      toolName,
      operationType,
      success: true, // Start events are always "success" until error
      durationMs: 0,
      request: { parameterKeys },
      trace,
    };
  }

  /**
   * Create an audit event for a tool call success.
   */
  static createSuccessEvent(
    toolName: string,
    operationType: OperationType,
    parameterKeys: string[],
    durationMs: number,
    responseSizeBytes?: number,
    trace?: TraceContext
  ): AuditEvent {
    return {
      eventId: randomUUID(),
      timestamp: new Date().toISOString(),
      eventType: 'tool_call_success',
      toolName,
      operationType,
      success: true,
      durationMs,
      request: { parameterKeys, responseSizeBytes },
      trace,
    };
  }

  /**
   * Create an audit event for a tool call error.
   */
  static createErrorEvent(
    toolName: string,
    operationType: OperationType,
    parameterKeys: string[],
    durationMs: number,
    error: Error,
    trace?: TraceContext
  ): AuditEvent {
    return {
      eventId: randomUUID(),
      timestamp: new Date().toISOString(),
      eventType: 'tool_call_error',
      toolName,
      operationType,
      success: false,
      durationMs,
      request: { parameterKeys },
      error: {
        type: error.constructor.name,
        message: error.message,
      },
      trace,
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch((err) => {
        console.error('[audit] Timer flush failed:', err);
      });
    }, this.config.flushIntervalMs);

    // Don't prevent process exit
    this.flushTimer.unref();
  }

  private async flushToConsole(events: AuditEvent[]): Promise<void> {
    for (const event of events) {
      console.log(JSON.stringify(event));
    }
  }

  private async flushToFile(events: AuditEvent[]): Promise<void> {
    if (!this.config.filePath) {
      throw new Error('File path required for file backend');
    }

    // Ensure directory exists on first write
    if (!this.fileInitialized) {
      await mkdir(dirname(this.config.filePath), { recursive: true });
      this.fileInitialized = true;
    }

    // Write events as JSONL (one JSON object per line)
    const lines = events.map((e) => JSON.stringify(e)).join('\n') + '\n';
    await appendFile(this.config.filePath, lines, 'utf-8');
  }

  private async flushToWebhook(events: AuditEvent[]): Promise<void> {
    if (!this.config.webhookUrl) {
      throw new Error('Webhook URL required for webhook backend');
    }

    const response = await fetch(this.config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events }),
    });

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
    }
  }

  private async flushToCustom(events: AuditEvent[]): Promise<void> {
    if (!this.config.customHandler) {
      throw new Error('Custom handler required for custom backend');
    }

    for (const event of events) {
      await this.config.customHandler(event);
    }
  }
}
