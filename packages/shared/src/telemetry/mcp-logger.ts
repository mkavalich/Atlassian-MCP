/**
 * MCP-Native Logger Implementation
 *
 * Sends log messages to MCP client via notifications/message.
 * Follows the MCP Logging specification with RFC 5424 syslog levels.
 *
 * Features:
 * - Automatic sanitization of sensitive data
 * - Level-based filtering
 * - Fallback to stderr for redundancy
 *
 * @see https://modelcontextprotocol.io/specification/2025-03-26/server/utilities/logging
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { LogLevel, McpLogger } from './types.js';
import { LOG_LEVEL_SEVERITY, REDACT_KEYS } from './index.js';

/**
 * Simple MCP logger that sends log notifications to the client.
 *
 * Per MCP spec, servers that emit log notifications MUST declare
 * the `logging` capability. The SimpleMcpLogger does NOT modify
 * server capabilities - that must be done during server creation.
 *
 * @example
 * ```typescript
 * import { SimpleMcpLogger } from '@atlassian-mcp/shared/telemetry';
 *
 * const logger = new SimpleMcpLogger(server, 'jira-projects');
 * logger.info('tools', { event: 'tool_called', tool: 'search_projects' });
 * ```
 */
export class SimpleMcpLogger implements McpLogger {
  private minLevel: LogLevel = 'info';
  private readonly loggerPrefix: string;

  /**
   * Create a new MCP logger.
   *
   * @param server - The MCP server instance for sending notifications
   * @param loggerPrefix - Prefix for logger names (e.g., 'jira-projects')
   */
  constructor(
    private readonly server: McpServer,
    loggerPrefix: string
  ) {
    this.loggerPrefix = loggerPrefix;
  }

  /**
   * Log a message at the specified level.
   *
   * Messages below the minimum level are not sent.
   * Sensitive data is automatically redacted.
   */
  log(level: LogLevel, logger: string, data: Record<string, unknown>): void {
    // Check if this level should be logged
    if (LOG_LEVEL_SEVERITY[level] > LOG_LEVEL_SEVERITY[this.minLevel]) {
      return;
    }

    const sanitizedData = this.sanitize(data);
    const fullLoggerName = logger
      ? `${this.loggerPrefix}.${logger}`
      : this.loggerPrefix;

    // Send MCP logging message notification
    // Note: Client may ignore if it doesn't support logging capability
    // Uses the sendLoggingMessage API per MCP SDK
    try {
      // Fire and forget - don't await to avoid blocking tool execution
      void this.server.sendLoggingMessage({
        level,
        logger: fullLoggerName,
        data: sanitizedData,
      });
    } catch {
      // Silently ignore notification errors - don't break tool execution
      // Log to stderr as fallback
      this.logToStderr(level, fullLoggerName, sanitizedData);
    }

    // Also log to stderr for redundancy (useful for debugging)
    // This ensures logs are captured even if client doesn't support logging
    this.logToStderr(level, fullLoggerName, sanitizedData);
  }

  /**
   * Fallback logging to stderr.
   * Used when MCP notification fails or for redundancy.
   */
  private logToStderr(
    level: LogLevel,
    logger: string,
    data: Record<string, unknown>
  ): void {
    const timestamp = new Date().toISOString();
    const message = JSON.stringify({ timestamp, level, logger, ...data });

    // Use stderr to avoid interfering with stdio transport
    process.stderr.write(`[${level.toUpperCase()}] ${message}\n`);
  }

  /**
   * Sanitize log data by redacting sensitive values.
   * Performs deep sanitization of nested objects.
   */
  private sanitize(data: Record<string, unknown>): Record<string, unknown> {
    return this.sanitizeValue(data) as Record<string, unknown>;
  }

  /**
   * Recursively sanitize a value, redacting sensitive keys.
   */
  private sanitizeValue(value: unknown): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeValue(item));
    }

    if (typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      const result: Record<string, unknown> = {};

      for (const [key, val] of Object.entries(obj)) {
        if (this.shouldRedact(key)) {
          result[key] = '[REDACTED]';
        } else {
          result[key] = this.sanitizeValue(val);
        }
      }

      return result;
    }

    // Check if string value looks like a secret (heuristic)
    if (typeof value === 'string' && this.looksLikeSecret(value)) {
      return '[REDACTED]';
    }

    return value;
  }

  /**
   * Check if a key name indicates sensitive data.
   */
  private shouldRedact(key: string): boolean {
    const lowerKey = key.toLowerCase();
    return REDACT_KEYS.some((redactKey) => lowerKey.includes(redactKey));
  }

  /**
   * Heuristic check if a string value looks like a secret.
   * Catches base64-encoded tokens, API keys, etc.
   */
  private looksLikeSecret(value: string): boolean {
    // Skip short values
    if (value.length < 20) {
      return false;
    }

    // Check for common secret patterns
    const secretPatterns = [
      /^[A-Za-z0-9+/]{20,}={0,2}$/, // Base64
      /^[a-f0-9]{32,}$/i, // Hex hash
      /^[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/, // JWT-like
      /^(ghp_|gho_|ghu_|ghs_|ghr_)/, // GitHub tokens
      /^(sk-|pk_|rk_)/, // Common API key prefixes
      /^AKIA[0-9A-Z]{16}$/, // AWS access keys
    ];

    return secretPatterns.some((pattern) => pattern.test(value));
  }

  /**
   * Set the minimum log level.
   * Messages below this level will not be logged.
   */
  setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /**
   * Get the current minimum log level.
   */
  getMinLevel(): LogLevel {
    return this.minLevel;
  }

  // ============================================================================
  // Convenience Methods
  // ============================================================================

  debug(logger: string, data: Record<string, unknown>): void {
    this.log('debug', logger, data);
  }

  info(logger: string, data: Record<string, unknown>): void {
    this.log('info', logger, data);
  }

  notice(logger: string, data: Record<string, unknown>): void {
    this.log('notice', logger, data);
  }

  warning(logger: string, data: Record<string, unknown>): void {
    this.log('warning', logger, data);
  }

  error(logger: string, data: Record<string, unknown>): void {
    this.log('error', logger, data);
  }

  critical(logger: string, data: Record<string, unknown>): void {
    this.log('critical', logger, data);
  }

  alert(logger: string, data: Record<string, unknown>): void {
    this.log('alert', logger, data);
  }

  emergency(logger: string, data: Record<string, unknown>): void {
    this.log('emergency', logger, data);
  }
}
