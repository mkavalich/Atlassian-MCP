/**
 * Cache key generation and normalization utilities.
 *
 * Used by semantic caching layer.
 *
 * Ensures consistent cache keys regardless of parameter ordering,
 * casing differences, or irrelevant whitespace.
 */

/**
 * Configuration for cache key generation.
 */
export interface CacheKeyConfig {
  /** HTTP method (GET, POST, etc.) */
  method: string;
  /** Request path (e.g., /rest/api/3/project) */
  path: string;
  /** Query parameters */
  params?: Record<string, unknown>;
  /** Request body (for POST/PUT - use sparingly for cache) */
  body?: unknown;
}

/**
 * Normalize a value for cache key generation.
 * Handles arrays, objects, and primitives consistently.
 */
function normalizeValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (Array.isArray(value)) {
    // Sort array for consistent ordering
    return value
      .map(v => normalizeValue(v))
      .sort()
      .join('|');
  }

  if (typeof value === 'object') {
    // Sort object keys for consistent ordering
    const obj = value as Record<string, unknown>;
    return Object.keys(obj)
      .sort()
      .map(k => `${k}=${normalizeValue(obj[k])}`)
      .join('&');
  }

  return String(value).toLowerCase().trim();
}

/**
 * Build a normalized cache key from request configuration.
 *
 * @example
 * ```typescript
 * buildCacheKey({
 *   method: 'GET',
 *   path: '/rest/api/3/project',
 *   params: { expand: 'description,lead', maxResults: 50 }
 * });
 * // Returns: "GET:/rest/api/3/project?expand=description,lead&maxresults=50"
 * ```
 */
export function buildCacheKey(config: CacheKeyConfig): string {
  const { method, path, params, body } = config;

  // Normalize method to uppercase
  const normalizedMethod = method.toUpperCase();

  // Build sorted query string from params
  let queryString = '';
  if (params && Object.keys(params).length > 0) {
    const sortedParams = Object.keys(params)
      .filter(k => params[k] !== undefined && params[k] !== null)
      .sort()
      .map(k => `${k.toLowerCase()}=${normalizeValue(params[k])}`)
      .join('&');
    queryString = sortedParams ? `?${sortedParams}` : '';
  }

  // Include body hash for non-GET requests (rare for caching)
  let bodyHash = '';
  if (body && normalizedMethod !== 'GET') {
    bodyHash = `:${hashBody(body)}`;
  }

  return `${normalizedMethod}:${path}${queryString}${bodyHash}`;
}

/**
 * Simple hash function for request bodies.
 * Uses FNV-1a hash for speed (not cryptographic).
 */
function hashBody(body: unknown): string {
  const str = JSON.stringify(body);
  let hash = 2166136261; // FNV offset basis

  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 16777619) >>> 0; // FNV prime, keep as 32-bit
  }

  return hash.toString(16);
}

/**
 * Check if a request method is cacheable.
 * Only GET requests are cached by default.
 */
export function isCacheableMethod(method: string): boolean {
  return method.toUpperCase() === 'GET';
}

/**
 * Check if a path should be cached.
 * Some endpoints should never be cached (e.g., real-time data).
 */
export function isCacheablePath(path: string): boolean {
  // Paths that should not be cached
  const noCachePaths = [
    '/myself',           // Current user info may change
    '/serverInfo',       // Server info is dynamic
    '/audit',            // Audit logs should be fresh
    '/webhook',          // Webhooks are dynamic
    '/notification',     // Notifications change frequently
  ];

  return !noCachePaths.some(p => path.includes(p));
}
