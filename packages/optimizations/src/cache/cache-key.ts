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
  /**
   * Optional API-surface discriminator.
   *
   * Several clients route more than one API surface through a single
   * `makeRequest` (Confluence v1 `/wiki/rest/api` vs v2 `/wiki/api/v2`;
   * jira-projects `/rest/api/3` vs `/rest/agile/1.0`), discriminated by a
   * config field that never reached the key. Callers that do this must supply
   * an injective encoding of the discriminating fields (see the caching hook,
   * which JSON-encodes them). Omit it entirely for a single-surface client --
   * an absent scope leaves the key byte-identical to the historical format.
   */
  scope?: string;
}

/** Depth cap for the keyability walk: deep or cyclic input fails closed. */
const MAX_PARAM_DEPTH = 8;

/**
 * Can `Object.keys` see everything this value carries?
 *
 * This is a POSITIVE allowlist, not an `instanceof URLSearchParams` denylist:
 * URLSearchParams, Map, Set, Date, RegExp, class instances and prototype-only
 * objects all hide their contents from `Object.keys`, and a denylist would have
 * to enumerate them all correctly forever.
 *
 * It is also RECURSIVE. The historical "just pass a plain object" convention
 * did not actually protect anything, because `normalizeValue` below repeats the
 * same `Object.keys` assumption one level down -- so `{ updatedAfter: new Date(...) }`
 * is a plain object that still collapses to `updatedafter=`.
 *
 * NOTE ON THE NAME: this tests ENUMERABILITY, not full faithfulness. A value
 * that passes still goes through `normalizeValue`, whose encoding is lossy in
 * known ways (unescaped `|`/`&`/`=` separators; array VALUES are sorted). Those
 * are tracked separately and deliberately out of scope here. Do not read a
 * `true` from this function as "the key is guaranteed to distinguish this input
 * from every other".
 */
export function isEnumerableParams(value: unknown, depth = 0): boolean {
  if (depth > MAX_PARAM_DEPTH) {
    return false;
  }

  if (value === null || value === undefined) {
    return true;
  }

  const type = typeof value;
  if (type === 'string' || type === 'number' || type === 'boolean' || type === 'bigint') {
    return true;
  }
  if (type !== 'object') {
    // function, symbol
    return false;
  }

  if (Array.isArray(value)) {
    return value.every(v => isEnumerableParams(v, depth + 1));
  }

  // Only genuinely plain objects: Object.prototype-backed, or null-prototype
  // (which Object.keys still enumerates faithfully).
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    return false;
  }

  return Object.values(value as Record<string, unknown>).every(v =>
    isEnumerableParams(v, depth + 1)
  );
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

  // Values are NOT lower-cased. JQL/CQL string literals, Jira labels, group
  // names and accountIds are case-sensitive, so folding case here made
  // `labels = "Backend"` and `labels = "backend"` share one cache entry.
  return String(value).trim();
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
 *
 * FAIL-CLOSED: returns `null` when the params cannot be enumerated, rather than
 * emitting the empty key the old implementation produced and cached. A cache
 * miss costs latency; a wrong cache hit costs correctness. Callers MUST treat
 * `null` as "do not cache" -- see the caching hook, which bypasses the cache
 * entirely. This function never throws: it sits on the hot request path of
 * eight servers.
 */
export function buildCacheKey(config: CacheKeyConfig): string | null {
  const { method, path, params, body, scope } = config;

  // Fail closed: an unenumerable params object cannot be keyed faithfully.
  if (params !== undefined && !isEnumerableParams(params)) {
    return null;
  }

  // Normalize method to uppercase
  const normalizedMethod = method.toUpperCase();

  // An absent scope leaves the key byte-identical to the historical format.
  const scopePrefix = scope ? `${scope}|` : '';

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

  return `${normalizedMethod}:${scopePrefix}${path}${queryString}${bodyHash}`;
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
