# Memory Leak Detection Report Template

Use this template to document findings from the 5-phase memory leak detection workflow.

---

## Report Header

```markdown
# Memory Leak Detection Report

**Server:** [server-name] (e.g., jira-projects)
**Version:** [version]
**Date:** [YYYY-MM-DD]
**Analyst:** [name/Claude]
**Status:** [Draft | Review | Final]

## Executive Summary

**Overall Assessment:** [✅ No Issues | ⚠️ Minor Issues | 🔶 Moderate Issues | 🔴 Critical Issues]

**Key Findings:**
- [1-3 sentence summary of most important findings]

**Immediate Actions Required:**
- [ ] [Action 1]
- [ ] [Action 2]

**Memory Health Score:** [X/10]
```

---

## Section 1: Static Analysis Findings

```markdown
## 1. Static Analysis Findings

### 1.1 Unbounded Collections

| Location | Type | Risk | Pattern |
|----------|------|------|---------|
| `src/tools/search.ts:45` | Map | High | Cache without eviction |
| `src/utils/rate-limiter.ts:12` | Set | Medium | Request tracking |

**Detection Commands Used:**
```bash
grep -rn "new Map\|new Set" --include="*.ts" src/
```

**Findings:**
- [X] Maps found: [count]
- [X] Sets found: [count]
- [X] With cleanup (.delete/.clear): [count]
- [X] Without cleanup (potential leaks): [count]

### 1.2 Event Listener Balance

| Event Type | Registrations | Removals | Delta |
|------------|---------------|----------|-------|
| .on() | [X] | [X] | [+/-X] |
| .once() | [X] | N/A | N/A |
| .addListener() | [X] | [X] | [+/-X] |

**Assessment:** [Balanced | Imbalanced - investigate]

### 1.3 Timer Balance

| Timer Type | Created | Cleared | Delta |
|------------|---------|---------|-------|
| setInterval | [X] | [X] | [+/-X] |
| setTimeout | [X] | [X] | [+/-X] |

**Assessment:** [Balanced | Imbalanced - investigate]

### 1.4 Closure Analysis

**Large Objects in Callbacks:**
| File | Line | Captured Variable | Size Estimate |
|------|------|-------------------|---------------|
| | | | |

### 1.5 Static Analysis Summary

- **Issues Found:** [count]
- **Critical:** [count]
- **High:** [count]
- **Medium:** [count]
- **Low:** [count]
```

---

## Section 2: Architecture Review Findings

```markdown
## 2. Architecture Review Findings

### 2.1 API Client Lifecycle

**Pattern Detected:** [Per-request creation | Singleton | Pooled]

| Client | Location | Lifecycle | Issue |
|--------|----------|-----------|-------|
| Jira REST | `src/clients/jira.ts` | [per-request/singleton] | [none/leak risk] |
| HTTP Agent | `src/utils/http.ts` | [per-request/pooled] | [none/leak risk] |

**Recommendation:** [No change needed | Convert to singleton | Add pooling]

### 2.2 Tool Handler State

**Module-Level State Found:**

| Variable | File | Type | Cleanup Mechanism |
|----------|------|------|-------------------|
| `requestCache` | `src/tools/search.ts` | Map | [none/TTL/LRU] |
| `pendingRequests` | `src/tools/bulk.ts` | Set | [none/finally] |

**Risk Assessment:** [Low | Medium | High]

### 2.3 Pagination Strategy

**Pattern Detected:** [Accumulate all | Stream/callback | Hybrid]

| Tool | Strategy | Max Results | Memory Risk |
|------|----------|-------------|-------------|
| search_jql | [accumulate/stream] | [unlimited/capped] | [low/high] |
| get_all_projects | [accumulate/stream] | [unlimited/capped] | [low/high] |

**Recommendation:** [No change | Add streaming | Add result cap]

### 2.4 Rate Limiter State

**Implementation:** [Token bucket | Sliding window | Fixed window]
**State Cleanup:** [Yes - TTL | Yes - periodic | No - accumulates]
**Risk:** [Low | Medium | High]

### 2.5 Architecture Summary

| Category | Status | Priority |
|----------|--------|----------|
| API Clients | [✅ OK | ⚠️ Review | 🔴 Fix] | [P1/P2/P3] |
| Tool State | [✅ OK | ⚠️ Review | 🔴 Fix] | [P1/P2/P3] |
| Pagination | [✅ OK | ⚠️ Review | 🔴 Fix] | [P1/P2/P3] |
| Rate Limiting | [✅ OK | ⚠️ Review | 🔴 Fix] | [P1/P2/P3] |
```

