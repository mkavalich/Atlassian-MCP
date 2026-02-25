/**
 * Escaping Rules for TOON and TSV Formats
 *
 * Handles special character escaping to ensure data integrity
 * in compact serialization formats.
 */

/**
 * TOON escaping rules:
 * - Comma in value → wrap in "..."
 * - Newline → \n
 * - Quote → ""
 * - Null/undefined → -
 * - Arrays → [a;b;c]
 */
export function escapeTOON(value: unknown): string {
  if (value === null || value === undefined) {
    return '-';
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '-';
    const escaped = value.map(v => escapeArrayItem(String(v ?? '-')));
    return `[${escaped.join(';')}]`;
  }

  const str = String(value);

  // Check if escaping is needed
  const needsQuoting = str.includes(',') || str.includes('\n') || str.includes('"');

  if (needsQuoting) {
    // Escape quotes by doubling them, replace newlines
    const escaped = str
      .replace(/"/g, '""')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '');
    return `"${escaped}"`;
  }

  return str;
}

/**
 * Escape array items for TOON format.
 * Semicolons and brackets need escaping within arrays.
 */
function escapeArrayItem(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');
}

/**
 * TSV escaping rules:
 * - Tab → space
 * - Newline → \n (literal)
 * - Null/undefined → -
 */
export function escapeTSV(value: unknown): string {
  if (value === null || value === undefined) {
    return '-';
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '-';
    return value.map(v => String(v ?? '-')).join(', ');
  }

  const str = String(value);
  return str
    .replace(/\t/g, ' ')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

/**
 * Markdown escaping rules:
 * - Pipe → \|
 * - Newline → <br>
 * - Null/undefined → -
 */
export function escapeMarkdown(value: unknown): string {
  if (value === null || value === undefined) {
    return '-';
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '-';
    return value.map(v => String(v ?? '-')).join(', ');
  }

  const str = String(value);
  return str
    .replace(/\|/g, '\\|')
    .replace(/\n/g, '<br>');
}

/**
 * Truncate text to maximum length with ellipsis.
 */
export function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return value.substring(0, maxLength - 3) + '...';
}

/**
 * Get nested value from object using dot notation.
 * Example: getNestedValue({ a: { b: 1 } }, 'a.b') => 1
 */
export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((acc, part) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj as unknown);
}

/**
 * Convert field path to header name.
 * Example: 'status.name' => 'Status Name'
 */
export function toHeaderName(field: string): string {
  const lastPart = field.split('.').pop() ?? field;
  return lastPart
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .trim();
}
