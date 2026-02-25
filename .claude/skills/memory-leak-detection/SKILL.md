---
name: memory-leak-detection
description: Systematic memory leak detection, diagnosis, and remediation framework for Node.js/TypeScript MCP servers. Use this skill to identify unbounded caches, event listener leaks, closure captures, stream/connection leaks, and timer leaks before they cause production outages. Integrates with tool-validation for profiling during validation tests.
license: Complete terms in LICENSE.txt
---

# MCP Server Memory Leak Detection Guide

## Overview

This skill provides a systematic approach to detecting, diagnosing, and remediating memory leaks in Node.js/TypeScript MCP servers. Memory leaks in long-running MCP servers can cause gradual performance degradation, OOM crashes, and service disruptions.

**When to use this skill:**
- Before deploying MCP servers to production
- After tool-validation tests (profile during validation)
- When investigating performance degradation
- During periodic maintenance reviews
- After significant code changes
- When memory usage trends upward over time

---

# Audit Process

## High-Level Workflow

Memory leak detection follows five phases:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Phase 1        │───▶│  Phase 2        │───▶│  Phase 3        │
│  Static Analysis│    │  Architecture   │    │  Runtime        │
│                 │    │  Review         │    │  Profiling      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                     │
┌─────────────────┐    ┌─────────────────┐          │
│  Phase 5        │◀───│  Phase 4        │◀─────────┘
│  Remediation    │    │  Leak           │
│                 │    │  Localization   │
└─────────────────┘    └─────────────────┘
```

---

### Phase 1: Static Analysis

**Goal:** Identify leak-prone patterns without running code

Reference: [Leak Patterns Catalog](./reference/leak-patterns.md)

#### 1.1 Unbounded Collections

Maps, Sets, and Objects that grow without eviction are the most common leak source.

**Detection commands:**
```bash
# Find Map/Set usage without deletion
grep -rn "new Map\|new Set" --include="*.ts" src/
grep -rn "\.delete\|\.clear" --include="*.ts" src/

