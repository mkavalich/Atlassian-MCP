# Memory Leak Remediation Templates

## Overview

Copy-paste fix patterns for common memory leaks in Node.js/TypeScript MCP servers. Each template shows the problematic pattern, the fix, and integration notes.

---

## 1. Bounded Caches

### Problem: Unbounded Map Cache

```typescript
// ❌ LEAK: Grows forever
const cache = new Map<string, JiraResponse>();

export async function getCached(key: string): Promise<JiraResponse> {
  if (!cache.has(key)) {
    cache.set(key, await fetchFromApi(key));
  }
  return cache.get(key)!;
}
```

### Fix: LRU Cache with TTL

```typescript
// ✅ FIX: Bounded with eviction
import { LRUCache } from 'lru-cache';

const cache = new LRUCache<string, JiraResponse>({
  max: 500,                    // Maximum entries
  ttl: 1000 * 60 * 5,          // 5 minute TTL
  ttlAutopurge: true,          // Auto-cleanup expired
  allowStale: false,           // Don't return expired
  updateAgeOnGet: true,        // Reset TTL on access
  updateAgeOnHas: false,
});

export async function getCached(key: string): Promise<JiraResponse> {
  if (!cache.has(key)) {
    cache.set(key, await fetchFromApi(key));
  }
  return cache.get(key)!;
}
```

### Installation

```bash
npm install lru-cache
```

### Sizing Guidelines

| Use Case | max | ttl |
|----------|-----|-----|
| Issue details | 500-1000 | 5-15 min |
| User lookups | 200-500 | 30-60 min |
| Schema/metadata | 50-100 | 1-4 hours |
| Search results | 100-200 | 1-5 min |

---

## 2. Connection Pooling

### Problem: Unbounded Connections

```typescript
// ❌ LEAK: New agent per request
async function callApi(url: string): Promise<any> {
  const response = await axios.get(url);  // Default: no pooling limits
  return response.data;
}
```

### Fix: Configured HTTP Agents

```typescript
// ✅ FIX: Connection pooling with limits
import axios, { AxiosInstance } from 'axios';
import http from 'http';
import https from 'https';

const httpAgent = new http.Agent({
  maxSockets: 10,           // Max concurrent connections per host
  maxFreeSockets: 5,        // Max idle connections to keep
  keepAlive: true,          // Reuse connections
  keepAliveMsecs: 30000,    // Keep idle for 30s
  timeout: 60000,           // Socket timeout
});

const httpsAgent = new https.Agent({
  maxSockets: 10,
  maxFreeSockets: 5,
  keepAlive: true,
  keepAliveMsecs: 30000,
  timeout: 60000,
});

// Create singleton client
export const apiClient: AxiosInstance = axios.create({
  httpAgent,
  httpsAgent,
  timeout: 30000,
});

// Cleanup on shutdown
export function destroyAgents(): void {
  httpAgent.destroy();
  httpsAgent.destroy();
}
```

### For Native Fetch

```typescript
// Node 18+ with undici
import { Agent, setGlobalDispatcher } from 'undici';

const agent = new Agent({
  connections: 10,
  pipelining: 1,
  keepAliveTimeout: 30000,
  keepAliveMaxTimeout: 60000,
});

setGlobalDispatcher(agent);
```

---

## 3. Singleton API Clients

### Problem: Per-Request Client Creation

```typescript
// ❌ LEAK: New client every call
async function handleGetIssue(key: string): Promise<ToolResult> {
  const client = new JiraClient({
    baseUrl: process.env.JIRA_URL,
    token: process.env.JIRA_TOKEN,
  });
  return client.getIssue(key);
}
```

### Fix: Lazy Singleton Pattern

```typescript
// ✅ FIX: Singleton with lazy initialization
let _client: JiraClient | null = null;

function getClient(): JiraClient {
  if (!_client) {
    _client = new JiraClient({
      baseUrl: process.env.JIRA_URL!,
      token: process.env.JIRA_TOKEN!,
      // Include pooling config
      httpAgent: new http.Agent({ maxSockets: 10, keepAlive: true }),
      httpsAgent: new https.Agent({ maxSockets: 10, keepAlive: true }),
    });
  }
  return _client;
}

export async function handleGetIssue(key: string): Promise<ToolResult> {
  return getClient().getIssue(key);
}

// For testing - allow reset
export function resetClient(): void {
  if (_client) {
    _client.destroy?.();
    _client = null;
  }
}
```

### Class-Based Singleton

```typescript
// ✅ Alternative: Class with private constructor
export class ApiClientManager {
  private static instance: JiraClient | null = null;

  private constructor() {}

  static getClient(): JiraClient {
    if (!ApiClientManager.instance) {
      ApiClientManager.instance = new JiraClient({ /* config */ });
    }
    return ApiClientManager.instance;
  }

  static destroy(): void {
    ApiClientManager.instance?.destroy?.();
    ApiClientManager.instance = null;
  }
}
```

