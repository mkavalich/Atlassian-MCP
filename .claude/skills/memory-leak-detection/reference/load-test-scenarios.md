# Load Test Scenarios for MCP Server Memory Profiling

## Overview

Test scripts and scenarios for detecting memory leaks in Atlassian MCP servers. Each scenario targets specific leak patterns and provides clear pass/fail criteria.

---

## Test Environment Setup

### Prerequisites

```bash
# Install test dependencies
npm install -D autocannon tsx

# Memory monitoring script
cat > scripts/memory-monitor.ts << 'EOF'
const samples: { time: number; heap: number }[] = [];

setInterval(() => {
  const mem = process.memoryUsage();
  samples.push({ time: Date.now(), heap: mem.heapUsed });
  
  if (samples.length > 1) {
    const first = samples[0];
    const last = samples[samples.length - 1];
    const durationHours = (last.time - first.time) / (1000 * 60 * 60);
    const growthMB = (last.heap - first.heap) / (1024 * 1024);
    const ratePerHour = durationHours > 0 ? growthMB / durationHours : 0;
    
    console.log(JSON.stringify({
      heapMB: Math.round(last.heap / 1024 / 1024),
      growthMB: growthMB.toFixed(2),
      ratePerHour: ratePerHour.toFixed(2),
      samples: samples.length
    }));
  }
}, 5000);
EOF
```

### Server Launch for Testing

```bash
# Standard launch with memory debugging
MEMORY_DEBUG=1 node --expose-gc src/index.js

# With inspector for heap snapshots
MEMORY_DEBUG=1 node --inspect --expose-gc src/index.js

# For tsx/TypeScript
MEMORY_DEBUG=1 node --inspect --expose-gc -r tsx/cjs src/index.ts
```

---

## Scenario 1: Single Tool Stress Test

### Purpose
Detect leaks in a specific tool handler by repeated invocation.

### Target Leaks
- Per-invocation state accumulation
- Event listener leaks in handlers
- Closure captures in callbacks

### Test Script

```typescript
// tests/memory/single-tool-stress.ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const ITERATIONS = 500;
const TOOL_NAME = 'get_issue';  // Change per server

async function runTest() {
  console.log(`Starting single tool stress test: ${TOOL_NAME}`);
  console.log(`Iterations: ${ITERATIONS}`);
  
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['--expose-gc', 'dist/index.js'],
    env: { ...process.env, MEMORY_DEBUG: '1' }
  });
  
  const client = new Client({ name: 'memory-test', version: '1.0.0' }, {});
  await client.connect(transport);
  
  // Baseline
  const baseline = process.memoryUsage().heapUsed;
  console.log(`Baseline heap: ${Math.round(baseline / 1024 / 1024)}MB`);
  
  // Stress test
  for (let i = 0; i < ITERATIONS; i++) {
    try {
      await client.callTool(TOOL_NAME, { key: `TEST-${i % 100}` });
    } catch {
      // Ignore errors for leak testing
    }
    
    if (i % 50 === 0) {
      global.gc?.();
      const current = process.memoryUsage().heapUsed;
      console.log(`Iteration ${i}: ${Math.round(current / 1024 / 1024)}MB`);
    }
  }
  
  // Final measurement
  global.gc?.();
  await new Promise(r => setTimeout(r, 1000));
  global.gc?.();
  
  const final = process.memoryUsage().heapUsed;
  const growth = (final - baseline) / (1024 * 1024);
  
  console.log(`\nResults:`);
  console.log(`Final heap: ${Math.round(final / 1024 / 1024)}MB`);
  console.log(`Growth: ${growth.toFixed(2)}MB`);
  console.log(`Per-iteration: ${(growth / ITERATIONS * 1024).toFixed(2)}KB`);
  
  // Pass/fail
  const THRESHOLD_MB = 10;
  if (growth > THRESHOLD_MB) {
    console.error(`❌ FAIL: Growth ${growth.toFixed(2)}MB exceeds threshold ${THRESHOLD_MB}MB`);
    process.exit(1);
  } else {
    console.log(`✅ PASS: Memory growth within acceptable range`);
  }
  
  await client.close();
}

runTest().catch(console.error);
```

### Execution

```bash
npx tsx tests/memory/single-tool-stress.ts
```

### Pass Criteria

| Metric | Pass | Investigate | Fail |
|--------|------|-------------|------|
| Total growth | <5MB | 5-10MB | >10MB |
| Per-call growth | <1KB | 1-10KB | >10KB |
| Post-GC retention | <baseline+20% | +20-50% | >+50% |