---

## Section 3: Runtime Profiling Results

```markdown
## 3. Runtime Profiling Results

### 3.1 Test Environment

- **Node Version:** [version]
- **OS:** [Windows/Linux/macOS] [version]
- **Available Memory:** [X GB]
- **Test Duration:** [X minutes/hours]

### 3.2 Baseline Measurements

| Metric | Value |
|--------|-------|
| Initial Heap Used | [X] MB |
| Initial Heap Total | [X] MB |
| Initial External | [X] MB |
| Initial RSS | [X] MB |

### 3.3 Load Test Results

#### Scenario 1: Single Tool Stress (500 iterations)

| Metric | Before | After | Delta | Pass/Fail |
|--------|--------|-------|-------|-----------|
| Heap Used | [X] MB | [X] MB | [+X] MB | [✅/❌] |
| Per-Call Growth | - | - | [X] KB | [✅ <1KB / ❌ >1KB] |

**Tool Tested:** [tool_name]
**Result:** [PASS | FAIL]

#### Scenario 2: Mixed Workload (30 min)

| Metric | Start | End | Growth Rate | Pass/Fail |
|--------|-------|-----|-------------|-----------|
| Heap Used | [X] MB | [X] MB | [X] MB/hr | [✅ <5MB/hr / ❌] |

**Tools Tested:** [list]
**Call Rate:** [X] calls/min
**Result:** [PASS | FAIL]

#### Scenario 3: Error Stress (200 errors)

| Error Type | Count | Memory Before | Memory After | Accumulated |
|------------|-------|---------------|--------------|-------------|
| Network timeout | [X] | [X] MB | [X] MB | [Yes/No] |
| API error | [X] | [X] MB | [X] MB | [Yes/No] |
| Invalid input | [X] | [X] MB | [X] MB | [Yes/No] |

**Result:** [PASS - no accumulation | FAIL - errors accumulate]

#### Scenario 4: Long Session (if performed)

| Duration | Heap Used | Growth Rate | Projection (24hr) |
|----------|-----------|-------------|-------------------|
| 0 hr | [X] MB | - | - |
| 2 hr | [X] MB | [X] MB/hr | [X] MB |
| 8 hr | [X] MB | [X] MB/hr | [X] MB |

**Result:** [PASS <10MB/8hr | FAIL]

### 3.4 GC Behavior

```
[Paste relevant --trace-gc output or summary]
```

**GC Effectiveness:** [Good - memory reclaimed | Poor - retained objects]

### 3.5 Profiling Summary

| Scenario | Result | Growth Rate | Action |
|----------|--------|-------------|--------|
| Single Tool | [PASS/FAIL] | [X] KB/call | [None/Investigate] |
| Mixed Workload | [PASS/FAIL] | [X] MB/hr | [None/Investigate] |
| Error Stress | [PASS/FAIL] | [accumulates?] | [None/Investigate] |
| Long Session | [PASS/FAIL/N/A] | [X] MB/hr | [None/Investigate] |
```

---

## Section 4: Leak Localization

```markdown
## 4. Leak Localization

### 4.1 Heap Snapshot Comparison

**Snapshots Taken:**
1. Baseline: [timestamp] - [X] MB
2. After load: [timestamp] - [X] MB
3. After GC: [timestamp] - [X] MB

**Delta Analysis (Snapshot 3 - Snapshot 1):**

| Constructor | Count Δ | Size Δ | Retained Δ |
|-------------|---------|--------|------------|
| [Object] | [+X] | [+X KB] | [+X KB] |
| [Array] | [+X] | [+X KB] | [+X KB] |
| [String] | [+X] | [+X KB] | [+X KB] |
| [Map] | [+X] | [+X KB] | [+X KB] |

### 4.2 Retainer Paths

**Leak 1: [Description]**
```
[Object] @[address]
  └── [property] in [Parent Object]
      └── [property] in [GrandParent]
          └── [property] in [Root/Global]
