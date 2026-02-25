/**
 * Response Format Types for Token-Efficient Responses
 *
 * Based on spec: docs/token-efficient-responses-spec-v2.md
 * Phase 1 Quick Wins implementation
 */

import { z } from 'zod';

/**
 * ResponseFormat enum for controlling output verbosity.
 *
 * - `concise`: TOON format with minimal fields (default) - ~65% token reduction
 * - `standard`: TSV format with common fields - ~40% token reduction
 * - `detailed`: Minified JSON with all fields - backward compatible
 */
export const ResponseFormatSchema = z.enum([
  'concise',   // TOON format, minimal fields (default)
  'standard',  // TSV format, common fields
  'detailed',  // Minified JSON, all fields
]).default('concise');

export type ResponseFormat = z.infer<typeof ResponseFormatSchema>;

/**
 * Output format for the serializer.
 * Internal representation used by CompactSerializer.
 */
export type OutputFormat = 'toon' | 'tsv' | 'markdown' | 'lines' | 'json-minimal' | 'json';

/**
 * Maps ResponseFormat to OutputFormat for serialization.
 */
export const formatMapping: Record<ResponseFormat, OutputFormat> = {
  concise: 'toon',
  standard: 'tsv',
  detailed: 'json',
};

/**
 * Serializer options for customizing output.
 */
export interface SerializerOptions {
  /** Output format to use */
  format: OutputFormat;
  /** Override field selection */
  fields?: string[];
  /** Maximum text length before truncation (default: 100) */
  maxTextLength?: number;
  /** Include header row for tabular formats (default: true) */
  includeHeader?: boolean;
  /** Include footer with record count (default: true for >10 items) */
  includeFooter?: boolean;
  /** Enable position-aware structuring for large results */
  positionAware?: boolean;
}

/**
 * Result from the serializer including metadata.
 */
export interface SerializerResult {
  /** Formatted text output */
  text: string;
  /** Format used for serialization */
  format: OutputFormat;
  /** Number of records serialized */
  recordCount: number;
  /** Fields included in output */
  fields: string[];
  /** Estimated token count (rough: chars/4) */
  estimatedTokens: number;
}
