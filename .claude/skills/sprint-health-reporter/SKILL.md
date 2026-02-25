---
name: sprint-health-reporter
version: 1.0.0
description: >
  Generate a sprint health report synthesizing current sprint state, velocity
  trends, slip rate, blocked items, and workload distribution. Optionally
  publishes to Confluence. Use this skill when the user asks for "sprint
  report", "sprint health", "velocity report", "sprint status", "blocked
  issues report", "workload analysis", or any request involving analysis
  of current sprint progress and team health metrics.
tags:
  - jira
  - sprint
  - scrum
  - agile
  - velocity
---

# Sprint Health Reporter

## Purpose

This skill generates a comprehensive sprint health report covering:

- **Current Sprint Status** - Issues by status, completion percentage
- **Velocity Trends** - Story points completed vs. committed over sprints
- **Slip Rate** - Issues that rolled over from previous sprints
- **Blocked Items** - Issues with blockers requiring attention
- **Workload Distribution** - Work allocated per team member

**The core problem this solves:** Sprint health requires synthesizing data
across multiple queries and time periods. Without systematic reporting,
standup discussions lack data, blockers go unnoticed, and velocity trends
aren't tracked. This skill automates the data gathering and presents
actionable insights.

**Scope:** Single Jira project with active sprint. Scrum projects only
(Kanban uses different metrics).

---

## Phase 0: Project Validation

Verify the project exists and has an active sprint.

### Step 0.1: Search for Project

```
search_projects({query: "<PROJECT_KEY>"})
```

Extract project ID and verify it's a Software project (Scrum template).

### Step 0.2: Get Project Details

```
get_project({projectIdOrKey: "<PROJECT_KEY>"})
```

Confirm:
- Project type supports sprints (Software)
- Project is company-managed (team-managed has different APIs)

### Step 0.3: Check for Active Sprint

```
search_jql({
  jql: "project = <PROJECT_KEY> AND sprint in openSprints()",
  maxResults: 1
})
```

If no results, check for future sprints or confirm sprint exists in backlog.

### CHECKPOINT: Project Ready

**Success criteria:**
- Project exists and is accessible
- Project supports sprints
- At least one active sprint found

**If no active sprint:**
1. List recent closed sprints for historical report instead
2. Confirm with user which sprint to analyze
3. Check if project uses Kanban (different metrics apply)

---

## Phase 1: Sprint Data Collection

Gather comprehensive sprint data through JQL queries.

### Step 1.1: Get Current Sprint Issues

```
search_jql({
  jql: "project = <PROJECT_KEY> AND sprint in openSprints() ORDER BY status",
  maxResults: 100,
  fields: ["summary", "status", "assignee", "priority", "issuetype",
           "timeestimate", "timespent", "customfield_10016"]
})
```

**Note:** customfield_10016 is typically Story Points, but the field ID
varies by instance. Discover the correct field ID first if unknown.

See [reference/jql-patterns.md](./reference/jql-patterns.md) for additional
query patterns.

### Step 1.2: Get Previous Sprint Data (for comparison)

```
search_jql({
  jql: "project = <PROJECT_KEY> AND sprint in closedSprints()
        ORDER BY updated DESC",
  maxResults: 100
})
```

This helps identify:
- Issues that slipped from previous sprint
- Velocity baseline

### Step 1.3: Get Blocked Issues

```
search_jql({
  jql: "project = <PROJECT_KEY> AND sprint in openSprints()
        AND (status = 'Blocked' OR flagged = 'Impediment')",
  maxResults: 50
})
```

**Alternative patterns for blockers:**
- Check for "blocked" label
- Look for linked blocking issues
- Search for "blocker" in comments

### Step 1.4: Get Sprint Burndown Context

For each issue, get additional details if needed:

```
get_issue({
  issueIdOrKey: "<ISSUE_KEY>",
  expand: "changelog"
})
```

The changelog reveals when issues moved between statuses, useful for
identifying stalled items.

### Step 1.5: Get Project Analytics

```
get_project_analytics({
  projectIdOrKey: "<PROJECT_KEY>"
})
```

This may provide velocity and other aggregate metrics directly.

### CHECKPOINT: Data Collected

**Success criteria:**
- Current sprint issues retrieved
- Previous sprint data available for comparison
- Blocker query executed
- Analytics retrieved (if available)

**If analytics API returns limited data:**
1. Some project types have restricted analytics
2. Calculate metrics manually from JQL results
3. Note limitation in report

---

## Phase 2: Analysis

Calculate sprint health metrics from collected data.

### Step 2.1: Status Distribution

Categorize current sprint issues by status category:

| Category | Statuses | Count |
|----------|----------|-------|
| To Do | Open, Backlog, New | X |
| In Progress | In Progress, In Review, In QA | Y |
| Done | Done, Closed, Resolved | Z |

Calculate completion percentage: `Done / Total * 100`

### Step 2.2: Velocity Calculation

Sum story points by status:
- **Committed:** Total story points in sprint at start
- **Completed:** Story points in Done status
- **Remaining:** Story points not yet Done

Compare to previous sprints for trend analysis.

### Step 2.3: Slip Rate Analysis

Identify issues that were in a previous sprint and are now in current sprint:

```
search_jql({
  jql: "project = <PROJECT_KEY> AND sprint in openSprints()
        AND sprint in closedSprints()",
  maxResults: 50
})
```

Issues appearing in both open and closed sprints "slipped" - they weren't
completed in their original sprint.

Slip rate = `(Slipped issues / Total committed) * 100`

### Step 2.4: Workload Distribution