---

## Scenario 2: Mixed Workload Simulation

### Purpose
Simulate realistic usage patterns with varied tool calls.

### Target Leaks
- State accumulation across different tools
- Resource sharing issues
- Connection pool exhaustion

### Test Script

```typescript
// tests/memory/mixed-workload.ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

const DURATION_MINUTES = 30;
const CALLS_PER_MINUTE = 20;

interface ToolCall {
  name: string;
  args: Record<string, any>;
  weight: number;  // Probability weight
}

// Adjust for your server
const TOOL_MIX: ToolCall[] = [
  { name: 'get_issue', args: { key: 'TEST-1' }, weight: 30 },
  { name: 'search_jql', args: { jql: 'project = TEST' }, weight: 20 },
  { name: 'get_project', args: { projectKey: 'TEST' }, weight: 15 },
  { name: 'list_projects', args: {}, weight: 10 },
  { name: 'get_user', args: { accountId: 'test' }, weight: 10 },
  { name: 'get_transitions', args: { issueKey: 'TEST-1' }, weight: 15 },
];

function selectTool(): ToolCall {
  const totalWeight = TOOL_MIX.reduce((sum, t) => sum + t.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const tool of TOOL_MIX) {
    random -= tool.weight;
    if (random <= 0) return tool;
  }
  return TOOL_MIX[0];
}

async function runMixedWorkload() {
  console.log('Mixed workload simulation');
  console.log(`Duration: ${DURATION_MINUTES} minutes`);
  console.log(`Rate: ${CALLS_PER_MINUTE} calls/minute`);
  
  // Setup client...
  const client = await setupClient();
  
  const startTime = Date.now();
  const endTime = startTime + DURATION_MINUTES * 60 * 1000;
  const samples: { time: number; heap: number }[] = [];
  
  let callCount = 0;
  const intervalMs = 60000 / CALLS_PER_MINUTE;
  
  while (Date.now() < endTime) {
    const tool = selectTool();
    
    try {
      await client.callTool(tool.name, tool.args);
      callCount++;
    } catch {
      // Continue on error
    }
    
    // Sample memory every 30 seconds
    if (callCount % Math.floor(CALLS_PER_MINUTE / 2) === 0) {
      global.gc?.();
      samples.push({
        time: Date.now(),
        heap: process.memoryUsage().heapUsed
      });
      
      const elapsed = (Date.now() - startTime) / 60000;
      console.log(`${elapsed.toFixed(1)}min: ${Math.round(samples[samples.length-1].heap / 1024 / 1024)}MB, ${callCount} calls`);
    }
    
    await new Promise(r => setTimeout(r, intervalMs));
  }
  
  // Analyze trend
  analyzeGrowthTrend(samples);
  
  await client.close();
}

function analyzeGrowthTrend(samples: { time: number; heap: number }[]): void {
  if (samples.length < 5) {
    console.log('Insufficient samples for trend analysis');
    return;
  }
  
  // Linear regression
  const n = samples.length;
  const times = samples.map(s => (s.time - samples[0].time) / (1000 * 60 * 60));  // hours
  const heaps = samples.map(s => s.heap / (1024 * 1024));  // MB
  
  const sumX = times.reduce((a, b) => a + b, 0);
  const sumY = heaps.reduce((a, b) => a + b, 0);
  const sumXY = times.reduce((acc, x, i) => acc + x * heaps[i], 0);
  const sumX2 = times.reduce((acc, x) => acc + x * x, 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  
  console.log(`\nGrowth Rate: ${slope.toFixed(2)} MB/hour`);
  
  if (slope > 100) {
    console.error('❌ CRITICAL: Severe leak detected');
  } else if (slope > 10) {
    console.error('❌ HIGH: Significant leak detected');
  } else if (slope > 1) {
    console.warn('⚠️ MEDIUM: Slow leak may exist');
  } else {
    console.log('✅ PASS: Memory appears stable');
  }
}
```

### Pass Criteria

| Duration | Max Growth Rate | Notes |
|----------|----------------|-------|
| 30 min | <5 MB/hour | Quick check |
| 2 hours | <2 MB/hour | Standard test |
| 8 hours | <1 MB/hour | Long-running validation |

---

## Scenario 3: Error Condition Stress

### Purpose
Detect leaks in error handling paths.

### Target Leaks
- Error object accumulation
- Retry state not cleaned
- Connection leak on failures

### Test Script

