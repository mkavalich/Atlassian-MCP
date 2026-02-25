/**
 * Response Formatter Hook
 *
 * Transforms tool responses to token-efficient TOON format.
 * Uses data-driven auto-detection — no entity type mapping required.
 * Works with any tool response that contains an array of objects.
 */

import { toTOON } from '@atlassian-mcp/shared';
import type { ResponseFormat } from '@atlassian-mcp/shared';

/**
 * Response formatter configuration.
 */
export interface ResponseFormatterConfig {
  /** Default format when not specified (default: 'concise') */
  defaultFormat?: ResponseFormat;
  /** Enable debug logging (default: false) */
  debug?: boolean;
}

// ============================================================================
// Field Detection
// ============================================================================

/** Field priority tiers for auto-detection. Higher priority = shown first. */
const FIELD_PRIORITY: string[][] = [
  // Tier 1: Identifiers
  ['id', 'key'],
  // Tier 2: Human-readable names
  ['name', 'title', 'displayName', 'summary', 'label'],
  // Tier 3: Classification
  ['type', 'status', 'state', 'category'],
  // Tier 4: Common descriptors
  ['description', 'active', 'enabled', 'default', 'subtask'],
];

/** Keys that are response metadata, not entity data */
const METADATA_KEYS = new Set([
  'success', 'pagination', 'total', 'count', 'message',
  'usage_guidance', 'suggested_next_steps', 'fieldsMode',
  'executionTime', 'queryParameters', 'apiInfo', 'resultCount',
  'totalResults', 'currentPage', 'pageSize', 'healthInsights',
  'organizationSummary', 'analysisOptions', 'orgId',
]);

/**
 * Auto-detect the best fields to display from actual data.
 * Inspects the first few items to find common scalar fields,
 * then ranks them by usefulness.
 */
function autoDetectFields(
  items: Record<string, unknown>[],
  maxFields: number
): string[] {
  // Sample first 3 items to find consistent fields
  const sample = items.slice(0, 3);
  const fieldCounts = new Map<string, number>();

  for (const item of sample) {
    for (const [key, value] of Object.entries(item)) {
      if (value === null || value === undefined) continue;
      // Only include scalar fields or simple nested objects with a .name
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        fieldCounts.set(key, (fieldCounts.get(key) || 0) + 1);
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        // Check for nested .name, .key, .value patterns
        const nested = value as Record<string, unknown>;
        if (typeof nested.name === 'string') {
          fieldCounts.set(`${key}.name`, (fieldCounts.get(`${key}.name`) || 0) + 1);
        }
        if (typeof nested.key === 'string') {
          fieldCounts.set(`${key}.key`, (fieldCounts.get(`${key}.key`) || 0) + 1);
        }
      }
    }
  }

  // Only keep fields present in all sampled items
  const threshold = sample.length;
  const consistentFields = new Set<string>();
  for (const [field, count] of fieldCounts) {
    if (count >= threshold) {
      consistentFields.add(field);
    }
  }

  // Sort by priority tiers
  const sorted: string[] = [];
  for (const tier of FIELD_PRIORITY) {
    for (const field of tier) {
      if (consistentFields.has(field)) {
        sorted.push(field);
        consistentFields.delete(field);
      }
    }
  }
  // Append remaining fields alphabetically
  const remaining = [...consistentFields].sort();
  sorted.push(...remaining);

  return sorted.slice(0, maxFields);
}

// ============================================================================
// Data Extraction
// ============================================================================

interface ExtractedData {
  /** The data array */
  items: Record<string, unknown>[];
  /** The response key name (e.g., 'issueTypes', 'permissionSchemes') */
  label: string;
}

/**
 * Extract the primary data array from a parsed tool response.
 * Finds the largest array of objects, skipping metadata keys.
 * Returns both the array and its key name for use as the TOON label.
 */