Group issues by assignee:

| Assignee | To Do | In Progress | Done | Total Points |
|----------|-------|-------------|------|--------------|
| User A   | 2     | 3           | 5    | 21           |
| User B   | 1     | 2           | 3    | 13           |

Flag imbalances:
- Unassigned issues
- Overloaded team members
- Idle capacity

### Step 2.5: Blocker Analysis

For each blocked issue:
- How long has it been blocked?
- Who is affected?
- What is the blocker?

Prioritize blockers by:
1. Impact (how many issues blocked)
2. Duration (longest blocked first)
3. Priority of blocked issue

### CHECKPOINT: Analysis Complete

**Success criteria:**
- Status distribution calculated
- Velocity metrics computed
- Slip rate determined
- Workload mapped
- Blockers prioritized

---

## Phase 3: Report Generation

Generate the sprint health report.

### Step 3.1: Generate Report Content

```
SPRINT HEALTH REPORT
====================
Project: <PROJECT_NAME> (<PROJECT_KEY>)
Sprint: <SPRINT_NAME>
Report Date: <DATE>
Sprint Dates: <START_DATE> - <END_DATE>

SPRINT SUMMARY
--------------
Total Issues: <COUNT>
Story Points Committed: <POINTS>
Story Points Completed: <POINTS>
Completion: <PERCENTAGE>%

STATUS DISTRIBUTION
-------------------
To Do:        ████████░░░░░░░░  <COUNT> (<PERCENTAGE>%)
In Progress:  ████████████░░░░  <COUNT> (<PERCENTAGE>%)
Done:         ████████████████  <COUNT> (<PERCENTAGE>%)

VELOCITY TREND
--------------
| Sprint | Committed | Completed | Completion % |
|--------|-----------|-----------|--------------|
| Current| <PTS>     | <PTS>     | <PCT>%       |
| Last   | <PTS>     | <PTS>     | <PCT>%       |
| 2 Ago  | <PTS>     | <PTS>     | <PCT>%       |

Average Velocity: <PTS> points/sprint

SLIP ANALYSIS
-------------
Slipped from previous sprint: <COUNT> issues (<PERCENTAGE>%)
- <ISSUE-1>: <SUMMARY>
- <ISSUE-2>: <SUMMARY>

BLOCKED ITEMS (Requires Immediate Attention)
--------------------------------------------
| Issue | Summary | Blocked Since | Assignee |
|-------|---------|---------------|----------|
| KEY-1 | <DESC>  | 3 days        | User A   |

WORKLOAD DISTRIBUTION
---------------------
| Team Member | Points | Issues | Status |
|-------------|--------|--------|--------|
| User A      | 21     | 10     | On track |
| User B      | 8      | 4      | Light load |
| Unassigned  | 5      | 2      | Needs attention |

RECOMMENDATIONS
---------------
1. [Recommendation based on data]
2. [Recommendation based on data]
```

### Step 3.2: Generate Recommendations

Based on analysis, provide actionable recommendations:

**If completion < 50% at sprint midpoint:**
- Review scope and consider descoping low-priority items
- Check if blockers are holding up progress

**If slip rate > 20%:**
- Investigate why issues aren't completing
- Consider smaller story breakdown
- Review estimation accuracy

**If blockers > 3:**
- Escalate for immediate resolution
- Schedule blocker-clearing session
- Consider pairing to unblock

**If workload imbalanced:**
- Redistribute unassigned work
- Balance across team members
- Address overallocation

### Step 3.3: Publish to Confluence (Optional)

If user requests Confluence publication:

```
search_spaces({query: "<SPACE_KEY>"})
```

```
create_page({
  spaceId: "<SPACE_ID>",
  title: "Sprint Health Report - <SPRINT_NAME> - <DATE>",
  body: "<REPORT_CONTENT_AS_XHTML>"
})
```

### CHECKPOINT: Report Complete

**Success criteria:**
- Report generated with all sections
- Recommendations are actionable
- Confluence page created (if requested)

---

## Anti-Patterns (DO NOT)

1. **DO NOT** assume customfield_10016 is Story Points. Field IDs vary
   by instance. Discover the correct field first.

2. **DO NOT** use `sprint in openSprints()` for Kanban projects. Kanban
   doesn't have sprints - use different metrics.

3. **DO NOT** calculate velocity without historical context. A single
   sprint's velocity is meaningless without trend data.

4. **DO NOT** report on sprints without verifying the project type first.
   Business projects don't have sprints.

5. **DO NOT** assume "Blocked" status exists. Some workflows use different
   names or flags. Check available statuses first.

6. **DO NOT** ignore unassigned work. It's a signal of planning gaps.

7. **DO NOT** publish to Confluence without user permission. Always confirm
   before creating external artifacts.

8. **DO NOT** report raw numbers without context. 5 blocked issues means
   different things for a 10-issue sprint vs. a 100-issue sprint.

---

## Tool Reference

| Tool | Purpose | Phase |
|------|---------|-------|
| `search_projects` | Find project | 0 |
| `get_project` | Get project details | 0 |
| `search_jql` | Query sprint issues | 1 |
| `get_issue` | Get issue details | 1 |
| `get_project_analytics` | Get velocity data | 1 |
| `generate_project_report` | Get summary stats | 1 |
| `search_spaces` | Find Confluence space | 3 |
| `create_page` | Publish report | 3 |

---

## Reference Files

- [jql-patterns.md](./reference/jql-patterns.md) - JQL query patterns for
  sprint analysis including status filtering, date ranges, and custom fields.