---

## 4. Event Listener Cleanup

### Problem: Listeners Without Removal

```typescript
// ❌ LEAK: Listener added every invocation
async function handleTool(request: Request): Promise<ToolResult> {
  process.on('SIGINT', () => {
    console.log('Interrupted');
  });
  // ...
}
```

### Fix: Once or Explicit Cleanup

```typescript
// ✅ FIX Option 1: Use once()
async function handleTool(request: Request): Promise<ToolResult> {
  process.once('SIGINT', () => {
    console.log('Interrupted');
  });
  // ...
}

// ✅ FIX Option 2: Explicit cleanup
async function handleTool(request: Request): Promise<ToolResult> {
  const handler = () => console.log('Interrupted');
  process.on('SIGINT', handler);
  
  try {
    // ... do work
  } finally {
    process.off('SIGINT', handler);
  }
}

// ✅ FIX Option 3: AbortController pattern
async function handleTool(request: Request): Promise<ToolResult> {
  const controller = new AbortController();
  
  const cleanup = () => controller.abort();
  process.on('SIGINT', cleanup);
  
  try {
    return await doWork({ signal: controller.signal });
  } finally {
    process.off('SIGINT', cleanup);
  }
}
```

### EventEmitter Best Practices

```typescript
import { EventEmitter } from 'events';

class SafeEmitter extends EventEmitter {
  private cleanupFns: (() => void)[] = [];

  // Track listeners for cleanup
  safeOn(event: string, listener: (...args: any[]) => void): this {
    this.on(event, listener);
    this.cleanupFns.push(() => this.off(event, listener));
    return this;
  }

  // Clean up all tracked listeners
  cleanup(): void {
    this.cleanupFns.forEach(fn => fn());
    this.cleanupFns = [];
  }
}
```

---

## 5. Timer Cleanup

### Problem: Orphaned Intervals

```typescript
// ❌ LEAK: No reference to clear
class MetricsCollector {
  start() {
    setInterval(() => this.collect(), 5000);  // Can never stop
  }
}
```

### Fix: Store and Clear References

```typescript
// ✅ FIX: Manageable timer lifecycle
class MetricsCollector {
  private timer: NodeJS.Timeout | null = null;

  start(): void {
    if (this.timer) return;  // Prevent duplicates
    this.timer = setInterval(() => this.collect(), 5000);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private collect(): void {
    // ... metrics logic
  }
}
```

### Recursive setTimeout with Stop

```typescript
// ✅ FIX: Recursive timeout with abort
class Poller {
  private active = false;
  private timeoutId: NodeJS.Timeout | null = null;

  start(): void {
    this.active = true;
    this.poll();
  }

  stop(): void {
    this.active = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  private poll(): void {
    if (!this.active) return;

    this.doWork().finally(() => {
      if (this.active) {
        this.timeoutId = setTimeout(() => this.poll(), 1000);
      }
    });
  }

  private async doWork(): Promise<void> {
    // ... polling logic
  }
}
```

---

## 6. Request Deduplication

### Problem: Pending Requests Not Cleaned

```typescript
// ❌ LEAK: Never deleted
const pending = new Map<string, Promise<any>>();

async function dedupedFetch(url: string): Promise<any> {
  if (pending.has(url)) return pending.get(url);
  
  const promise = fetch(url).then(r => r.json());
  pending.set(url, promise);
  return promise;  // Never cleaned up!
}
```

### Fix: Cleanup on Resolution

```typescript
// ✅ FIX: Auto-cleanup after resolution
const pending = new Map<string, Promise<any>>();

async function dedupedFetch(url: string): Promise<any> {
  if (pending.has(url)) {
    return pending.get(url);
  }

  const promise = fetch(url)
    .then(r => r.json())
    .finally(() => {
      pending.delete(url);  // Cleanup on success or failure
    });

  pending.set(url, promise);
  return promise;
}

// Alternative: Time-based expiry
const pending = new LRUCache<string, Promise<any>>({
  max: 100,
  ttl: 5000,  // Auto-expire after 5s
});
```

---

## 7. Stream Cleanup

### Problem: Streams Not Destroyed on Error

```typescript
// ❌ LEAK: Stream left open on error
async function processFile(path: string): Promise<void> {
  const stream = fs.createReadStream(path);
  await processStream(stream);  // If this throws, stream stays open
}
```

### Fix: Finally Block Cleanup

