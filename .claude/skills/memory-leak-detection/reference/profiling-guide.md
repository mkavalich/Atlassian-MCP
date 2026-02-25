# Memory Profiling Guide

## Overview

This guide provides step-by-step instructions for profiling Node.js/TypeScript MCP servers to detect and localize memory leaks using heap snapshots, allocation timelines, and GC analysis.

---

## Prerequisites

### Required Tools

- **Chrome DevTools** - Built-in heap profiler
- **Node.js Inspector** - `--inspect` flag
- **Optional:** `clinic.js` for automated analysis

### Server Preparation

Add memory monitoring to your server:

```typescript
// src/utils/memory-monitor.ts
export function startMemoryMonitor(intervalMs = 10000): NodeJS.Timeout {
  return setInterval(() => {
    const used = process.memoryUsage();
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      heapUsed: Math.round(used.heapUsed / 1024 / 1024),
      heapTotal: Math.round(used.heapTotal / 1024 / 1024),
      external: Math.round(used.external / 1024 / 1024),
      rss: Math.round(used.rss / 1024 / 1024),
      unit: 'MB'
    }));
  }, intervalMs);
}

// Usage in server startup
import { startMemoryMonitor } from './utils/memory-monitor';
if (process.env.MEMORY_DEBUG) {
  startMemoryMonitor();
}
```

---

## Phase 1: Quick Memory Assessment

### 1.1 Baseline Measurement

```bash
# Start server with memory debugging
MEMORY_DEBUG=1 node src/index.js

# Or with tsx
MEMORY_DEBUG=1 npx tsx src/index.ts
```

Record initial memory after startup:
```
{"timestamp":"2024-01-15T10:00:00Z","heapUsed":45,"heapTotal":65,"external":2,"rss":95,"unit":"MB"}
```

### 1.2 Load Test

Run 100+ tool invocations:
```bash
# Example using curl loop
for i in {1..100}; do
  curl -X POST http://localhost:3000/tools/get_issue \
    -H "Content-Type: application/json" \
    -d '{"key":"TEST-'$i'"}'
  sleep 0.1
done
```

### 1.3 Post-Load Measurement

Compare memory after load:
```
{"timestamp":"2024-01-15T10:05:00Z","heapUsed":120,"heapTotal":150,"external":2,"rss":180,"unit":"MB"}
```

**Interpretation:**
- **Good:** heapUsed returns near baseline after GC
- **Concern:** heapUsed significantly higher than baseline
- **Leak Confirmed:** heapUsed continues growing over time

---

## Phase 2: Heap Snapshots

### 2.1 Setup Inspector

```bash
# Start with inspector enabled
node --inspect src/index.js

# Or with tsx
node --inspect -r tsx/cjs src/index.ts

# Output:
# Debugger listening on ws://127.0.0.1:9229/...
# For help, see: https://nodejs.org/en/docs/inspector
```

### 2.2 Connect Chrome DevTools

1. Open Chrome, navigate to `chrome://inspect`
2. Click "Open dedicated DevTools for Node"
3. Go to "Memory" tab

### 2.3 Take Baseline Snapshot

1. Click "Take heap snapshot"
2. Name it "Baseline - After Startup"
3. Note the retained size

### 2.4 Generate Load

Run your test scenario (e.g., 100 tool invocations)

### 2.5 Force Garbage Collection

In DevTools Console:
```javascript
// This requires --expose-gc flag, or use the "Collect garbage" button in DevTools
global.gc && global.gc();
```

Or click the trash can icon in the Memory panel.

### 2.6 Take Post-Load Snapshot

1. Click "Take heap snapshot"
2. Name it "After Load - Post GC"
3. Compare retained size

---

## Phase 3: Snapshot Comparison

### 3.1 Comparison View

1. Select the "After Load" snapshot
2. Change view dropdown from "Summary" to "Comparison"
3. Select "Baseline" as comparison target

### 3.2 Analyze Delta

Sort by "Size Delta" (descending) to find growing objects:

```
Constructor          | # New  | Size Delta | Retained Size
---------------------|--------|------------|---------------
Object               | +5000  | +2.5 MB    | +3.2 MB
(string)             | +3000  | +1.2 MB    | +1.2 MB
Map                  | +10    | +800 KB    | +2.1 MB
Array                | +200   | +500 KB    | +600 KB
```

### 3.3 Trace Retainer Paths

For suspicious objects:
1. Expand the constructor row
2. Select an instance
3. Look at "Retainers" panel (bottom)
4. Trace path back to GC root

**Example retainer path:**
```
Object@12345 (200 KB)
  └── map property of Map@6789
      └── cache property of ApiClient@1111
          └── client property of (global)
```

This shows: global → client → cache → Map holding Object

---

## Phase 4: Allocation Timeline

### 4.1 Record Allocations

1. In Memory panel, select "Allocation instrumentation on timeline"
2. Click "Start"
3. Run your test workload
4. Click "Stop"

### 4.2 Identify Allocation Hotspots

The timeline shows blue bars for allocations:
- **Tall bars:** Large allocations
- **Bars that don't shrink:** Objects not collected (potential leaks)

### 4.3 Filter to Leaking Objects

1. Click on a blue bar that persists
2. Examine the allocation stack trace
3. Identify the code path creating leaked objects

---

## Leak Localization

### 5.1 Object Tagging Technique

Add debug metadata to suspect objects:

```typescript
const DEBUG_TAG = Symbol('memoryDebug');

function createSuspectObject(data: any) {
  const obj = processData(data);
  
  // Tag for debugging
  if (process.env.MEMORY_DEBUG) {
    (obj as any)[DEBUG_TAG] = {
      createdAt: Date.now(),
      stack: new Error().stack,
      dataSize: JSON.stringify(data).length
    };
  }
  
  return obj;
}
```

