/**
 * Semantic Response Cache
 *
 * LRU cache with TTL for caching API responses.
 * Designed to reduce token overhead by avoiding repeated identical API calls.
 *
 * Features:
 * - Configurable max entries and TTL
 * - Hit/miss metrics for monitoring
 * - Automatic stale entry cleanup
 * - Type-safe generic implementation
 */

import { LRUCache } from 'lru-cache';
import { buildCacheKey, CacheKeyConfig, isCacheableMethod, isCacheablePath } from './cache-key.js';

/**
 * Cache configuration options.
 */
export interface SemanticCacheOptions {
  /** Maximum number of entries (default: 500) */
  maxEntries?: number;
  /** Default TTL in milliseconds (default: 10 minutes) */
  defaultTTL?: number;
  /** Enable debug logging (default: false) */
  debug?: boolean;
}

/**
 * Cache metrics for monitoring.
 */
export interface CacheMetrics {
  /** Total cache hits */
  hits: number;
  /** Total cache misses */
  misses: number;
  /** Hit rate as percentage */
  hitRate: number;
  /** Current number of entries */
  size: number;
  /** Maximum entries allowed */
  maxSize: number;
  /** Number of expired entries evicted */
  evictions: number;
}

/**
 * Semantic Response Cache implementation.
 *
 * @example
 * ```typescript
 * const cache = new SemanticCache<ApiResponse>({
 *   maxEntries: 500,
 *   defaultTTL: 10 * 60 * 1000, // 10 minutes
 * });
 *
 * // Check cache before API call
 * const cacheKey = cache.buildKey({ method: 'GET', path: '/project', params: { key: 'TEST' } });
 * const cached = cache.get(cacheKey);
 * if (cached) return cached;
 *
 * // Make API call and cache result
 * const response = await api.get('/project', { params });
 * cache.set(cacheKey, response);
 * ```
 */
export class SemanticCache<T extends {}> {
  private cache: LRUCache<string, T>;
  private readonly maxEntries: number;
  private readonly defaultTTL: number;
  private readonly debug: boolean;

  // Metrics
  private hitCount = 0;
  private missCount = 0;
  private evictionCount = 0;

  constructor(options: SemanticCacheOptions = {}) {
    this.maxEntries = options.maxEntries ?? 500;
    this.defaultTTL = options.defaultTTL ?? 10 * 60 * 1000; // 10 minutes
    this.debug = options.debug ?? false;

    this.cache = new LRUCache<string, T>({
      max: this.maxEntries,
      ttl: this.defaultTTL,
      dispose: () => { this.evictionCount++; },
    });
  }

  /**
   * Build a cache key from request configuration.
   */
  buildKey(config: CacheKeyConfig): string {
    return buildCacheKey(config);
  }

  /**
   * Check if a request should be cached.
   */
  shouldCache(config: CacheKeyConfig): boolean {
    return isCacheableMethod(config.method) && isCacheablePath(config.path);
  }

  /**
   * Get a cached value if it exists and is not expired.
   *
   * @param key - Cache key
   * @returns Cached value or undefined if not found/expired
   */
  get(key: string): T | undefined {
    const value = this.cache.get(key);

    if (value === undefined) {
      this.missCount++;
      this.log(`MISS: ${key}`);
      return undefined;
    }

    this.hitCount++;
    this.log(`HIT: ${key}`);
    return value;
  }

  /**
   * Store a value in the cache.
   *
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Optional TTL override (ms)
   */
  set(key: string, value: T, ttl?: number): void {
    const options = ttl !== undefined ? { ttl } : undefined;
    this.cache.set(key, value, options);
    this.log(`SET: ${key} (ttl: ${ttl ?? this.defaultTTL}ms)`);
  }

  /**
   * Remove a specific entry from the cache.
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.log(`DELETE: ${key}`);
    }
    return deleted;
  }

  /**
   * Clear all entries matching a path pattern.
   * Useful for cache invalidation after mutations.
   *
   * @param pathPattern - Path prefix to match (e.g., '/project')
   * @returns Number of entries cleared
   */
  invalidateByPath(pathPattern: string): number {
    let cleared = 0;
    for (const key of this.cache.keys()) {
      // Key format: METHOD:path?params
      if (key.includes(`:${pathPattern}`)) {
        this.cache.delete(key);
        cleared++;
      }
    }
    this.log(`INVALIDATE: ${pathPattern} (cleared: ${cleared})`);
    return cleared;
  }

  /**
   * Clear all cached entries.
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.log(`CLEAR: ${size} entries removed`);
  }

  /**
   * Get cache metrics.
   */
  getMetrics(): CacheMetrics {
    const total = this.hitCount + this.missCount;
    return {
      hits: this.hitCount,
      misses: this.missCount,
      hitRate: total > 0 ? (this.hitCount / total) * 100 : 0,
      size: this.cache.size,
      maxSize: this.maxEntries,
      evictions: this.evictionCount,
    };
  }

  /**
   * Reset metrics counters.
   */
  resetMetrics(): void {
    this.hitCount = 0;
    this.missCount = 0;
    this.evictionCount = 0;
  }

  /**
   * Debug logging helper.
   */
  private log(message: string): void {
    if (this.debug) {
      console.log(`[SemanticCache] ${message}`);
    }
  }
}

/**
 * Default TTL values for different endpoint types (in milliseconds).
 * Use these when setting TTL for specific endpoints.
 */
export const CacheTTL = {
  /** Static data that rarely changes (e.g., issue types, statuses) */
  STATIC: 30 * 60 * 1000, // 30 minutes

  /** Semi-static data (e.g., project metadata, user info) */
  SEMI_STATIC: 10 * 60 * 1000, // 10 minutes

  /** Frequently changing data (e.g., issue lists) */
  DYNAMIC: 2 * 60 * 1000, // 2 minutes

  /** Real-time data (e.g., notifications, activity) */
  REALTIME: 30 * 1000, // 30 seconds
} as const;