```
**Root Cause:** [explanation]
**File:** `src/[path]:[line]`

**Leak 2: [Description]**
```
[Retainer path]
```
**Root Cause:** [explanation]
**File:** `src/[path]:[line]`

### 4.3 Allocation Timeline Hotspots

| Timestamp | Allocation | Size | Stack Trace |
|-----------|------------|------|-------------|
| [X]s | [type] | [X] KB | `[function] at [file:line]` |

### 4.4 Confirmed Leaks

| ID | Location | Type | Severity | Growth Rate |
|----|----------|------|----------|-------------|
| L1 | `src/tools/search.ts:45` | Unbounded Map | High | ~50KB/call |
| L2 | `src/clients/jira.ts:23` | Per-request client | Medium | ~10KB/call |

### 4.5 False Positives / Acceptable Growth

| Pattern | Reason Acceptable |
|---------|-------------------|
| [pattern] | [explanation - e.g., bounded cache working as designed] |
```

---

## Section 5: Remediation Plan

```markdown
## 5. Remediation Plan

### 5.1 Critical Fixes (P1 - Immediate)

#### Fix L1: [Brief description]

**Location:** `src/[file]:[line]`
**Issue:** [description]
**Impact:** [X] MB/hour growth

**Before:**
```typescript
// Problematic code
```

**After:**
```typescript
// Fixed code
```

**Verification:**
- [ ] Unit test added
- [ ] Memory test passes (<1KB/call)
- [ ] Code reviewed

---

#### Fix L2: [Brief description]

[Same structure as above]

---

### 5.2 High Priority Fixes (P2 - This Sprint)

[List with same structure]

### 5.3 Medium Priority Fixes (P3 - Next Sprint)

[List with same structure]

### 5.4 Low Priority / Tech Debt

[List items for future consideration]

### 5.5 Remediation Summary

| Fix ID | Description | Severity | Effort | Status |
|--------|-------------|----------|--------|--------|
| L1 | [desc] | Critical | [S/M/L] | [Todo/In Progress/Done] |
| L2 | [desc] | High | [S/M/L] | [Todo/In Progress/Done] |
```

---

## Section 6: Verification Results

```markdown
## 6. Post-Fix Verification

### 6.1 Before/After Comparison

| Metric | Before Fix | After Fix | Improvement |
|--------|------------|-----------|-------------|
| Heap growth (500 calls) | [X] MB | [X] MB | [X]% reduction |
| Per-call growth | [X] KB | [X] KB | [X]% reduction |
| 30-min growth rate | [X] MB/hr | [X] MB/hr | [X]% reduction |

### 6.2 Load Test Results (Post-Fix)

| Scenario | Before | After | Status |
|----------|--------|-------|--------|
| Single Tool Stress | FAIL | [PASS/FAIL] | [✅/❌] |
| Mixed Workload | FAIL | [PASS/FAIL] | [✅/❌] |
| Error Stress | FAIL | [PASS/FAIL] | [✅/❌] |

### 6.3 Regression Check

- [ ] All existing tests pass
- [ ] No new memory issues introduced
- [ ] Performance not degraded
```

---

## Section 7: Recommendations

```markdown
## 7. Recommendations

### 7.1 Immediate Actions
1. [Action with owner and deadline]
2. [Action with owner and deadline]

### 7.2 Process Improvements
- [ ] Add memory tests to CI pipeline
- [ ] Set memory budget alerts (e.g., >500MB heap)
- [ ] Schedule quarterly memory audits

### 7.3 Monitoring Setup
```typescript
// Recommended memory monitoring
setInterval(() => {
  const used = process.memoryUsage();
  if (used.heapUsed > 500 * 1024 * 1024) {
    console.warn('Memory threshold exceeded:', used.heapUsed);
  }
}, 60000);
```

### 7.4 Documentation Updates
- [ ] Update CONTRIBUTING.md with memory guidelines
- [ ] Add memory patterns to code review checklist
- [ ] Document cache size limits in README
```

---

## Appendices

```markdown
## Appendix A: Raw Profiling Data

[Attach or link to raw heap snapshots, memory logs, etc.]

## Appendix B: Test Scripts Used

[Include or link to test scripts]

## Appendix C: Environment Details

```
Node: [version]
npm: [version]
OS: [details]
Hardware: [CPU/RAM]
```

## Appendix D: References

- [Link to leak-patterns.md]
- [Link to profiling-guide.md]
- [Link to remediation-templates.md]
- [Link to load-test-scenarios.md]
```

---

## Quick Report (Abbreviated Format)

For quick assessments, use this condensed format:

```markdown
# Memory Check: [server-name] - [date]

## Status: [✅ PASS | ❌ FAIL]

## Quick Stats
- Static issues found: [X]
- Runtime growth: [X] MB/hr
- Critical leaks: [X]

## Action Items
1. [ ] [Most important fix]
2. [ ] [Second priority]

## Next Review: [date]
```
