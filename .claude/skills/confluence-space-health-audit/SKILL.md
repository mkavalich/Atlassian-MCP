---
name: confluence-space-health-audit
version: 1.0.0
description: >
  Audit a Confluence space for content health issues including stale pages,
  unlabeled content, permission anomalies, draft backlog, and orphaned pages.
  Use this skill when the user asks to "audit a space", "find stale pages",
  "check space health", "identify outdated content", "clean up Confluence",
  or any request involving content hygiene analysis for a Confluence space.
tags:
  - confluence
  - audit
  - content-health
  - space-cleanup
---

# Confluence Space Health Audit

## Purpose

This skill audits a Confluence space to identify content health issues that
accumulate over time:

- **Stale pages** - Not updated in 180+ days
- **Unlabeled pages** - Missing categorization for discoverability
- **Permission anomalies** - Pages with restrictions that differ from space baseline
- **Draft backlog** - Unpublished content that may be abandoned
- **Orphaned pages** - Pages with no parent (broken hierarchy)

**The core problem this solves:** Confluence spaces accumulate cruft over time.
Pages go stale, drafts pile up, and permission inconsistencies create confusion.
Without systematic auditing, spaces become content graveyards where finding
current information is impossible.

**Scope:** Single Confluence space per audit. Cloud only.

---

## Phase 0: Space Discovery

Validate the target space exists and retrieve its metadata.

### Step 0.1: Search for Space

```
search_spaces({query: "<SPACE_KEY_OR_NAME>"})
```

Extract the numeric `spaceId` from results. The spaceId is required for
subsequent API calls - the space key alone is insufficient.

### Step 0.2: Get Space Details

```
get_space({spaceId: "<SPACE_ID>"})
```

Record:
- Space name and key
- Space type (global, personal)
- Homepage ID (for orphan detection)
- Creation date (for age context)

### Step 0.3: Get Space Permissions (Baseline)

```
get_space_permissions({spaceId: "<SPACE_ID>"})
```

Record the baseline permission structure. This becomes the reference point
for detecting page-level permission anomalies in Phase 2.

### CHECKPOINT: Space Discovery

**Success criteria:**
- Space exists and spaceId is retrieved
- Space permissions baseline is recorded

**If space not found:**
1. Verify the space key/name with the user
2. Check if the user has view permissions on the space
3. List available spaces with `search_spaces({})` to help identify correct target

---

## Phase 1: Content Inventory

Retrieve all pages in the space with their metadata.

### Step 1.1: Get All Pages

```
get_space_content({
  spaceId: "<SPACE_ID>",
  contentType: "page",
  limit: 250
})
```

Handle pagination if the space has more than 250 pages. Continue fetching
until all pages are retrieved.

### Step 1.2: Get Page Metadata

For each page, retrieve detailed metadata:

```
get_page({
  pageId: "<PAGE_ID>",
  includeVersion: true,
  includeLabels: true
})
```

Extract and record for each page:
- Page ID and title
- Parent page ID (null = potential orphan)
- Version number and last modified date
- Labels (empty array = unlabeled)
- Status (current, draft, archived)

### Step 1.3: Get Page Version History (for staleness)

For pages where detailed update context is needed:

```
get_page_versions({
  pageId: "<PAGE_ID>",
  limit: 1
})
```

This confirms the last update timestamp and author.

### CHECKPOINT: Content Inventory

**Success criteria:**
- All pages retrieved (verify count matches space stats)
- Metadata captured for each page

**If pagination fails:**
1. Note the last successful page ID
2. Resume from that point with offset
3. If repeated failures, flag potential permission issue on specific pages

---

## Phase 2: Health Analysis

Categorize pages by health issue type.

### Step 2.1: Identify Stale Pages

Compare each page's last modified date against the staleness threshold:
- **Default threshold:** 180 days (6 months)
- **User can customize** threshold if specified

Categorize staleness severity:
- **Warning (180-365 days):** May need review
- **Critical (365+ days):** Likely outdated

### Step 2.2: Identify Unlabeled Pages

Pages with empty labels array are unlabeled. These are harder to discover
through label-based navigation and search.

Note: Some pages (like auto-generated index pages) may intentionally have
no labels. Flag but don't mark as critical.

### Step 2.3: Identify Permission Anomalies

For each page, check if it has non-inherited restrictions:

```
get_page_restrictions({pageId: "<PAGE_ID>"})
```

