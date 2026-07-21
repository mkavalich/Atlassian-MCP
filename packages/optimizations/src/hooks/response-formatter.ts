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

/** Key under which the formatter reports what it elided. Namespaced to avoid
 *  colliding with tool-authored fields. */
const OMITTED_KEY = '_formatterOmitted';

/**
 * Byte budget for the preserved metadata block. Over budget, the largest
 * non-scalar fields are DISCLOSED by name and size rather than inlined --
 * never truncated, and never traded for dumping the raw payload (which
 * measured 5.8x worse than the table on the largest real response).
 */
const METADATA_BUDGET_BYTES = 2048;

function jsonSize(value: unknown): number {
  try {
    return JSON.stringify(value)?.length ?? 0;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function isObjectArray(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    typeof value[0] === 'object' &&
    value[0] !== null
  );
}

/** An object whose own values include an array of objects (e.g. `groupedByCategory`). */
function holdsObjectArray(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).some(isObjectArray);
}

/**
 * Every renderable field name present anywhere in the data, so columns the
 * table dropped can be named rather than silently disappearing.
 */
function collectFieldNames(items: Record<string, unknown>[]): string[] {
  const names = new Set<string>();
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    for (const [key, value] of Object.entries(item)) {
      if (value === null || value === undefined) continue;
      const type = typeof value;
      if (type === 'string' || type === 'number' || type === 'boolean') {
        names.add(key);
      } else if (type === 'object' && !Array.isArray(value)) {
        const nested = value as Record<string, unknown>;
        if (typeof nested.name === 'string') names.add(`${key}.name`);
        if (typeof nested.key === 'string') names.add(`${key}.key`);
      }
    }
  }
  return [...names];
}

/**
 * Build the metadata block appended after the data table.
 *
 * This used to be a six-name allowlist that silently discarded every other
 * top-level field. That dropped the very fields tools add to admit incomplete
 * data (`partialFailure`, `dataSources`, `summary`) on exactly the path where
 * they matter -- an allowlist that silently discards unknown fields is itself
 * an instance of the bug it was hiding.
 *
 * It is now a denylist of one key -- the array rendered as the table -- plus
 * explicit DISCLOSURE of anything else not inlined:
 *   - sibling object arrays and containers of them are named with their size
 *     (inlining them would re-inflate exactly what the table exists to shrink)
 *   - data columns the table dropped are named
 * Nothing leaves without being either preserved or named.
 */
function buildMetadata(
  parsed: unknown,
  renderedKey: string | null,
  droppedColumns: string[],
  debugLog?: (msg: string) => void
): Record<string, unknown> {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {};
  }

  const obj = parsed as Record<string, unknown>;
  const metadata: Record<string, unknown> = {};
  const omittedValues: Record<string, string> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (key === renderedKey) continue;

    if (isObjectArray(value)) {
      omittedValues[key] = `${(value as unknown[]).length} items`;
      continue;
    }
    if (holdsObjectArray(value)) {
      omittedValues[key] = `object, ${jsonSize(value)} bytes`;
      continue;
    }
    metadata[key] = value;
  }

  // Budget pass: shed the largest non-scalar fields, disclosing each, until the
  // block fits. Scalars are never shed and nothing is ever truncated.
  if (jsonSize(metadata) > METADATA_BUDGET_BYTES) {
    const sheddable = Object.keys(metadata)
      .filter(k => typeof metadata[k] === 'object' && metadata[k] !== null)
      .sort((a, b) => jsonSize(metadata[b]) - jsonSize(metadata[a]));

    for (const key of sheddable) {
      if (jsonSize(metadata) <= METADATA_BUDGET_BYTES) break;
      omittedValues[key] = `${Array.isArray(metadata[key]) ? 'array' : 'object'}, ` +
        `${jsonSize(metadata[key])} bytes`;
      delete metadata[key];
    }
  }

  const hasOmissions = Object.keys(omittedValues).length > 0 || droppedColumns.length > 0;
  if (hasOmissions) {
    const disclosure: Record<string, unknown> = {};
    if (Object.keys(omittedValues).length > 0) disclosure.values = omittedValues;
    if (droppedColumns.length > 0) disclosure.columns = droppedColumns.sort();
    // Never silently overwrite a tool-authored field of the same name.
    if (OMITTED_KEY in metadata) {
      disclosure.toolReported = metadata[OMITTED_KEY];
    }
    metadata[OMITTED_KEY] = disclosure;
    debugLog?.(`omitted ${JSON.stringify(disclosure)}`);
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

      // Append metadata, disclosing anything not preserved verbatim
      const droppedColumns = collectFieldNames(items).filter(f => !fields.includes(f));
      const metadata = buildMetadata(
        parsedResult,
        label,
        droppedColumns,
        debug ? msg => console.log(`[ResponseFormatter] ${toolName}: ${msg}`) : undefined
      );
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