```typescript
// ✅ FIX: Always destroy stream
async function processFile(path: string): Promise<void> {
  const stream = fs.createReadStream(path);
  
  try {
    await processStream(stream);
  } finally {
    stream.destroy();
  }
}

// ✅ Alternative: pipeline with auto-cleanup
import { pipeline } from 'stream/promises';

async function processFile(path: string, dest: string): Promise<void> {
  await pipeline(
    fs.createReadStream(path),
    transform,
    fs.createWriteStream(dest)
  );
  // pipeline auto-destroys on error
}
```

---

## 8. Pagination Streaming

### Problem: All Pages in Memory

```typescript
// ❌ LEAK: Memory grows with result size
async function getAllIssues(jql: string): Promise<JiraIssue[]> {
  const allIssues: JiraIssue[] = [];
  let startAt = 0;
  let total = 0;
  
  do {
    const page = await api.search({ jql, startAt, maxResults: 100 });
    allIssues.push(...page.issues);
    total = page.total;
    startAt += page.issues.length;
  } while (startAt < total);
  
  return allIssues;  // Could be millions!
}
```

### Fix: Async Iterator

```typescript
// ✅ FIX: Stream results
async function* searchIssues(jql: string): AsyncGenerator<JiraIssue> {
  let startAt = 0;
  let total = 0;

  do {
    const page = await api.search({ jql, startAt, maxResults: 100 });
    total = page.total;
    
    for (const issue of page.issues) {
      yield issue;  // Process one at a time
    }
    
    startAt += page.issues.length;
  } while (startAt < total);
}

// Usage
for await (const issue of searchIssues('project = TEST')) {
  await processIssue(issue);
}
```

### With Callback (For Backwards Compatibility)

```typescript
// ✅ FIX: Callback-based processing
async function forEachIssue(
  jql: string,
  callback: (issue: JiraIssue) => Promise<void>
): Promise<number> {
  let startAt = 0;
  let processed = 0;

  while (true) {
    const page = await api.search({ jql, startAt, maxResults: 100 });
    
    for (const issue of page.issues) {
      await callback(issue);
      processed++;
    }
    
    startAt += page.issues.length;
    if (startAt >= page.total) break;
  }

  return processed;
}
```

---

## 9. Error Object Cleanup

### Problem: Error Accumulation

```typescript
// ❌ LEAK: Errors accumulate forever
class ApiClient {
  private errors: Error[] = [];
  
  async request(url: string): Promise<any> {
    try {
      return await fetch(url);
    } catch (error) {
      this.errors.push(error as Error);
      throw error;
    }
  }
}
```

### Fix: Bounded Error Log

```typescript
// ✅ FIX: Ring buffer for errors
class ApiClient {
  private static readonly MAX_ERRORS = 100;
  private errors: Error[] = [];
  
  async request(url: string): Promise<any> {
    try {
      return await fetch(url);
    } catch (error) {
      // Ring buffer - remove oldest when full
      if (this.errors.length >= ApiClient.MAX_ERRORS) {
        this.errors.shift();
      }
      this.errors.push(error as Error);
      throw error;
    }
  }

  getRecentErrors(): Error[] {
    return [...this.errors];
  }
}
```

---

## 10. Response Trimming

### Problem: Caching Full Responses

```typescript
// ❌ LEAK: Full response stored when only key/summary needed
const cache = new Map<string, JiraIssueFullResponse>();

async function getIssue(key: string): Promise<IssueSummary> {
  if (!cache.has(key)) {
    cache.set(key, await api.getIssue(key, { expand: 'all' }));
  }
  const full = cache.get(key)!;
  return { key: full.key, summary: full.summary };
}
```

### Fix: Store Only Needed Fields

```typescript
// ✅ FIX: Cache trimmed data
interface CachedIssue {
  key: string;
  summary: string;
  status: string;
  cachedAt: number;
}

const cache = new LRUCache<string, CachedIssue>({
  max: 500,
  ttl: 1000 * 60 * 5,
});

async function getIssue(key: string): Promise<CachedIssue> {
  let cached = cache.get(key);
  
  if (!cached) {
    const full = await api.getIssue(key);
    // Store only what's needed
    cached = {
      key: full.key,
      summary: full.fields.summary,
      status: full.fields.status.name,
      cachedAt: Date.now(),
    };
    cache.set(key, cached);
  }
  
  return cached;
}
```

---

## Quick Reference: Fix Selection

| Leak Type | Primary Fix | Alternative |
|-----------|-------------|-------------|
| Unbounded cache | LRU with max/TTL | Manual eviction timer |
| Per-request clients | Singleton pattern | Dependency injection |
| Event listeners | once() or explicit off() | AbortController |
| Timers | Store reference, clearInterval | Class lifecycle |
| Pending requests | finally() cleanup | TTL-based Map |
| Streams | finally { destroy() } | pipeline() |
| Pagination | Async iterator | Callback processing |
| Error accumulation | Ring buffer | Bounded array |
| Full response cache | Trim to needed fields | Separate detail levels |
