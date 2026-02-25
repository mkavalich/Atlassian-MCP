# Memory Leak Patterns Catalog

## Overview

This document catalogs common memory leak patterns in Node.js/TypeScript MCP servers, with detection strategies and examples specific to the Atlassian MCP ecosystem.

---

## 1. Unbounded Collections

### 1.1 Cache Without Eviction

**Pattern:** Map or object used as cache without size limits or TTL.

**Detection:**
```bash
grep -rn "new Map\|new Set" --include="*.ts" src/
# Then check if .delete() or .clear() is ever called on these
```

**Vulnerable Example:**
```typescript
// Module-level cache that grows forever
const responseCache = new Map<string, JiraResponse>();

export async function getIssue(key: string): Promise<JiraIssue> {
  if (responseCache.has(key)) {
    return responseCache.get(key)!;
  }
  
  const response = await api.getIssue(key);
  responseCache.set(key, response);  // Never evicted!
  return response;
}
```

**Growth Rate:** Proportional to unique keys accessed

**Fix Pattern:** See [Remediation Templates - Bounded Caches](./remediation-templates.md#bounded-caches)

---

### 1.2 Request Tracking Without Cleanup

**Pattern:** Tracking in-flight requests but not cleaning up on completion/error.

**Detection:**
```bash
grep -rn "pendingRequests\|inFlight\|activeRequests" --include="*.ts" src/
```

**Vulnerable Example:**
```typescript
const pendingRequests = new Map<string, Promise<any>>();

async function dedupedFetch(url: string): Promise<any> {
  if (pendingRequests.has(url)) {
    return pendingRequests.get(url);
  }
  
  const promise = fetch(url).then(r => r.json());
  pendingRequests.set(url, promise);
  
  // Missing: pendingRequests.delete(url) after resolution!
  return promise;
}
```

**Growth Rate:** O(unique URLs) over time

---

### 1.3 Error Accumulation

**Pattern:** Storing errors for debugging/retry without bounds.

**Detection:**
```bash
grep -rn "errors\.push\|errorLog\.push\|failedRequests" --include="*.ts" src/
```

**Vulnerable Example:**
```typescript
class ApiClient {
  private errors: Error[] = [];
  
  async request(url: string): Promise<any> {
    try {
      return await fetch(url);
    } catch (error) {
      this.errors.push(error);  // Grows forever on repeated failures
      throw error;
    }
  }
}
```

---

## 2. Event Listener Leaks

### 2.1 Listeners in Tool Handlers

**Pattern:** Adding event listeners inside frequently-called functions without removal.

**Detection:**
```bash
# Find .on() calls in tool handler files
grep -rn "\.on\(" --include="*-tools.ts" --include="*Handler.ts" src/
```

**Vulnerable Example:**
```typescript
async function handleSearchTool(query: string): Promise<ToolResult> {
  const emitter = new EventEmitter();
  
  // Listener added every invocation, never removed
  process.on('SIGINT', () => emitter.emit('cancel'));
  
  // ... search logic
}
```

**Growth Rate:** O(tool invocations)

---

### 2.2 WebSocket/Stream Listeners

**Pattern:** Connection event handlers not cleaned up on disconnect.

**Detection:**
```bash
grep -rn "socket\.on\|stream\.on\|connection\.on" --include="*.ts" src/
```

**Vulnerable Example:**
```typescript
class ConnectionManager {
  setupConnection(socket: WebSocket) {
    socket.on('message', this.handleMessage);
    socket.on('error', this.handleError);
    // Missing cleanup on 'close' event
  }
}
```

---

### 2.3 EventEmitter maxListeners Warning

**Detection:** Runtime warning indicates likely leak.

```
MaxListenersExceededWarning: Possible EventEmitter memory leak detected.
11 message listeners added to [EventEmitter].
```

**Fix:** Either increase limit (if intentional) or find and fix the leak.

---

## 3. Timer Leaks

### 3.1 Orphaned setInterval

**Pattern:** Creating intervals without storing reference for cleanup.

**Detection:**
```bash
grep -rn "setInterval" --include="*.ts" src/ | grep -v "clearInterval"
```

**Vulnerable Example:**
```typescript
class MetricsCollector {
  start() {
    // No reference stored - can never be cleared
    setInterval(() => this.collectMetrics(), 5000);
  }
}
```

---

### 3.2 Recursive setTimeout Without Exit

**Pattern:** setTimeout calling itself without termination condition.

**Detection:**
```bash
grep -rn "setTimeout.*=>" --include="*.ts" src/
# Manual review for recursive patterns
```

**Vulnerable Example:**
```typescript
function pollForChanges() {
  setTimeout(async () => {
    await checkForUpdates();
    pollForChanges();  // Always recurses - no stop condition
  }, 1000);
}
```

---

## 4. Closure Captures

### 4.1 Large Object in Callback

**Pattern:** Request/response objects captured in long-lived callbacks.

**Detection:** Manual code review required.

**Vulnerable Example:**
```typescript
async function handleTool(request: LargeRequest): Promise<ToolResult> {
  const cache = getGlobalCache();
  
  // Full request object captured in closure, held by cache entry
  cache.set(request.id, {
    callback: () => processRequest(request)  // request captured!
  });
  
  return { status: 'queued' };
}
```

---

### 4.2 Circular Closure References

**Pattern:** Closures referencing objects that reference the closure.

**Vulnerable Example:**
```typescript
function createProcessor() {
  const handler = {
    process: null as any
  };
  
  handler.process = (data: any) => {
    // Closure captures 'handler', handler holds closure
    console.log(handler);
    return transform(data);
  };
  
  return handler;  // Circular: handler -> closure -> handler
}
```

---

## 5. Stream/Connection Leaks

### 5.1 HTTP Client Without Pooling

**Pattern:** Creating new HTTP agents per request.

**Detection:**
```bash
grep -rn "new.*Agent\|axios\.create" --include="*.ts" src/
```

**Vulnerable Example:**
```typescript
async function callApi(url: string): Promise<any> {
  // New agent every call - connections not reused
  const client = axios.create({
    httpsAgent: new https.Agent()  // No maxSockets, no keepAlive
  });
  return client.get(url);
}
```

---

### 5.2 Stream Not Destroyed on Error

**Pattern:** Readable/writable streams not cleaned up in error paths.

**Detection:**
```bash
grep -rn "createReadStream\|createWriteStream\|pipeline" --include="*.ts" src/
```

**Vulnerable Example:**
```typescript
async function processFile(path: string): Promise<void> {
  const stream = fs.createReadStream(path);
  
  try {
    await processStream(stream);
  } catch (error) {
    // stream.destroy() missing!
    throw error;
  }
}
```

---

## MCP-Specific Patterns

### 6.1 Per-Request Client Creation

**Pattern:** Creating API clients inside tool handlers instead of reusing.

**Detection:**
```bash
grep -rn "new.*Client\|createClient\|axios\.create" --include="*-tools.ts" src/
```

**Vulnerable Example:**
```typescript
// Inside tool handler - new client every invocation
async function handleGetIssue(key: string): Promise<ToolResult> {
  const client = new JiraClient({
    baseUrl: process.env.JIRA_URL,
    auth: process.env.JIRA_TOKEN
  });
  
  return client.getIssue(key);  // client not reused, connections not pooled
}
```

**Fix:** Use singleton client pattern:
```typescript
// Module level - created once
let client: JiraClient | null = null;

function getClient(): JiraClient {
  if (!client) {
    client = new JiraClient({ /* config */ });
  }
  return client;
}
```

---

### 6.2 Tool Handler State Accumulation

**Pattern:** State persisted between tool invocations in module scope.

**Detection:**
```bash
# Find module-level mutable state in tool files
grep -rn "^const.*=.*\[\]$\|^const.*=.*{}$\|^const.*= new Map" --include="*-tools.ts" src/
```

**Vulnerable Example:**
```typescript
// tools/search-tools.ts
const searchHistory: SearchQuery[] = [];  // Grows with every search

export async function handleSearch(query: string): Promise<ToolResult> {
  searchHistory.push({ query, timestamp: Date.now() });
  // ... search logic
}
```

---

### 6.3 Response Object Retention

**Pattern:** Holding full API responses when only subset is needed.

**Detection:**
```bash
grep -rn "cache\.set.*response\|store.*result" --include="*.ts" src/
```

**Vulnerable Example:**
```typescript
const issueCache = new Map<string, JiraIssueResponse>();

async function getIssue(key: string): Promise<IssueSummary> {
  if (!issueCache.has(key)) {
    const fullResponse = await api.getIssue(key, { expand: 'all' });
    issueCache.set(key, fullResponse);  // Storing FULL response
  }
  
  const cached = issueCache.get(key)!;
  return { key: cached.key, summary: cached.summary };  // Only need 2 fields
}
```

**Fix:** Store only needed fields:
```typescript
const issueCache = new Map<string, IssueSummary>();

async function getIssue(key: string): Promise<IssueSummary> {
  if (!issueCache.has(key)) {
    const response = await api.getIssue(key);
    // Store only what's needed
    issueCache.set(key, { key: response.key, summary: response.summary });
  }
  return issueCache.get(key)!;
}
```

---

### 6.4 Pagination Memory Accumulation

**Pattern:** Fetching all pages into memory before processing.

**Detection:**
```bash
grep -rn "while.*hasMore\|do.*nextPage\|getAllPages" --include="*.ts" src/
```

**Vulnerable Example:**
```typescript
async function getAllIssues(jql: string): Promise<JiraIssue[]> {
  const allIssues: JiraIssue[] = [];
  let startAt = 0;
  
  do {
    const page = await api.search(jql, { startAt, maxResults: 100 });
    allIssues.push(...page.issues);  // Memory grows with result size
    startAt += page.issues.length;
  } while (startAt < page.total);
  
  return allIssues;  // Could be millions of issues!
}
```

**Fix:** Use streaming/pagination in responses:
```typescript
async function* searchIssuesIterator(jql: string): AsyncGenerator<JiraIssue> {
  let startAt = 0;
  
  do {
    const page = await api.search(jql, { startAt, maxResults: 100 });
    for (const issue of page.issues) {
      yield issue;  // Process one at a time
    }
    startAt += page.issues.length;
  } while (startAt < page.total);
}
```

---

## Detection Summary

| Pattern | Detection Command | Severity |
|---------|------------------|----------|
| Unbounded Map/Set | `grep "new Map\|new Set"` + check for delete | High |
| Event listeners | Compare `.on()` vs `.off()` counts | High |
| setInterval | `grep "setInterval"` without clearInterval | Medium |
| Per-request clients | `grep "new.*Client"` in handlers | High |
| Module-level state | `grep "^const.*= new Map"` | Medium |
| Full response caching | Review cache.set() calls | Medium |
| Pagination accumulation | `grep "while.*page"` patterns | High |
