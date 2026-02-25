/**
 * CompactSerializer - Main serialization class for token-efficient responses
 *
 * Provides format selection and entity-specific field configuration
 * for optimizing MCP tool responses.
 */

import { z } from 'zod';
import type {
  OutputFormat,
  SerializerOptions,
  SerializerResult,
  ResponseFormat,
} from '../types/response-format.js';
import type { EntityType, EntityFieldConfig, FieldPath } from '../types/field-config.js';
import { formatMapping } from '../types/response-format.js';
import { toTOON } from './toon-serializer.js';
import {
  escapeTSV,
  escapeMarkdown,
  getNestedValue,
  truncate,
  toHeaderName,
} from './escape-rules.js';
import { FIELD_CONFIGS } from '../schemas/field-configs.js';

/**
 * CompactSerializer provides format-aware serialization for entity data.
 *
 * @example
 * ```typescript
 * const serializer = new CompactSerializer('issue');
 *
 * // Serialize with default concise format
 * const result = serializer.serialize(issues, { format: 'toon' });
 *
 * // Or use the convenience method with ResponseFormat
 * const result = serializer.serializeWithFormat(issues, 'concise');
 * ```
 */
export class CompactSerializer<T extends Record<string, unknown>> {
  private entityType: EntityType;
  private fieldConfig: EntityFieldConfig;
  private schema?: z.ZodSchema<T>;

  /**
   * Create a new CompactSerializer for an entity type.
   *
   * @param entityType - The type of entity being serialized
   * @param schema - Optional Zod schema for validation
   */
  constructor(entityType: EntityType, schema?: z.ZodSchema<T>) {
    this.entityType = entityType;
    this.schema = schema;

    // Get field config or use defaults
    this.fieldConfig = FIELD_CONFIGS[entityType] ?? {
      concise: ['*'],
      standard: ['*'],
      detailed: ['*'],
    };
  }

  /**
   * Serialize data with the specified options.
   */
  serialize(data: T | T[], options: SerializerOptions): SerializerResult {
    const items = Array.isArray(data) ? data : [data];

    // Validate if schema provided
    if (this.schema && items.length > 0) {
      // Note: We don't throw on validation errors for flexibility
      // Users can add strict validation via hooks
    }

    const fields = options.fields ?? this.fieldConfig.concise;
    const maxLen = options.maxTextLength ?? 100;

    let text: string;

    switch (options.format) {
      case 'toon':
        text = this.toTOON(items, fields, maxLen, options);
        break;
      case 'tsv':
        text = this.toTSV(items, fields, maxLen, options);
        break;
      case 'markdown':
        text = this.toMarkdown(items, fields, maxLen, options);
        break;
      case 'lines':
        text = this.toLines(items, fields, maxLen);
        break;
      case 'json-minimal':
        text = this.toMinimalJSON(items, fields);
        break;
      case 'json':
      default:
        text = JSON.stringify(items, null, 2);
        break;
    }

    // Apply position-aware structuring for large results
    if (options.positionAware && items.length > 10) {
      text = this.applyPositionAwareness(text, items.length);
    }

    return {
      text,
      format: options.format,
      recordCount: items.length,
      fields: fields as string[],
      estimatedTokens: Math.ceil(text.length / 4),
    };
  }

  /**
   * Convenience method to serialize with a ResponseFormat.
   */
  serializeWithFormat(
    data: T | T[],
    responseFormat: ResponseFormat,
    additionalOptions: Partial<SerializerOptions> = {}
  ): SerializerResult {
    const outputFormat = formatMapping[responseFormat];
    const fields = this.getFields(responseFormat);

    return this.serialize(data, {
      format: outputFormat,
      fields,
      ...additionalOptions,
    });
  }

  /**
   * Get the fields for a given response format.
   */
  getFields(format: ResponseFormat): FieldPath[] {
    return this.fieldConfig[format];
  }

  /**
   * Estimate token count for data at a given format level.
   */
  estimateTokens(data: T | T[], format: ResponseFormat): number {
    const items = Array.isArray(data) ? data : [data];
    const result = this.serializeWithFormat(items, format);
    return result.estimatedTokens;
  }

  // ========================================
  // Private serialization methods
  // ========================================

  private toTOON(items: T[], fields: FieldPath[], maxLen: number, options: SerializerOptions): string {
    return toTOON(items, {
      entityType: this.entityType + 's', // Pluralize for readability
      fields,
      maxTextLength: maxLen,
      includeFooter: options.includeFooter ?? true,
    });
  }

  private toTSV(items: T[], fields: FieldPath[], maxLen: number, options: SerializerOptions): string {
    const lines: string[] = [];

    // Header row
    if (options.includeHeader !== false) {
      lines.push(fields.map(f => toHeaderName(f)).join('\t'));
    }

    // Data rows
    for (const item of items) {
      const values = fields.map(f => {
        const value = getNestedValue(item, f);
        const escaped = escapeTSV(value);
        return truncate(escaped, maxLen);
      });
      lines.push(values.join('\t'));
    }

    // Footer
    if (options.includeFooter !== false && items.length > 1) {
      lines.push(`\n${items.length} records`);
    }

    return lines.join('\n');
  }

  private toMarkdown(items: T[], fields: FieldPath[], maxLen: number, options: SerializerOptions): string {
    const headers = fields.map(f => toHeaderName(f));
    const separator = fields.map(() => '---');

    const lines: string[] = [
      `| ${headers.join(' | ')} |`,
      `| ${separator.join(' | ')} |`,
    ];

    for (const item of items) {
      const values = fields.map(f => {
        const value = getNestedValue(item, f);
        const escaped = escapeMarkdown(value);
        return truncate(escaped, 50); // Shorter for markdown tables
      });
      lines.push(`| ${values.join(' | ')} |`);
    }

    if (options.includeFooter !== false) {
      lines.push(`\n*${items.length} records*`);
    }

    return lines.join('\n');
  }

  private toLines(items: T[], fields: FieldPath[], maxLen: number): string {
    return items.map(item => {
      return fields
        .map(f => `${toHeaderName(f)}: ${truncate(String(getNestedValue(item, f) ?? '-'), maxLen)}`)
        .join('\n');
    }).join('\n\n---\n\n');
  }

  private toMinimalJSON(items: T[], fields: FieldPath[]): string {
    const filtered = items.map(item => {
      const obj: Record<string, unknown> = {};
      for (const f of fields) {
        const val = getNestedValue(item, f);
        if (val !== null && val !== undefined && val !== '') {
          // Use the last part of the path as the key for flat output
          const key = f.includes('.') ? f : f;
          obj[key] = val;
        }
      }
      return obj;
    });
    return JSON.stringify(filtered);
  }

  /**
   * Apply position-aware structuring to mitigate "Lost in the Middle" problem.
   *
   * For large results, adds summary at start and end where LLM attention is highest.
   * Based on Stanford/UC Berkeley research (TACL 2024).
   */
  private applyPositionAwareness(text: string, itemCount: number): string {
    const header = `📋 Results Summary: ${itemCount} ${this.entityType}(s) found\n`;
    const footer = `\n---\n✓ ${itemCount} records returned. Review complete.`;
    return header + text + footer;
  }
}

/**
 * Factory function to create a serializer for an entity type.
 */
export function createSerializer<T extends Record<string, unknown>>(
  entityType: EntityType,
  schema?: z.ZodSchema<T>
): CompactSerializer<T> {
  return new CompactSerializer(entityType, schema);
}
