/**
 * Load Tool Schema - Deferred Schema Loading
 *
 * Provides a tool that returns the full input schema for a specific tool.
 * This enables smaller `listTools` responses by deferring schema loading.
 *
 * Token Efficiency Impact (MEASURED, all 8 servers, stdio, same build):
 * - Deferral off (default): 269 KB / ~68,800 tokens across the 8 listings
 * - Deferral on:            142 KB / ~36,200 tokens
 * - Reduction:              47.3% (38-50% per server)
 *
 * Deferral is opt-in via MCP_DEFER_TOOL_SCHEMAS=true; see
 * ../hooks/deferred-listing.ts. Reproduce with scripts/measure-listing.mjs.
 * The remaining payload is tool descriptions, which are not minimised.
 */

import { z } from 'zod';
import { ToolSchemaRegistry, zodToJsonSchema } from './tool-schema-registry.js';

/**
 * Input schema for load_tool_schema tool.
 */
export const loadToolSchemaInputSchema = z.object({
  toolName: z.string().describe('Name of the tool to load schema for'),
  format: z.enum(['json', 'compact']).optional().default('json')
    .describe('Output format: json (full schema) or compact (essential fields only)'),
}).strict();

/**
 * Configuration for the load_tool_schema tool.
 */
export interface LoadToolSchemaConfig {
  /** Tool schema registry containing all registered tools */
  registry: ToolSchemaRegistry;
  /** Server name for error messages */
  serverName?: string;
}

/**
 * Create the load_tool_schema tool handler.
 *
 * @example
 * ```typescript
 * import { ToolSchemaRegistry, createLoadToolSchemaHandler } from './tools/index.js';
 *
 * const registry = new ToolSchemaRegistry();
 *
 * // Register tools and capture schemas
 * registry.register({
 *   name: 'my_tool',
 *   description: 'Does something',
 *   inputSchema: myToolSchema,
 * });
 *
 * // Create and register the load_tool_schema tool
 * const handler = createLoadToolSchemaHandler({ registry });
 * server.registerTool('load_tool_schema', toolConfig, handler);
 * ```
 */
export function createLoadToolSchemaHandler(config: LoadToolSchemaConfig) {
  const { registry, serverName = 'mcp-server' } = config;

  return async (params: z.infer<typeof loadToolSchemaInputSchema>) => {
    const { toolName, format } = params;

    // Check if tool exists
    const entry = registry.getSchema(toolName);
    if (!entry) {
      const availableTools = registry.getToolNames();
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: false,
            error: `Tool '${toolName}' not found in ${serverName}`,
            availableTools: availableTools.slice(0, 20), // First 20 for reference
            totalTools: availableTools.length,
            suggestion: `Use search_tools to discover available tools, or check the tool name spelling.`,
          }),
        }],
      };
    }

    // Convert Zod schema to JSON Schema
    const jsonSchema = zodToJsonSchema(entry.inputSchema);

    // Build response based on format
    const response = format === 'compact'
      ? {
          success: true,
          tool: {
            name: entry.name,
            description: entry.description,
            requiredParams: (jsonSchema as { required?: string[] }).required || [],
            paramCount: Object.keys((jsonSchema as { properties?: object }).properties || {}).length,
          },
        }
      : {
          success: true,
          tool: {
            name: entry.name,
            title: entry.title,
            description: entry.description,
            inputSchema: jsonSchema,
            annotations: entry.annotations,
            examples: entry.examples || [],
          },
        };

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(response, null, 2),
      }],
    };
  };
}

/**
 * Tool configuration for load_tool_schema.
 * Use this when registering the tool.
 */
export const loadToolSchemaToolConfig = {
  title: 'Load Tool Schema',
  description: 'Get the full input schema for a specific tool. Use this before calling a tool to understand its parameters. Returns JSON Schema format.',
  inputSchema: loadToolSchemaInputSchema,
  annotations: {
    title: 'Load Tool Schema',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
};

/**
 * Helper to register the load_tool_schema tool on a server.
 *
 * @example
 * ```typescript
 * import { ToolSchemaRegistry, registerLoadToolSchemaTool } from './tools/index.js';
 *
 * const registry = new ToolSchemaRegistry();
 * // ... register tools and capture schemas ...
 *
 * registerLoadToolSchemaTool(server, registry, 'my-server');
 * ```
 */
export function registerLoadToolSchemaTool(
  server: { registerTool: (name: string, config: unknown, handler: unknown) => void },
  registry: ToolSchemaRegistry,
  serverName?: string
): void {
  const handler = createLoadToolSchemaHandler({ registry, serverName });
  server.registerTool('load_tool_schema', loadToolSchemaToolConfig, handler);
}