```typescript
// tests/memory/error-stress.ts

const ERROR_SCENARIOS = [
  // Invalid inputs
  { tool: 'get_issue', args: { key: '' }, error: 'validation' },
  { tool: 'get_issue', args: { key: 'INVALID-99999' }, error: 'not_found' },
  
  // Auth errors (use invalid token)
  { tool: 'get_project', args: { projectKey: 'NOACCESS' }, error: 'permission' },
  
  // Rate limit simulation (if testable)
  { tool: 'search_jql', args: { jql: 'order by created' }, error: 'rate_limit' },
  
  // Timeout scenarios (large queries)
  { tool: 'search_jql', args: { jql: 'project in projectHistory()' }, error: 'timeout' },
];

async function errorStressTest() {
  console.log('Error condition stress test');
  
  const client = await setupClient();
  const ITERATIONS = 200;
  
  const baseline = process.memoryUsage().heapUsed;
  let errorCount = 0;
  
  for (let i = 0; i < ITERATIONS; i++) {
    const scenario = ERROR_SCENARIOS[i % ERROR_SCENARIOS.length];
    
    try {
      await client.callTool(scenario.tool, scenario.args);
    } catch {
      errorCount++;
    }
    
    if (i % 20 === 0) {
      global.gc?.();
      const heap = process.memoryUsage().heapUsed;
      console.log(`Iteration ${i}: ${Math.round(heap / 1024 / 1024)}MB, errors: ${errorCount}`);
    }
  }
  
  global.gc?.();
  await new Promise(r => setTimeout(r, 2000));
  global.gc?.();
  
  const final = process.memoryUsage().heapUsed;
  const growth = (final - baseline) / (1024 * 1024);
  
  console.log(`\nError path growth: ${growth.toFixed(2)}MB over ${ITERATIONS} errors`);
  console.log(`Per-error: ${(growth / errorCount * 1024).toFixed(2)}KB`);
  
  // Errors should not cause memory growth
  if (growth > 5) {
    console.error('❌ FAIL: Error handling leaks memory');
    process.exit(1);
  } else {
    console.log('✅ PASS: Error handling is clean');
  }
}
```

### Pass Criteria

- Error count should not correlate with memory growth
- Post-GC memory should return to baseline
- No accumulation in error logs (check server-side)

---

## Scenario 4: Long Session Test

### Purpose
Detect slow leaks that only manifest over extended periods.

### Target Leaks
- Slow accumulation (1-5KB per call)
- Timer/interval leaks
- Connection keepalive accumulation

### Test Configuration

```bash
# Run overnight (8+ hours)
DURATION_HOURS=8
CALLS_PER_HOUR=60  # Low intensity

# Launch with memory logging
MEMORY_DEBUG=1 node --expose-gc dist/index.js 2>&1 | tee long-session-$(date +%Y%m%d).log &
```

### Analysis Script

```typescript
// scripts/analyze-long-session.ts
import { readFileSync } from 'fs';

const logFile = process.argv[2];
if (!logFile) {
  console.error('Usage: npx tsx scripts/analyze-long-session.ts <logfile>');
  process.exit(1);
}

const lines = readFileSync(logFile, 'utf-8').split('\n');
const memoryLines = lines.filter(l => l.includes('"heapUsed"') || l.includes('heapMB'));

const samples: { time: Date; heap: number }[] = [];

for (const line of memoryLines) {
  try {
    const match = line.match(/(\d{4}-\d{2}-\d{2}T[\d:.]+Z?).*heapUsed[":]+\s*(\d+)/i);
    if (match) {
      samples.push({
        time: new Date(match[1]),
        heap: parseInt(match[2])
      });
    }
  } catch {
    // Skip unparseable lines
  }
}

if (samples.length < 10) {
  console.error('Insufficient data points');
  process.exit(1);
}

// Calculate hourly growth rate
const firstHour = samples.slice(0, Math.floor(samples.length * 0.1));
const lastHour = samples.slice(-Math.floor(samples.length * 0.1));

const firstAvg = firstHour.reduce((s, x) => s + x.heap, 0) / firstHour.length;
const lastAvg = lastHour.reduce((s, x) => s + x.heap, 0) / lastHour.length;

const durationMs = samples[samples.length - 1].time.getTime() - samples[0].time.getTime();
const durationHours = durationMs / (1000 * 60 * 60);

const growthMB = (lastAvg - firstAvg) / (1024 * 1024);
const ratePerHour = growthMB / durationHours;

console.log(`Session Analysis`);
console.log(`================`);
console.log(`Duration: ${durationHours.toFixed(1)} hours`);
console.log(`Samples: ${samples.length}`);
console.log(`First hour avg: ${(firstAvg / 1024 / 1024).toFixed(1)}MB`);
console.log(`Last hour avg: ${(lastAvg / 1024 / 1024).toFixed(1)}MB`);
console.log(`Total growth: ${growthMB.toFixed(2)}MB`);
console.log(`Growth rate: ${ratePerHour.toFixed(2)} MB/hour`);
console.log(`Projected 24h: ${(ratePerHour * 24).toFixed(1)}MB`);

if (ratePerHour > 10) {
  console.error('\n❌ CRITICAL: Severe memory leak');
} else if (ratePerHour > 5) {
  console.error('\n❌ HIGH: Significant memory leak');  
} else if (ratePerHour > 1) {
  console.warn('\n⚠️ MEDIUM: Slow leak detected');
} else {
  console.log('\n✅ PASS: Memory stable over long session');
}
```

