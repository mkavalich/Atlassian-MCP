---
name: jpd-prioritization-review
version: 1.0.0
description: >
  Generate a prioritization readiness report for Jira Product Discovery ideas.
  Analyzes which ideas have complete scoring, sufficient evidence, and are ready
  for quarterly planning. Use this skill when the user asks to "review idea
  backlog", "check prioritization readiness", "prepare for planning", "analyze
  JPD ideas", "score coverage report", or any request involving assessment of
  idea maturity and planning readiness in Jira Product Discovery.
tags:
  - jira-product-discovery
  - prioritization
  - planning
  - backlog-review
---

# JPD Prioritization Review

## Purpose

This skill generates a prioritization readiness report for Jira Product
Discovery (JPD) projects, answering critical planning questions:

- Which ideas have complete prioritization scores?
- Which ideas have supporting evidence (insights)?
- Which ideas are missing data and aren't ready for prioritization?
- What are the top ideas by different scoring criteria?
- How mature is the overall backlog for planning?

**The core problem this solves:** JPD backlogs accumulate ideas at different
maturity levels. Some have extensive customer evidence and complete scoring,
others are just rough concepts. Without systematic review, planning sessions
waste time debating incomplete ideas. This skill surfaces data gaps before
planning begins.

**Scope:** Single JPD project per review. Jira Product Discovery Cloud only.

---

## Phase 0: Project Discovery

Validate the target JPD project exists and is accessible.

### Step 0.1: List JPD Projects

```
get_jpd_projects()
```

Find the target project by name or key. Extract the project ID.

**Note:** JPD projects are distinct from regular Jira projects. They appear
in the JPD interface but may not show in standard project searches.

### Step 0.2: Validate Project Access

Confirm the project is accessible and contains ideas. If the project is
empty or the user lacks access, stop early with clear feedback.

### CHECKPOINT: Project Discovery

**Success criteria:**
- JPD project found and accessible
- Project ID retrieved

**If project not found:**
1. List available JPD projects to help user identify correct target
2. Verify the user has JPD access (separate from Jira access)
3. Confirm the project name/key is correct

---

## Phase 1: Idea Inventory

Retrieve all ideas with their basic metadata.

### Step 1.1: Get All Ideas

```
get_ideas({
  projectId: "<PROJECT_ID>",
  limit: 100
})
```

Handle pagination using `nextPageToken` if the project has more than 100 ideas.
Continue fetching until all ideas are retrieved.

**Important:** The `get_ideas` tool uses POST to the search endpoint with JQL.
Empty results may indicate filter issues, not absence of ideas.

### Step 1.2: Record Idea Metadata

