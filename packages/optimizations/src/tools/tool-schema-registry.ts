/**
 * Tool Schema Registry
 *
 * Tracks tool schemas during registration for on-demand loading.
 * This enables deferred schema loading to reduce `listTools` response size.
 *
 * Usage:
 * 1. Create a registry per server
 * 2. Wrap tool registration to capture schemas
 * 3. Register the load_tool_schema tool
 */

import { z } from 'zod';

/**
 * A single input example for a tool.
 * Used by API consumers as input_examples in Anthropic Messages API calls.
 * Improves accuracy from ~72% to ~90% on complex parameter handling.
 */
export interface ToolInputExample {
  /** Human-readable name describing what this example demonstrates */
  name: string;
  /** Complete valid input object for the tool */
  input: Record<string, unknown>;
}

/**
 * Tool metadata stored in the registry.
 */
export interface ToolSchemaEntry {
  /** Tool name */
  name: string;
  /** Tool title (display name) */
  title?: string;
  /** Tool description */
  description: string;
  /** Full Zod input schema */
  inputSchema: z.ZodType<unknown>;
  /** Tool annotations (readOnlyHint, etc.) */
  annotations?: Record<string, unknown>;
  /** Optional input examples for complex tools */
  examples?: ToolInputExample[];
}

/**
 * Lightweight tool info for listTools responses.
 */
export interface ToolMetadata {
  name: string;
  title?: string;
  description: string;
  /** Hint about schema complexity */
  schemaHint?: 'simple' | 'moderate' | 'complex';
}

/**
 * Registry for tracking tool schemas.
 */
export class ToolSchemaRegistry {
  private schemas: Map<string, ToolSchemaEntry> = new Map();

  /**
   * Register a tool's schema.
   */
  register(entry: ToolSchemaEntry): void {
    this.schemas.set(entry.name, entry);
  }

  /**
   * Get a tool's full schema by name.
   */
  getSchema(toolName: string): ToolSchemaEntry | undefined {
    return this.schemas.get(toolName);
  }

  /**
   * Get all tool names.
   */
  getToolNames(): string[] {
    return Array.from(this.schemas.keys());
  }

  /**
   * Get lightweight metadata for all tools.
   * This is what should be returned in listTools.
   */
  getMetadata(): ToolMetadata[] {
    return Array.from(this.schemas.values()).map(entry => ({
      name: entry.name,
      title: entry.title,
      description: entry.description,
      schemaHint: this.getSchemaComplexity(entry.inputSchema),
    }));
  }

  /**
   * Check if a tool exists.
   */
  has(toolName: string): boolean {
    return this.schemas.has(toolName);
  }

  /**
   * Get count of registered tools.
   */
  get size(): number {
    return this.schemas.size;
  }

  /**
   * Estimate schema complexity based on Zod type.
   */
  private getSchemaComplexity(schema: z.ZodType<unknown>): 'simple' | 'moderate' | 'complex' {
    try {
      const jsonSchema = this.zodToJsonSchemaBasic(schema);
      const propCount = Object.keys(jsonSchema.properties || {}).length;

      if (propCount <= 3) return 'simple';
      if (propCount <= 8) return 'moderate';
      return 'complex';
    } catch {
      return 'moderate';
    }
  }

  /**
   * Basic Zod to JSON Schema conversion for complexity estimation.
   */
  private zodToJsonSchemaBasic(schema: z.ZodType<unknown>): Record<string, unknown> {
    // This is a simplified conversion - just enough for complexity estimation
    if (schema instanceof z.ZodObject) {
      const shape = schema.shape;
      return {
        type: 'object',
        properties: Object.keys(shape).reduce((acc, key) => {
          acc[key] = { type: 'unknown' };
          return acc;
        }, {} as Record<string, unknown>),
      };
    }
    return { type: 'unknown' };
  }
}

/**
 * Zod definition with common properties.
 * Using 'any' to avoid complex type gymnastics with Zod internals.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ZodDef = any;

/**
 * Convert a Zod schema to JSON Schema format.
 * Used by load_tool_schema to return the schema in a standard format.
 */
export function zodToJsonSchema(schema: z.ZodType<unknown>): Record<string, unknown> {
  // Use zod's built-in JSON schema generation if available
  // Otherwise, provide a basic conversion
  if ('_def' in schema && schema._def) {
    return convertZodDef(schema._def as ZodDef);
  }
  return { type: 'unknown' };
}

/**
 * Convert Zod definition to JSON Schema.
 */
function convertZodDef(def: ZodDef): Record<string, unknown> {
  const typeName = def.typeName as string | undefined;

  switch (typeName) {
    case 'ZodString':
      return { type: 'string', description: def.description };

    case 'ZodNumber':
      return { type: 'number', description: def.description };

    case 'ZodBoolean':
      return { type: 'boolean', description: def.description };

    case 'ZodArray': {
      const itemDef = def.type?._def;
      return {
        type: 'array',
        items: itemDef ? convertZodDef(itemDef) : {},
        description: def.description,
      };
    }

    case 'ZodObject': {
      const shape = typeof def.shape === 'function' ? def.shape() : def.shape || {};
      const properties: Record<string, unknown> = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(shape)) {
        const zodValue = value as z.ZodType<unknown>;
        if (zodValue && '_def' in zodValue) {
          const valueDef = zodValue._def as ZodDef;
          properties[key] = convertZodDef(valueDef);
          // Check if required (not optional)
          if (valueDef.typeName !== 'ZodOptional') {
            required.push(key);
          }
        }
      }

      return {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined,
        description: def.description,
      };
    }

    case 'ZodOptional': {
      const innerDef = def.innerType?._def;
      if (innerDef) {
        return convertZodDef(innerDef);
      }
      return {};
    }

    case 'ZodDefault': {
      const innerDef = def.innerType?._def;
      const defaultValue = typeof def.defaultValue === 'function' ? def.defaultValue() : def.defaultValue;
      const result = innerDef ? convertZodDef(innerDef) : {};
      if (defaultValue !== undefined) {
        result.default = defaultValue;
      }
      return result;
    }

    case 'ZodEnum': {
      const values = def.values || [];
      return {
        type: 'string',
        enum: values,
        description: def.description,
      };
    }

    case 'ZodUnion': {
      const options = (def.options || []) as z.ZodType<unknown>[];
      return {
        oneOf: options.map(opt => {
          if ('_def' in opt) {
            return convertZodDef(opt._def as ZodDef);
          }
          return {};
        }),
        description: def.description,
      };
    }

    case 'ZodLiteral': {
      return {
        const: def.value,
        description: def.description,
      };
    }

    case 'ZodNullable': {
      const innerDef = def.innerType?._def;
      const inner = innerDef ? convertZodDef(innerDef) : {};
      return {
        ...inner,
        nullable: true,
      };
    }

    default:
      return { type: 'unknown', description: def.description };
  }
}
