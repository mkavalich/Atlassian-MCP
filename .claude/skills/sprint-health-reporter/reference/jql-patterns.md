# JQL Patterns for Sprint Analysis

This reference provides JQL query patterns for sprint health reporting.

## Sprint Selection Functions

### Active Sprint
```jql
sprint in openSprints()
```
Returns issues in any sprint currently active (started but not completed).

### Closed Sprints
```jql
sprint in closedSprints()
```
Returns issues that were in any completed sprint.

### Future Sprints
```jql
sprint in futureSprints()
```
Returns issues planned for sprints not yet started.

### Specific Sprint by Name
```jql
sprint = "Sprint 42"
```
Returns issues in a named sprint (exact match required).

### Sprints by Board
```jql
sprint in openSprints() AND "Board[Dropdown]" = "Team A Board"
```
Filter by specific board when multiple teams share a project.

---

## Status Patterns

### By Status Category
```jql
statusCategory = "To Do"
statusCategory = "In Progress"
statusCategory = "Done"
```
Status categories are reliable across different workflow configurations.

### Blocked Issues (various patterns)

**By status name:**
```jql
status = "Blocked"
```

**By flag (impediment):**
```jql
flagged = "Impediment"
```

**By label:**
```jql
labels = "blocked"
```

**Combined:**
```jql
(status = "Blocked" OR flagged = "Impediment" OR labels = "blocked")
```

### Stalled Issues
```jql
status = "In Progress" AND updated < -7d
```
Issues in progress but not updated in 7 days.

---

## Time-Based Patterns

### Issues Updated Recently
```jql
updated >= -1d      # Last 24 hours
updated >= -7d      # Last week
updated >= startOfWeek()
updated >= startOfMonth()
```

### Issues Not Updated
```jql
updated < -7d       # Not updated in 7 days
updated < -30d      # Stale (30+ days)
```

### Created During Sprint
```jql
sprint in openSprints() AND created >= -14d
```
Approximation for issues added after sprint start.

### Due Date Analysis
```jql
duedate < now() AND statusCategory != Done   # Overdue
duedate >= now() AND duedate <= 3d          # Due within 3 days
duedate is EMPTY AND sprint in openSprints() # No due date set
```

---

## Workload Patterns

### By Assignee
```jql
sprint in openSprints() AND assignee = "user@example.com"
sprint in openSprints() AND assignee = currentUser()
```

### Unassigned Work
```jql
sprint in openSprints() AND assignee is EMPTY
```

### Overdue by Assignee
```jql
sprint in openSprints() AND assignee = "user@example.com"
AND duedate < now() AND statusCategory != Done
```

---

## Slip Detection Patterns

### Issues in Both Open and Closed Sprints
```jql
sprint in openSprints() AND sprint in closedSprints()
```
These issues "slipped" - they were in a previous sprint but not completed.

**Note:** This works because Jira preserves sprint history. An issue moved
from Sprint 1 to Sprint 2 appears in both sprint histories.

### Multi-Sprint Issues
```jql
project = KEY AND "Sprint[Number]" > 1
```
Custom field tracking sprint count (if configured).

---

## Story Point Patterns

**Important:** Story Points field ID varies by instance. Common patterns:

```jql
"Story Points" > 0              # Has estimate
"Story Points" is EMPTY         # No estimate
"Story Points" >= 5             # Large stories
cf[10016] > 0                   # By field ID (10016 is common)
```

### Discover Story Points Field
1. Create a test issue with story points
2. Use `get_issue` with `expand: names`
3. Look for field with "Story Points" or "storypoint" in name
4. Note the `customfield_XXXXX` identifier

---

## Priority Patterns

```jql
sprint in openSprints() AND priority = Highest
sprint in openSprints() AND priority in (Highest, High)
sprint in openSprints() AND priority = Blocker   # If using Blocker priority
```

---

## Issue Type Patterns

```jql
sprint in openSprints() AND issuetype = Bug
sprint in openSprints() AND issuetype in (Bug, "Tech Debt")
sprint in openSprints() AND issuetype = Story
sprint in openSprints() AND issuetype != Sub-task  # Exclude subtasks
```

---

## Combined Analysis Queries

### Sprint Completion Analysis
```jql
project = KEY AND sprint in openSprints()
ORDER BY statusCategory ASC, priority DESC
```
Groups by status category with highest priority first.

### At-Risk Items
```jql
project = KEY AND sprint in openSprints()
AND statusCategory != Done
AND (
  updated < -3d
  OR flagged = "Impediment"
  OR duedate < now()
)
ORDER BY priority DESC
```

### Velocity-Relevant Issues
```jql
project = KEY AND sprint = "Sprint 42"
AND issuetype in standardIssueTypes()
AND statusCategory = Done
```
Excludes subtasks for accurate velocity counting.

### Carryover Candidates
```jql
project = KEY AND sprint in openSprints()
AND statusCategory = "To Do"
AND created < -7d
```
Issues planned but not started - candidates for carryover if sprint runs short.

---

## Output Optimization

### Minimal Fields (Performance)
```
fields: ["key", "summary", "status", "assignee", "priority"]
```

### Full Analysis Fields
```
fields: ["key", "summary", "status", "statusCategory", "assignee",
         "priority", "issuetype", "created", "updated", "duedate",
         "timeestimate", "timespent", "customfield_10016"]
```

### With Changelog (Status History)
```
expand: "changelog"
```
Returns full history of field changes including status transitions.

---

## Pagination

Default max is 50 results. For large sprints:

```json
{
  "jql": "project = KEY AND sprint in openSprints()",
  "maxResults": 100,
  "startAt": 0
}
```

Continue pagination:
```json
{
  "startAt": 100,
  "maxResults": 100
}
```

Check `total` in response to know when to stop.

---

## Common Gotchas

1. **Sprint names with spaces** - Quote them: `sprint = "Sprint Name"`

2. **Special characters** - Escape with backslash: `summary ~ "C\+\+"`

3. **Empty vs null** - Use `is EMPTY` not `= null`

4. **Case sensitivity** - Field names are case-sensitive in some contexts

5. **Reserved words** - Quote if needed: `project = "ORDER"`

6. **Date formats** - Use functions like `startOfWeek()` or relative (`-7d`)

7. **Performance** - Avoid `text ~ "*"` wildcards at start of terms