For each idea, capture:
- Idea ID (key like JPD-123 or numeric ID)
- Summary/title
- Status (e.g., New, Under Review, Planned, Won't Do)
- Labels
- Created date
- Creator

### CHECKPOINT: Idea Inventory

**Success criteria:**
- All ideas retrieved (verify against expected count)
- Basic metadata captured for each idea

**If pagination breaks or returns empty:**
1. Try `search_ideas` with explicit filters as fallback
2. Check if ideas exist in the UI but aren't returned via API
3. Note any access restrictions on specific ideas

---

## Phase 2: Scoring Analysis

Retrieve prioritization scores for each idea.

### Step 2.1: Get Idea Scores

For each idea:

```
get_idea_scoring({ideaId: "<IDEA_ID>"})
```

**Critical:** The scoring endpoint uses Polaris GraphQL internally. Failures
may return empty results rather than errors. Treat empty response as "no
scores" rather than an error.

### Step 2.2: Categorize Scoring Completeness

For each idea, assess scoring maturity:

| Category | Criteria |
|----------|----------|
| **Fully Scored** | All configured scoring fields have values |
| **Partially Scored** | Some scoring fields populated, others empty |
| **Not Scored** | No scoring data at all |

Track which specific fields are commonly missing (e.g., "Impact" filled but
"Effort" empty across many ideas).

### Step 2.3: Calculate Score Distributions

If numerical scores exist:
- Calculate min/max/average for each scoring dimension
- Identify outliers (unusually high or low scores)
- Note score concentrations (e.g., most ideas clustered at "Medium")

### CHECKPOINT: Scoring Analysis

**Success criteria:**
- Scoring data retrieved for all ideas (including "none")
- Ideas categorized by scoring completeness
- Missing field patterns identified

**If scoring calls fail repeatedly:**
1. The JPD project may not have scoring configured
2. Check if scoring is visible in the JPD UI
3. Report as "scoring not configured" rather than error

---

## Phase 3: Evidence Analysis

Analyze insight coverage for each idea.

### Step 3.1: Get Insights per Idea

For each idea:

```
get_insights({ideaId: "<IDEA_ID>"})
```

Count total insights linked to each idea. Insights are evidence pieces
(customer quotes, research findings, support tickets) that support the idea.

### Step 3.2: Analyze Insight Themes

For ideas with multiple insights, get thematic analysis:

```
analyze_idea_insights({ideaId: "<IDEA_ID>"})
```

This summarizes what the evidence says about the idea.

### Step 3.3: Categorize Evidence Coverage

| Category | Criteria |
|----------|----------|
| **Strong Evidence** | 5+ insights from diverse sources |
| **Some Evidence** | 1-4 insights |
| **No Evidence** | Zero insights |

Track evidence source distribution:
- Customer feedback
- Support tickets
- Research findings
- Internal requests

### CHECKPOINT: Evidence Analysis

**Success criteria:**
- Insight counts captured for all ideas
- Evidence categories assigned
- Source distribution noted

**If insight retrieval fails:**
1. JPD insights use GraphQL - may have different access controls
2. Empty response means no insights, not failure
3. Continue with other ideas; note any that error

---

## Phase 4: Report Synthesis

Generate the prioritization readiness report.

### Step 4.1: Overall Readiness Summary

```
PRIORITIZATION READINESS REPORT
===============================
Project: <PROJECT_NAME>
Review Date: <DATE>
Total Ideas: <COUNT>

READINESS OVERVIEW
------------------
Ready for Planning:      <COUNT> (<PERCENTAGE>%)
  (Fully scored + has evidence)

Needs Scoring:           <COUNT> (<PERCENTAGE>%)
  (Has evidence, missing scores)

Needs Evidence:          <COUNT> (<PERCENTAGE>%)
  (Has scores, no supporting data)

Not Ready:               <COUNT> (<PERCENTAGE>%)
  (Missing both scores and evidence)
```

### Step 4.2: Top Ideas by Scoring

If scoring exists, rank ideas:

```
TOP IDEAS BY SCORE
------------------
| Rank | Idea | Score | Evidence | Status |
|------|------|-------|----------|--------|
| 1    | JPD-42 | 8.5 | 12 insights | Under Review |
| 2    | JPD-17 | 8.2 | 7 insights  | Planned |
...

Note: Ideas with incomplete scoring are excluded from ranking.
```

### Step 4.3: Data Gap Analysis

Identify systemic gaps:

```
DATA GAPS
---------
Scoring fields most commonly empty:
  - Effort: 45% of ideas missing
  - Strategic Fit: 38% of ideas missing

Ideas with zero evidence:
  - JPD-51: "Mobile app redesign"
  - JPD-63: "API v2 upgrade"
  - (list all)

Status distribution:
  - New: 25
  - Under Review: 15
  - Planned: 8
  - Won't Do: 12
```

### Step 4.4: Planning Recommendations

Based on findings:

**If readiness is high (>70% ready):**
- Proceed with planning session
- Focus debate on top-ranked items
- Quick review of edge cases

**If readiness is medium (40-70% ready):**
- Schedule scoring sprint before planning
- Assign evidence gathering for key ideas
- Consider planning only "ready" subset

**If readiness is low (<40% ready):**
- Delay planning until backlog matures
- Run discovery/research sprint
- Define minimum criteria for idea submission

### CHECKPOINT: Report Complete

**Success criteria:**
- Overall readiness percentage calculated
- Top ideas identified (if scoring exists)
- Data gaps documented
- Recommendations provided

**Deliver report** in requested format.

---

## Anti-Patterns (DO NOT)

1. **DO NOT** assume missing scores mean the idea is bad. Scoring may simply
   not be configured or the idea is new.

2. **DO NOT** use standard Jira JQL to search JPD ideas. JPD uses its own
   search/filter mechanisms.

3. **DO NOT** treat empty insight results as errors. Many ideas legitimately
   have no linked evidence.

4. **DO NOT** compare scores across projects. Scoring criteria vary by project.

5. **DO NOT** recommend deleting ideas with low scores. This is analysis only;
   prioritization decisions belong to product teams.

6. **DO NOT** skip the project validation step. Trying to query ideas in a
   non-JPD project will fail with confusing errors.

7. **DO NOT** assume idea IDs are always numeric. JPD supports both key format
   (JPD-123) and numeric IDs.

---

## Tool Reference

| Tool | Purpose | Phase |
|------|---------|-------|
| `get_jpd_projects` | List JPD projects | 0 |
| `get_ideas` | Get all ideas in project | 1 |
| `get_idea` | Get single idea details | 1 |
| `search_ideas` | Filter ideas by criteria | 1 |
| `get_idea_scoring` | Get prioritization scores | 2 |
| `get_insights` | Get linked evidence | 3 |
| `analyze_idea_insights` | Summarize evidence themes | 3 |
