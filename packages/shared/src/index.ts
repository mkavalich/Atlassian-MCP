/**
 * @atlassian-mcp/shared
 *
 * Shared utilities for Atlassian MCP Servers
 *
 * This package provides:
 * - Response format types and configurations
 * - Token-efficient serializers (TOON, TSV, Markdown, etc.)
 * - Entity field configurations for format-aware responses
 * - Telemetry types and MCP-native logging
 */

export * from './types/index.js';
export * from './formatters/index.js';
export * from './schemas/field-configs.js';
export * from './telemetry/index.js';