Compare against the space baseline from Phase 0:
- **Expected:** Page inherits space permissions
- **Anomaly:** Page has explicit restrictions (more or less permissive)

Permission anomalies aren't necessarily problems, but they indicate
intentional deviations that should be documented and reviewed.

### Step 2.4: Identify Draft Content

Check content states for unpublished drafts:

```
get_content_states({spaceId: "<SPACE_ID>"})
```

Drafts older than 30 days are likely abandoned. Flag for review.

### Step 2.5: Identify Orphaned Pages

Pages with no parent ID that are not the space homepage are orphans.
They exist in the space but are unreachable through normal navigation.

Cross-reference parent IDs against the page inventory to detect:
- Pages pointing to deleted parents
- Pages with null parent that aren't the homepage

### CHECKPOINT: Health Analysis

**Success criteria:**
- All pages categorized by issue type
- Counts tallied for each category

**If permission checks fail on specific pages:**
1. Note the page IDs that failed
2. These are likely pages the current user cannot access
3. Include in report as "access restricted - cannot audit"

---

## Phase 3: Report Generation

Synthesize findings into an actionable report.

### Step 3.1: Generate Summary Statistics

```
SPACE HEALTH AUDIT REPORT
=========================
Space: <SPACE_NAME> (<SPACE_KEY>)
Audit Date: <DATE>
Total Pages: <COUNT>

HEALTH SUMMARY
--------------
Stale Pages (180+ days):     <COUNT> (<PERCENTAGE>%)
Unlabeled Pages:             <COUNT> (<PERCENTAGE>%)
Permission Anomalies:        <COUNT>
Draft Backlog:               <COUNT>
Orphaned Pages:              <COUNT>
```

### Step 3.2: Generate Issue Details

For each category, list affected pages with actionable context:

```
STALE PAGES (180+ days)
-----------------------
| Page Title | Last Updated | Days Stale | Author |
|------------|--------------|------------|--------|
| <TITLE>    | <DATE>       | <DAYS>     | <USER> |

Recommended actions:
- Review and update if still relevant
- Archive if obsolete
- Delete if no longer needed
```

### Step 3.3: Generate Remediation Suggestions

Based on findings, suggest specific actions:

**For high staleness:**
- Schedule content review sprint
- Assign page owners for accountability
- Consider archiving pages older than 2 years

**For unlabeled pages:**
- Create standard label taxonomy
- Bulk-label pages by section/topic
- Add labels to page templates

**For permission anomalies:**
- Document why each page has custom restrictions
- Consolidate where possible
- Consider space permission restructure if many anomalies

**For drafts:**
- Contact draft authors for status
- Publish or discard abandoned drafts
- Set draft expiration policy

**For orphans:**
- Re-parent to appropriate section
- Create index page if multiple related orphans
- Delete if truly abandoned

### CHECKPOINT: Report Complete

**Success criteria:**
- Summary statistics calculated
- All issue categories populated
- Remediation suggestions provided

**Deliver report to user** in the requested format (text, Confluence page, etc.)

---

## Anti-Patterns (DO NOT)

1. **DO NOT** use space key where spaceId is required. The `get_space` and
   other detail endpoints require numeric spaceId, not the text key.

2. **DO NOT** assume empty results mean no pages. Check for pagination
   tokens and permission errors.

3. **DO NOT** mark all permission anomalies as problems. Some restrictions
   are intentional (HR docs, security policies).

4. **DO NOT** skip the baseline permission check. Without it, you cannot
   identify what constitutes an "anomaly."

5. **DO NOT** recommend bulk deletion without user confirmation. Stale
   content may still be referenced or needed.

6. **DO NOT** attempt to fix issues automatically. This skill is audit-only.
   Remediation should be a separate, user-approved action.

7. **DO NOT** audit multiple spaces in one run. Each space is a separate
   audit with its own baseline and context.

---

## Tool Reference

| Tool | Purpose | Phase |
|------|---------|-------|
| `search_spaces` | Find space by key/name | 0 |
| `get_space` | Get space metadata | 0 |
| `get_space_permissions` | Get permission baseline | 0 |
| `get_space_content` | List all pages | 1 |
| `get_page` | Get page metadata | 1 |
| `get_page_versions` | Get version history | 1 |
| `get_labels` | Get page labels | 1, 2 |
| `get_page_restrictions` | Check page permissions | 2 |
| `get_content_states` | Check draft status | 2 |