# Count set vs delete operations (imbalance indicates leak)
echo "Sets: $(grep -rn "\.set\(" --include="*.ts" src/ | wc -l)"
echo "Deletes: $(grep -rn "\.delete\(" --include="*.ts" src/ | wc -l)"
```

**Red flags:**
- `const cache = new Map()` with `.set()` but no `.delete()` or `.clear()`
- Missing `maxSize` or TTL on cache implementations
- In-memory stores without eviction policy

#### 1.2 Event Listener Leaks

Listeners registered in loops or frequently-called functions without removal.

**Detection commands:**
```bash
# Find event listener registration
grep -rn "\.on\(|addEventListener|\.addListener" --include="*.ts" src/

# Find event listener removal (should roughly match registration)
grep -rn "\.off\(|\.removeListener|removeEventListener|\.removeAllListeners" --include="*.ts" src/
```

**Red flags:**
- Listeners added in tool handlers without cleanup
- Missing cleanup in error paths
- `emitter.on()` inside loops

#### 1.3 Timer Leaks

Intervals without clearing, recursive timeouts without termination.

**Detection commands:**
```bash
# Find timer creation
grep -rn "setInterval\|setTimeout" --include="*.ts" src/

# Find timer cleanup
grep -rn "clearInterval\|clearTimeout" --include="*.ts" src/
```

**Red flags:**
- `setInterval` without stored reference for `clearInterval`
- Recursive `setTimeout` without base case
- Timers created in tool handlers without cleanup

#### 1.4 Closure Captures

Large objects captured in closures passed to long-lived callbacks.

**Detection commands:**
```bash
# Find async callbacks that might capture scope
grep -rn "async.*=>" --include="*.ts" src/ | head -20

# Find Promise callbacks
grep -rn "\.then\(|\.catch\(" --include="*.ts" src/
```

**Red flags:**
- Large request/response objects captured in callbacks
- Circular references between closures and containing scope
- Callbacks stored in long-lived collections

---

### Phase 2: Architecture Review

**Goal:** Identify structural patterns that lead to leaks in MCP servers

Reference: [Leak Patterns - MCP-Specific](./reference/leak-patterns.md#mcp-specific-patterns)

#### 2.1 API Client Lifecycle

**Check for:**
- [ ] Clients created per-request vs shared (singleton preferred)
- [ ] Connection pooling configured with limits
- [ ] Idle connection cleanup
- [ ] Client disposal in error paths

**Review locations:**
- `src/api/client.ts` - Main API client
- `src/auth/*.ts` - Authentication managers
- Tool handlers that create clients

#### 2.2 Tool Handler State

**Check for:**
- [ ] State accumulated across tool invocations
- [ ] Response caching without bounds
- [ ] Error objects held in memory
- [ ] Large objects not nulled after use

**Pattern to watch:**
```typescript
// LEAK: Module-level accumulation
const processedRequests: Map<string, any> = new Map();

async function handleTool(request: Request) {
  processedRequests.set(request.id, request);  // Never cleaned
  // ...
}
```

#### 2.3 Pagination Handling

**Check for:**
- [ ] Large result sets held in memory vs streamed
- [ ] Cursor/offset state accumulation
- [ ] All pages fetched before returning (memory spike)

#### 2.4 Rate Limiter State

**Check for:**
- [ ] Token bucket implementations growing unboundedly
- [ ] Per-endpoint state without cleanup
- [ ] Retry queues without bounds

---

### Phase 3: Runtime Profiling

**Goal:** Measure actual memory behavior under load

Reference: [Profiling Guide](./reference/profiling-guide.md)

#### 3.1 Quick Memory Baseline

Add monitoring to the server:
```typescript
// Add to server startup for monitoring
const memoryMonitor = setInterval(() => {
  const used = process.memoryUsage();
  console.log({
    timestamp: new Date().toISOString(),
    heapUsed: Math.round(used.heapUsed / 1024 / 1024) + 'MB',
    heapTotal: Math.round(used.heapTotal / 1024 / 1024) + 'MB',
    external: Math.round(used.external / 1024 / 1024) + 'MB',
    rss: Math.round(used.rss / 1024 / 1024) + 'MB'
  });
}, 10000);
```

#### 3.2 Heap Snapshots

**Setup:**
```bash
# Start server with inspector
node --inspect src/index.js

# Or for tsx
node --inspect -r tsx/cjs src/index.ts
```

**Profiling workflow:**
1. Take snapshot at startup (baseline)
2. Run representative workload (100+ tool invocations)
3. Force GC: `global.gc()` (requires `--expose-gc`)
4. Take snapshot after workload
5. Compare retained sizes in Chrome DevTools

#### 3.3 Load Test Scenarios

Reference: [Load Test Scenarios](./reference/load-test-scenarios.md)

**Test types:**
| Test Type | Description | Duration |
|-----------|-------------|----------|
| Single tool stress | 100+ calls to one tool | 5 min |
| Mixed workload | Realistic usage pattern | 30 min |
| Error conditions | Trigger retries/failures | 10 min |
| Long session | Extended operation | 2+ hours |

**Success criteria:**
- Memory stabilizes after warmup period
- GC reclaims memory after load stops
- No monotonic growth over extended periods

---

### Phase 4: Leak Localization

**Goal:** Pinpoint exact source of identified leaks

Reference: [Profiling Guide - Localization](./reference/profiling-guide.md#leak-localization)

#### 4.1 Heap Snapshot Comparison

In Chrome DevTools:
1. Load both snapshots
2. Select "Comparison" view
3. Sort by "Retained Size" delta
4. Look for growing object counts
5. Trace retainer paths to root

#### 4.2 Object Tagging

Temporarily tag suspect objects:
```typescript
const DEBUG_TAG = Symbol('debug');
suspectObject[DEBUG_TAG] = {
  createdAt: Date.now(),
  stack: new Error().stack
};
```

#### 4.3 WeakRef Verification

Verify objects are being collected:
```typescript
const ref = new WeakRef(suspectObject);
suspectObject = null;  // Release reference

// Later, after GC...
if (ref.deref()) {
  console.log('Object still alive - potential leak');
}
```

#### 4.4 GC Tracing

```bash
# Run with GC visibility
node --trace-gc src/index.js 2>&1 | tee gc-trace.log

# Analyze GC patterns
grep "Scavenge\|Mark-sweep" gc-trace.log
```

---

### Phase 5: Remediation

**Goal:** Apply fix patterns for identified leaks

Reference: [Remediation Templates](./reference/remediation-templates.md)

#### 5.1 Bounded Caches

```typescript
// BEFORE: Unbounded growth
const cache = new Map();

// AFTER: LRU with max size and TTL
import { LRUCache } from 'lru-cache';
const cache = new LRUCache({ 
  max: 500,
  ttl: 1000 * 60 * 5  // 5 minutes
});
```

#### 5.2 Connection Pooling

```typescript
// Configure axios/fetch with connection limits
import http from 'http';
import https from 'https';

const client = axios.create({
  httpAgent: new http.Agent({ maxSockets: 10, keepAlive: true }),
  httpsAgent: new https.Agent({ maxSockets: 10, keepAlive: true })
});
```

#### 5.3 Cleanup Patterns

```typescript
// AbortController for cleanup
const controller = new AbortController();
try {
  await operation({ signal: controller.signal });
} finally {
  controller.abort();
}
```

#### 5.4 Event Listener Cleanup

```typescript
// Use once: true for single-fire events
emitter.once('event', handler);

// Or explicit cleanup
const handler = (data) => { /* ... */ };
emitter.on('event', handler);
// In cleanup:
emitter.off('event', handler);
```

---

# Severity Classification

| Severity | Growth Rate | Impact | Example |
|----------|-------------|--------|---------|
| Critical | >100MB/hour | OOM crash imminent | Unbounded response cache |
| High | >10MB/hour | Performance degradation | Connection pool leak |
| Medium | Slow growth | Stable under normal load | Per-request allocations not freed |
| Low | Edge cases only | Minimal impact | Error path missing cleanup |

---

# Quick Start

## Automated Scan Commands

Run these commands to begin the audit:

```bash
# 1. Find unbounded collections
echo "=== Unbounded Collections ==="
grep -rn "new Map\|new Set" --include="*.ts" src/
echo "\nDeletion operations:"
grep -c "\.delete\|\.clear" --include="*.ts" src/ || echo "0"

# 2. Find event listener imbalance
echo "\n=== Event Listeners ==="
echo "Registrations: $(grep -rn "\.on\(" --include="*.ts" src/ | wc -l)"
echo "Removals: $(grep -rn "\.off\(|\.removeListener" --include="*.ts" src/ | wc -l)"

# 3. Find timer imbalance
echo "\n=== Timers ==="
echo "setInterval: $(grep -rn "setInterval" --include="*.ts" src/ | wc -l)"
echo "clearInterval: $(grep -rn "clearInterval" --include="*.ts" src/ | wc -l)"

# 4. Check for LRU/bounded cache usage
echo "\n=== Cache Libraries ==="
grep -rn "lru-cache\|quick-lru\|node-cache" package.json
```

## Manual Review Priorities

1. **Critical first:** Caches without eviction, per-request client creation
2. **High priority:** Event listeners, timer management, rate limiter state
3. **Then:** Pagination memory, closure captures, error object retention
4. **Finally:** Connection pooling, cleanup in error paths

---

# Reference Files

Load these resources during the audit:

- [Leak Patterns Catalog](./reference/leak-patterns.md) - Common patterns with detection and examples
- [Profiling Guide](./reference/profiling-guide.md) - Heap snapshot walkthrough and analysis
- [Remediation Templates](./reference/remediation-templates.md) - Copy-paste fix patterns
- [Load Test Scenarios](./reference/load-test-scenarios.md) - Test scripts for MCP servers
- [Memory Report Template](./reference/memory-report-template.md) - Findings report format

---

# Integration with Other Skills

| Skill | Integration Point |
|-------|------------------|
| tool-validation | Run memory profiling during validation tests |
| security-audit | Memory issues can cause DoS (security concern) |
| mcp-builder | Include memory best practices in new server templates |