function extractDataArray(result: unknown): ExtractedData | null {
  if (!result || typeof result !== 'object') {
    return null;
  }

  if (Array.isArray(result) && result.length > 0 && typeof result[0] === 'object') {
    return { items: result as Record<string, unknown>[], label: 'items' };
  }

  const obj = result as Record<string, unknown>;
  let bestKey: string | null = null;
  let bestArray: Record<string, unknown>[] | null = null;
  let bestLength = 0;

  for (const [key, value] of Object.entries(obj)) {
    if (METADATA_KEYS.has(key)) continue;
    if (
      Array.isArray(value) &&
      value.length > 0 &&
      typeof value[0] === 'object' &&
      value[0] !== null
    ) {
      if (value.length > bestLength) {
        bestKey = key;
        bestArray = value as Record<string, unknown>[];
        bestLength = value.length;
      }
    }
  }

  if (bestArray && bestKey) {
    return { items: bestArray, label: bestKey };
  }

  return null;
}

// ============================================================================
// Metadata Extraction
// ============================================================================

/**
 * Extract metadata fields from the parsed response to preserve in output.
 */
function extractMetadata(parsed: unknown): Record<string, unknown> {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {};
  }

  const obj = parsed as Record<string, unknown>;
  const metadata: Record<string, unknown> = {};

  for (const key of ['success', 'pagination', 'total', 'count', 'message', 'usage_guidance']) {
    if (key in obj) {
      metadata[key] = obj[key];
    }
  }

  return metadata;
}

// ============================================================================
// Response Formatter Hook
// ============================================================================

/** Max fields per format level */
const FIELD_LIMITS: Record<string, number> = {
  concise: 4,
  standard: 8,
  detailed: 999,
};

export function createResponseFormatterHook(config: ResponseFormatterConfig = {}) {
  const {
    defaultFormat = 'concise',
    debug = false,
  } = config;

  async function transformResponse(
    toolName: string,
    result: unknown,
    params?: Record<string, unknown>
  ): Promise<unknown> {
    const format = (params?.responseFormat as ResponseFormat) || defaultFormat;

    // Detailed = full JSON, no transformation
    if (format === 'detailed') {
      if (debug) {
        console.log(`[ResponseFormatter] ${toolName}: detailed format, passthrough`);
      }
      return result;
    }

    // Parse MCP content format
    let parsedResult: unknown = result;

    if (result && typeof result === 'object') {
      const obj = result as Record<string, unknown>;
      if (Array.isArray(obj.content) && obj.content.length > 0) {
        const firstContent = obj.content[0] as Record<string, unknown>;
        if (firstContent?.type === 'text' && typeof firstContent.text === 'string') {
          try {
            parsedResult = JSON.parse(firstContent.text);
          } catch {
            return result; // Not JSON, skip
          }
        }
      }
    }

    // Extract data array
    const extracted = extractDataArray(parsedResult);
    if (!extracted || extracted.items.length === 0) {
      if (debug) {
        console.log(`[ResponseFormatter] ${toolName}: no data array found, passthrough`);
      }
      return result;
    }

    const { items, label } = extracted;

    // Auto-detect fields from the actual data
    const maxFields = FIELD_LIMITS[format] || FIELD_LIMITS.concise;
    const fields = autoDetectFields(items, maxFields);

    if (fields.length === 0) {
      if (debug) {
        console.log(`[ResponseFormatter] ${toolName}: no formattable fields found, passthrough`);
      }
      return result;
    }

    try {
      // Format with TOON directly — no entity type mapping needed
      const text = toTOON(items, {
        entityType: label,
        fields,
        maxTextLength: format === 'concise' ? 80 : 200,
        includeFooter: true,
      });

      if (debug) {
        console.log(
          `[ResponseFormatter] ${toolName}: ${format} → ${fields.join(',')} ` +
          `(${items.length} items from "${label}")`
        );
      }

      // Append metadata
      const metadata = extractMetadata(parsedResult);
      const formattedText = text +
        (Object.keys(metadata).length > 0 ? `\n\n---\n${JSON.stringify(metadata)}` : '');

      return {
        content: [{
          type: 'text',
          text: formattedText,
        }],
      };
    } catch (error) {
      if (debug) {
        console.error(`[ResponseFormatter] Error formatting ${toolName}:`, error);
      }
      return result;
    }
  }

  return { transformResponse };
}

/**
 * Default response formatter instance.
 */
export const defaultResponseFormatter = createResponseFormatterHook({
  defaultFormat: 'concise',
  debug: process.env.DEBUG === 'true',
});
