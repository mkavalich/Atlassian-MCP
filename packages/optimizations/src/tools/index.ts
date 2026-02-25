/**
 * Tools Module
 *
 * Provides deferred schema loading utilities for MCP servers.
 */

export {
  ToolSchemaRegistry,
  zodToJsonSchema,
  type ToolSchemaEntry,
  type ToolMetadata,
  type ToolInputExample,
} from './tool-schema-registry.js';

export {
  createLoadToolSchemaHandler,
  registerLoadToolSchemaTool,
  loadToolSchemaInputSchema,
  loadToolSchemaToolConfig,
  type LoadToolSchemaConfig,
} from './load-tool-schema.js';
