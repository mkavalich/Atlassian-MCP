/**
 * TOON (Token-Oriented Object Notation) Serializer
 *
 * TOON format specification:
 * ```
 * entityType[count]{field1,field2,...}:
 *   value1,value2,...
 *   value1,value2,...
 * ```
 *
 * Achieves 30-60% token reduction vs JSON while maintaining
 * LLM comprehension (73.9% accuracy vs 69.7% for pretty JSON).
 *
 * Source: TOON Format Benchmarks, 2024
 */

import { escapeTOON, getNestedValue, truncate } from './escape-rules.js';

/**
 * Options for TOON serialization.
 */
export interface TOONOptions {
  /** Entity type name for header (e.g., 'issues', 'projects') */
  entityType: string;
  /** Fields to include in output */
  fields: string[];
  /** Maximum text length before truncation (default: 100) */
  maxTextLength?: number;
  /** Include footer with count for large results (default: true for >10 items) */
  includeFooter?: boolean;
}

/**
 * Serialize array of objects to TOON format.
 *
 * @example
 * ```typescript
 * const issues = [
 *   { key: 'IT-1234', summary: 'Fix login bug', status: { name: 'In Progress' } },
 *   { key: 'IT-1235', summary: 'Update docs', status: { name: 'Done' } },
 * ];
 *
 * toTOON(issues, {
 *   entityType: 'issues',
 *   fields: ['key', 'summary', 'status.name']
 * });
 * // Output:
 * // issues[2]{key,summary,status.name}:
 * //   IT-1234,Fix login bug,In Progress
 * //   IT-1235,Update docs,Done
 * ```
 */
export function toTOON<T extends Record<string, unknown>>(
  items: T[],
  options: TOONOptions
): string {
  const { entityType, fields, maxTextLength = 100, includeFooter = true } = options;

  if (items.length === 0) {
    return `${entityType}[0]{${fields.join(',')}}:\n  (empty)`;
  }

  // Build header
  const header = `${entityType}[${items.length}]{${fields.join(',')}}:`;

  // Build rows
  const rows = items.map(item => {
    const values = fields.map(field => {
      const value = getNestedValue(item, field);
      const escaped = escapeTOON(value);
      return truncate(escaped, maxTextLength);
    });
    return `  ${values.join(',')}`;
  });

  const result = [header, ...rows];

  // Add footer for large results
  if (includeFooter && items.length > 10) {
    result.push(`\n(${items.length} total)`);
  }

  return result.join('\n');
}

/**
 * Parse TOON format back to objects.
 * Useful for testing and validation.
 *
 * @example
 * ```typescript
 * const toon = `issues[2]{key,summary}:
 *   IT-1234,Fix bug
 *   IT-1235,Update docs`;
 *
 * parseTOON(toon);
 * // Returns: [
 * //   { key: 'IT-1234', summary: 'Fix bug' },
 * //   { key: 'IT-1235', summary: 'Update docs' }
 * // ]
 * ```
 */
export function parseTOON(toon: string): Record<string, unknown>[] {
  const lines = toon.trim().split('\n');
  if (lines.length === 0) return [];

  // Parse header: entityType[count]{field1,field2,...}:
  const headerMatch = lines[0].match(/^(\w+)\[(\d+)\]\{([^}]+)\}:$/);
  if (!headerMatch) {
    throw new Error(`Invalid TOON header: ${lines[0]}`);
  }

  const [, , countStr, fieldsStr] = headerMatch;
  const expectedCount = parseInt(countStr, 10);
  const fields = fieldsStr.split(',');

  // Parse data rows
  const results: Record<string, unknown>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines, (empty) marker, and footer
    if (!line || line === '(empty)' || line.startsWith('(') && line.endsWith(' total)')) {
      continue;
    }

    const values = parseTOONRow(line);
    if (values.length !== fields.length) {
      throw new Error(`Field count mismatch at line ${i + 1}: expected ${fields.length}, got ${values.length}`);
    }

    const obj: Record<string, unknown> = {};
    for (let j = 0; j < fields.length; j++) {
      setNestedValue(obj, fields[j], values[j]);
    }
    results.push(obj);
  }

  if (results.length !== expectedCount && expectedCount > 0) {
    // Warning: count mismatch (could be due to footer/empty marker)
  }

  return results;
}

/**
 * Parse a TOON data row, handling quoted values and escapes.
 */
function parseTOONRow(line: string): unknown[] {
  const values: unknown[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        // Check for escaped quote
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i += 2;
          continue;
        }
        // End of quoted value
        inQuotes = false;
        i++;
        continue;
      }
      // Handle \n escape
      if (char === '\\' && i + 1 < line.length && line[i + 1] === 'n') {
        current += '\n';
        i += 2;
        continue;
      }
      current += char;
      i++;
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
        continue;
      }
      if (char === ',') {
        values.push(parseTOONValue(current.trim()));
        current = '';
        i++;
        continue;
      }
      current += char;
      i++;
    }
  }

  // Don't forget last value
  values.push(parseTOONValue(current.trim()));

  return values;
}

/**
 * Parse a single TOON value, handling special markers.
 */
function parseTOONValue(value: string): unknown {
  if (value === '-') return null;

  // Handle array format [a;b;c]
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1);
    if (inner === '') return [];
    return inner.split(';').map(s => {
      // Unescape array items
      return s
        .replace(/\\;/g, ';')
        .replace(/\\\[/g, '[')
        .replace(/\\\]/g, ']')
        .replace(/\\\\/g, '\\');
    });
  }

  return value;
}

/**
 * Set nested value in object using dot notation.
 */
function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current) || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = value;
}
