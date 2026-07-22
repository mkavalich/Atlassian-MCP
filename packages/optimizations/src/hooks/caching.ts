/**
 * Caching Hook
 *
 * Integrates SemanticCache into API clients via the onClientCreate hook.
 * Provides 20-60% reduction in API calls through intelligent response caching.
 */

import { SemanticCache, CacheTTL, type CacheKeyConfig } from '../cache/index.js';

/**
 * Cache configuration options.
 */
export interface CachingHookConfig {
  /** Maximum cache entries (default: 500) */
  maxEntries?: number;
  /** Default TTL in ms (default: 10 minutes) */
  defaultTTL?: number;
  /** Enable debug logging (default: false) */
  debug?: boolean;
  /** Paths to exclude from caching */
  excludePaths?: string[];
}

/**
 * Per-client defaults for the API-surface discriminator fields, so a request
 * that names the default explicitly keys the same as one that omits it.
 * Values mirror the clients: Confluence `config.apiVersion || 'v2'`,
 * jira-projects `config.apiBase || '/rest/api/3'`.
 */
const SCOPE_DEFAULTS = {
  apiBase: '/rest/api/3',
  apiVersion: 'v2',
} as const;

/**
 * Creates a caching wrapper for API client methods.
 *
 * @example
 * ```typescript
 * import { createCachingHook } from './hooks/caching.js';
 *
 * const { onClientCreate, getMetrics } = createCachingHook({
 *   maxEntries: 500,
 *   debug: process.env.DEBUG_CACHE === 'true',
 * });
 *
 * const { start } = await createServer({
 *   hooks: { onClientCreate }
 * });
 * ```
 */
export function createCachingHook(config: CachingHookConfig = {}) {
  const {
    maxEntries = 500,
    defaultTTL = CacheTTL.SEMI_STATIC,
    debug = false,
    excludePaths = [],
  } = config;

  // Create cache instance
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cache = new SemanticCache<any>({
    maxEntries,
    defaultTTL,
    debug,
  });

  /**
   * Check if a path should be cached.
   */
  function shouldCachePath(path: string): boolean {
    // Check explicit exclusions
    if (excludePaths.some(p => path.includes(p))) {
      return false;
    }
    // Use default cache rules
    return cache.shouldCache({ method: 'GET', path });
  }

  /**
   * Compose the API-surface discriminator for a request.
   *
   * Some clients route more than one API surface through a single makeRequest,
   * discriminated by a config field the cache key never saw:
   *   - Confluence: `apiVersion` ('v1' -> /wiki/rest/api, 'v2' -> /wiki/api/v2)
   *   - jira-projects: `apiBase` ('/rest/api/3' vs '/rest/agile/1.0')
   *
   * A field equal to the client's own default is normalized away, so a bare
   * request and one that names the default explicitly land on the same entry.
   * When neither field is present (six of the eight servers) this returns
   * `undefined` and the key stays byte-identical to the historical format.
   *
   * The encoding is JSON, which is injective: a naive `${apiBase}${apiVersion}`
   * would let '/wiki/api/v' + '2' collide with '/wiki/api/v2' + ''.
   */
  function buildScope(requestConfig: any): string | undefined {
    const apiBase = requestConfig.apiBase === SCOPE_DEFAULTS.apiBase
      ? undefined
      : requestConfig.apiBase;
    const apiVersion = requestConfig.apiVersion === SCOPE_DEFAULTS.apiVersion
      ? undefined
      : requestConfig.apiVersion;

    if (apiBase === undefined && apiVersion === undefined) {
      return undefined;
    }
    return JSON.stringify([apiBase ?? null, apiVersion ?? null]);
  }

  /**
   * Hook to wrap API client with caching.
   * Patches the makeRequest method to check cache before API calls.
   */
  async function onClientCreate(client: any): Promise<void> {
    // Store original makeRequest
    const originalMakeRequest = client.makeRequest.bind(client);

    // Patch with caching wrapper
    client.makeRequest = async function<T>(requestConfig: any): Promise<T> {
      const { method, path, params } = requestConfig;

      // Any mutation invalidates the read cache.
      //
      // Nothing in any of the eight servers ever called invalidateCache(), so a
      // read issued within the TTL of a successful write returned pre-write
      // state under `success: true` -- e.g. add_comment followed by
      // get_comments. Eviction is unconditional rather than path-scoped because
      // path scoping cannot reach cross-resource reads (a /sprint/{id}/issue
      // write invalidates /board/{id}/backlog, which shares no prefix). Writes
      // are far rarer than reads here, and the worst case is a cache miss.
      //
      // LIMIT: this cache is per-process. Each of the eight containers holds
      // its own, so a write through one server does NOT invalidate another
      // server's cached reads.
      if (method.toUpperCase() !== 'GET') {
        try {
          return await originalMakeRequest(requestConfig);
        } finally {
          cache.clear();
        }
      }

      // Check if path should be cached
      if (!shouldCachePath(path)) {
        return originalMakeRequest(requestConfig);
      }

      // Build cache key
      const cacheConfig: CacheKeyConfig = {
        method,
        path,
        params: params as Record<string, unknown>,
        scope: buildScope(requestConfig),
      };
      const cacheKey = cache.buildKey(cacheConfig);

      // Fail closed: no faithful key, no cache. Call straight through, and do
      // not store the response either -- storing it under a lossy key is what
      // served one query's rows in answer to a different query.
      if (cacheKey === null) {
        if (debug) {
          console.log(`[Cache] UNCACHEABLE (params not enumerable): ${path}`);
        }
        return originalMakeRequest(requestConfig);
      }

      // Check cache
      const cached = cache.get(cacheKey);
      if (cached !== undefined) {
        if (debug) {
          console.log(`[Cache] HIT: ${path}`);
        }
        return cached as T;
      }

      // Make request
      const response = await originalMakeRequest(requestConfig);

      // Cache successful response
      cache.set(cacheKey, response);
      if (debug) {
        console.log(`[Cache] SET: ${path}`);
      }

      return response;
    };

    // Add cache control methods to client
    client.getCacheMetrics = () => cache.getMetrics();
    client.invalidateCache = (pattern: string) => cache.invalidateByPath(pattern);
    client.clearCache = () => cache.clear();
  }

  /**
   * Get current cache metrics.
   */
  function getMetrics() {
    return cache.getMetrics();
  }

  /**
   * Clear the cache.
   */
  function clearCache() {
    cache.clear();
  }

  /**
   * Invalidate cache entries by path pattern.
   */
  function invalidateCache(pathPattern: string) {
    return cache.invalidateByPath(pathPattern);
  }

  return {
    onClientCreate,
    getMetrics,
    clearCache,
    invalidateCache,
    cache, // Expose for advanced usage
  };
}

/**
 * Default caching hook with standard configuration.
 */
export const defaultCachingHook = createCachingHook({
  maxEntries: 500,
  defaultTTL: CacheTTL.SEMI_STATIC,
  debug: process.env.DEBUG_CACHE === 'true',
});