In heap snapshot, search for objects with this symbol to trace creation sites.

### 5.2 WeakRef Verification

Verify if specific objects are being collected:

```typescript
const suspectRefs: WeakRef<any>[] = [];

function trackObject(obj: any, label: string) {
  if (process.env.MEMORY_DEBUG) {
    suspectRefs.push(new WeakRef(obj));
    console.log(`Tracking ${label}, current tracked: ${suspectRefs.length}`);
  }
}

// Check periodically
setInterval(() => {
  const alive = suspectRefs.filter(ref => ref.deref() !== undefined);
  console.log(`WeakRef check: ${alive.length}/${suspectRefs.length} still alive`);
}, 30000);
```

### 5.3 GC Tracing

```bash
# Detailed GC output
node --trace-gc --trace-gc-verbose src/index.js 2>&1 | tee gc.log

# Analyze patterns
grep "Mark-sweep" gc.log | tail -20
```

**Healthy pattern:**
```
[12345:0x...] Mark-sweep 65.2 (85.3) -> 45.1 (70.5) MB, 23.4 ms
```
Memory drops significantly after GC.

**Leak pattern:**
```
[12345:0x...] Mark-sweep 165.2 (185.3) -> 162.1 (180.5) MB, 43.4 ms
```
Memory barely drops - objects are retained.

---

## Automated Profiling Script

```typescript
// scripts/memory-profile.ts
import { writeFileSync } from 'fs';
import v8 from 'v8';

interface MemorySample {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
}

const samples: MemorySample[] = [];

export function startProfiling(intervalMs = 1000): NodeJS.Timeout {
  return setInterval(() => {
    const mem = process.memoryUsage();
    samples.push({
      timestamp: Date.now(),
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external
    });
  }, intervalMs);
}

export function stopProfiling(timer: NodeJS.Timeout): void {
  clearInterval(timer);
}

export function writeHeapSnapshot(label: string): string {
  const filename = `heap-${label}-${Date.now()}.heapsnapshot`;
  v8.writeHeapSnapshot(filename);
  return filename;
}

export function analyzeGrowth(): { 
  leakLikely: boolean; 
  growthRate: number;
  analysis: string;
} {
  if (samples.length < 10) {
    return { leakLikely: false, growthRate: 0, analysis: 'Insufficient samples' };
  }
  
  // Calculate linear regression on heap usage
  const n = samples.length;
  const times = samples.map(s => s.timestamp - samples[0].timestamp);
  const heaps = samples.map(s => s.heapUsed);
  
  const sumX = times.reduce((a, b) => a + b, 0);
  const sumY = heaps.reduce((a, b) => a + b, 0);
  const sumXY = times.reduce((acc, x, i) => acc + x * heaps[i], 0);
  const sumX2 = times.reduce((acc, x) => acc + x * x, 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const bytesPerMs = slope;
  const mbPerHour = (bytesPerMs * 1000 * 60 * 60) / (1024 * 1024);
  
  let analysis = `Growth rate: ${mbPerHour.toFixed(2)} MB/hour\n`;
  
  if (mbPerHour > 100) {
    analysis += 'CRITICAL: Severe memory leak detected';
    return { leakLikely: true, growthRate: mbPerHour, analysis };
  } else if (mbPerHour > 10) {
    analysis += 'HIGH: Significant memory growth detected';
    return { leakLikely: true, growthRate: mbPerHour, analysis };
  } else if (mbPerHour > 1) {
    analysis += 'MEDIUM: Slow memory growth, may be leak';
    return { leakLikely: true, growthRate: mbPerHour, analysis };
  }
  
  analysis += 'OK: Memory appears stable';
  return { leakLikely: false, growthRate: mbPerHour, analysis };
}

export function exportReport(filename: string): void {
  const report = {
    samples,
    analysis: analyzeGrowth(),
    duration: samples.length > 0 
      ? samples[samples.length - 1].timestamp - samples[0].timestamp 
      : 0
  };
  
  writeFileSync(filename, JSON.stringify(report, null, 2));
}
```

---

## Profiling Checklist

### Before Profiling
- [ ] Server built with source maps for readable stack traces
- [ ] Memory monitor added to server
- [ ] Test scenarios defined
- [ ] Baseline metrics documented

### During Profiling
- [ ] Baseline snapshot taken
- [ ] Load generated with realistic patterns
- [ ] GC forced before comparison snapshot
- [ ] Post-load snapshot taken
- [ ] Comparison analysis completed

### After Profiling
- [ ] Growth rate calculated
- [ ] Top retaining objects identified
- [ ] Retainer paths traced
- [ ] Leak source hypothesized
- [ ] Report generated

---

## Common Pitfalls

### False Positives

1. **JIT compilation cache** - Initial growth is normal as V8 compiles
2. **Module loading** - First imports increase memory
3. **Buffer pools** - Node may pre-allocate for performance

**Mitigation:** Always compare after warmup period (50+ requests)

### Measurement Interference

1. **DevTools overhead** - Profiler itself uses memory
2. **Snapshot timing** - Take after GC, not during allocation

### Environment Differences

1. **Development vs Production** - Debug builds use more memory
2. **Node version** - GC behavior varies across versions

---

## Quick Reference

| Metric | Healthy | Concerning | Critical |
|--------|---------|------------|----------|
| Heap growth/hour | <1 MB | 1-10 MB | >10 MB |
| Post-GC retention | <10% of peak | 10-50% | >50% |
| Object count growth | Stable | Linear | Exponential |