### Pass Criteria

| Test Duration | Acceptable Growth | Notes |
|---------------|-------------------|-------|
| 8 hours | <10MB total | Overnight test |
| 24 hours | <25MB total | Full day validation |
| 7 days | <100MB total | Production-like |

---

## Scenario 5: Pagination Deep Test

### Purpose
Detect memory issues with large result sets.

### Target Leaks
- Pagination state accumulation
- Large response caching
- Result set memory spikes

### Test Script

```typescript
// tests/memory/pagination-stress.ts

async function paginationTest() {
  console.log('Pagination memory test');
  
  const client = await setupClient();
  
  // Test with progressively larger result sets
  const queries = [
    { jql: 'project = TEST', expected: 10 },
    { jql: 'project = TEST ORDER BY created', expected: 100 },
    { jql: 'project IN (TEST, DEMO, PROD)', expected: 500 },
    { jql: 'created > -30d', expected: 1000 },
  ];
  
  for (const query of queries) {
    global.gc?.();
    const before = process.memoryUsage().heapUsed;
    
    console.log(`\nQuery: ${query.jql}`);
    console.log(`Before: ${Math.round(before / 1024 / 1024)}MB`);
    
    try {
      // This tool should handle pagination internally
      const result = await client.callTool('search_jql', { 
        jql: query.jql,
        maxResults: 1000  // Request large result
      });
      
      const afterFetch = process.memoryUsage().heapUsed;
      console.log(`After fetch: ${Math.round(afterFetch / 1024 / 1024)}MB`);
      
      // Clear result reference
      // (result goes out of scope)
    } catch (e) {
      console.log(`Query failed (expected for large sets): ${e.message}`);
    }
    
    global.gc?.();
    await new Promise(r => setTimeout(r, 1000));
    global.gc?.();
    
    const after = process.memoryUsage().heapUsed;
    console.log(`After GC: ${Math.round(after / 1024 / 1024)}MB`);
    
    const retained = (after - before) / (1024 * 1024);
    console.log(`Retained: ${retained.toFixed(2)}MB`);
    
    if (retained > 5) {
      console.warn(`⚠️ High retention for query: ${query.jql}`);
    }
  }
  
  await client.close();
}
```

### Pass Criteria

- Memory should return to baseline after each query
- Retained memory should not scale with result size
- Peak memory acceptable, but must be released

---

## Server-Specific Test Configurations

### jira-projects Server

```typescript
const TOOLS_TO_TEST = [
  'search_jql',
  'get_issue', 
  'create_issue',
  'get_project',
  'list_projects',
];
```

### jira-workflows Server

```typescript
const TOOLS_TO_TEST = [
  'get_workflows',
  'get_screens',
  'get_workflow_schemes_detailed',
  'get_automation_rules',
];
```

### confluence Server

```typescript
const TOOLS_TO_TEST = [
  'search_pages',
  'get_page',
  'create_page',
  'search_spaces',
  'get_attachments',
];
```

---

## Quick Commands Reference

```bash
# Single tool stress (500 iterations)
npx tsx tests/memory/single-tool-stress.ts

# Mixed workload (30 minutes)
npx tsx tests/memory/mixed-workload.ts

# Error handling stress
npx tsx tests/memory/error-stress.ts

# Long session (background, 8 hours)
nohup npx tsx tests/memory/long-session.ts > long-session.log 2>&1 &

# Analyze long session results
npx tsx scripts/analyze-long-session.ts long-session.log

# Quick memory check (manual)
node --expose-gc -e "
  const before = process.memoryUsage().heapUsed;
  // Your test here
  global.gc();
  const after = process.memoryUsage().heapUsed;
  console.log('Growth:', ((after-before)/1024/1024).toFixed(2), 'MB');
"
```
