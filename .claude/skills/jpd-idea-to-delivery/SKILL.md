---
name: jpd-idea-to-delivery
version: 1.0.0
description: >
  Translate an approved JPD idea into a Jira Epic with full traceability,
  Confluence specification page, and bidirectional linking. Enforces the
  roadmap-to-delivery connection. Use this skill when the user asks to
  "create epic from idea", "move idea to delivery", "translate idea to epic",
  "link JPD to Jira", "start implementation from idea", or any request
  involving converting a product discovery idea into trackable delivery work.
tags:
  - jira-product-discovery
  - jira
  - confluence
  - idea-to-epic
  - traceability
---

# JPD Idea to Delivery

## Purpose

This skill translates an approved Jira Product Discovery (JPD) idea into
implementation-ready artifacts:

1. **Jira Epic** - With context from idea scoring and evidence
2. **Confluence Spec Page** - Synthesizing idea details and insights
3. **Bidirectional Links** - Epic references idea, idea references Epic

**The core problem this solves:** Product ideas get approved but lose context
when handed to delivery teams. Scoring rationale, customer evidence, and
strategic context don't make it into Epics. This skill creates a complete
handoff package with full traceability back to the discovery process.

**Scope:** Single idea to single Epic. Creates one Confluence spec page.

---

## Phase 0: Idea Analysis

Gather complete context about the idea before creating delivery artifacts.

### Step 0.1: Get Idea Details

```
get_idea({ideaId: "<IDEA_ID>"})
```

Extract:
- Idea summary and description
- Current status
- Labels (preserve for Epic)
- Creator and key stakeholders
- Custom fields (if any)

**Note:** `ideaId` can be key format (JPD-123) or numeric ID. Both work.

### Step 0.2: Get Prioritization Scores

```
get_idea_scoring({ideaId: "<IDEA_ID>"})
```

Capture:
- Overall priority score
- Individual dimension scores (Impact, Effort, Confidence, etc.)
- Scoring model used

This context becomes part of the Epic description - delivery teams need
to understand WHY this idea was prioritized.

### Step 0.3: Get Supporting Evidence

```
get_insights({ideaId: "<IDEA_ID>"})
```

Count and categorize insights:
- Customer feedback
- Support tickets
- Research findings
- Internal requests

### Step 0.4: Analyze Insight Themes

```
analyze_idea_insights({ideaId: "<IDEA_ID>"})
```

Generate thematic summary of what the evidence says. This becomes the
"Voice of Customer" section in the spec.

### CHECKPOINT: Idea Context Complete

**Success criteria:**
- Idea details captured
- Scoring data retrieved (or noted as not configured)
- Evidence counted and themes identified

**If scoring is empty:**
1. Note that prioritization was done without formal scoring
2. Include any available qualitative rationale
3. Don't block Epic creation - proceed without scores

**If no insights:**
1. Note that idea lacks documented evidence
2. Flag in spec as "evidence gathering recommended"
3. Proceed but highlight the gap

---

## Phase 1: Target Validation

Verify the delivery targets exist and are accessible.

### Step 1.1: Validate Jira Project

```
search_projects({query: "<TARGET_PROJECT_KEY>"})
```

Confirm the target project exists and user has create permissions.

### Step 1.2: Verify Epic Issue Type

```
get_issue_types()
```

Find the Epic issue type and its ID. Epic may be named:
- "Epic"
- "Feature"
- Custom name in some organizations

```
get_issue_createmeta_issuetypes({
  projectIdOrKey: "<PROJECT_KEY>"
})
```

This confirms Epic is available in the target project.

### Step 1.3: Validate Confluence Space

```
search_spaces({query: "<SPACE_KEY>"})
```

Find the target space for the specification page. Extract numeric `spaceId`.

### CHECKPOINT: Targets Validated

**Success criteria:**
- Jira project accessible with create permissions
- Epic issue type available in project
- Confluence space accessible

**If Epic type not found:**
1. List available issue types for user to choose
2. "Feature" is often an alias for Epic
3. Confirm with user before using alternative

**If Confluence space not found:**
1. Offer to create spec in alternative location
2. Or skip Confluence page creation
3. Don't block Epic creation

---

## Phase 2: Epic Creation

Create the Jira Epic with full context from the idea.

### Step 2.1: Prepare Epic Description

Synthesize idea context into Epic description. See
[reference/epic-description-template.md](./reference/epic-description-template.md)
for the template structure.

Key sections:
- **Overview** - Idea summary
- **Prioritization Context** - Scores and rationale
- **Evidence Summary** - Insight count and themes
- **Links** - Reference to JPD idea
- **Success Criteria** - Derived from idea goals

### Step 2.2: Create Epic

```
create_issue({
  projectKey: "<PROJECT_KEY>",
  summary: "<IDEA_SUMMARY>",
  issueType: "Epic",
  description: "<PREPARED_DESCRIPTION>",
  labels: ["from-jpd", "<IDEA_KEY>", ...original_labels]
})
```

Preserve idea labels and add traceability labels.

### Step 2.3: Record Epic Key

Capture the created Epic key (e.g., PROJ-123) for linking in subsequent steps.

### CHECKPOINT: Epic Created

**Success criteria:**
- Epic created successfully
- Epic key captured
- Labels applied including traceability

**If creation fails:**
1. Check required fields with `get_issue_createmeta_fields`
2. Some projects require additional fields (team, component, etc.)
3. Add required fields and retry

---

## Phase 3: Specification Page

Create Confluence specification page with full idea context.

### Step 3.1: Prepare Page Content

Structure the spec page:
1. **Header** - Idea title, Epic link, status
2. **Problem Statement** - From idea description
3. **Customer Evidence** - Insight summaries and themes
4. **Prioritization Rationale** - Scoring breakdown
5. **Scope** - What's included/excluded
6. **Success Metrics** - How to measure success
7. **Open Questions** - Unresolved items for delivery team

### Step 3.2: Create Confluence Page

```
create_page({
  spaceId: "<SPACE_ID>",
  title: "<IDEA_SUMMARY> - Specification",
  body: "<SPEC_PAGE_CONTENT>"
})
```

**Note:** `spaceId` must be numeric, not the space key.

### Step 3.3: Add Labels to Page

```
add_labels({
  contentId: "<PAGE_ID>",
  labels: ["product-spec", "from-jpd", "<EPIC_KEY>"]
})
```

### CHECKPOINT: Spec Page Created

**Success criteria:**
- Confluence page created
- Content includes all context sections
- Labels applied for discoverability

**If page creation fails:**
1. Check XHTML body format is valid
2. Verify spaceId is numeric
3. Ensure title is unique in space

---

## Phase 4: Bidirectional Linking

Create traceability links between all artifacts.

### Step 4.1: Link Epic to Confluence Page

Update Epic with Confluence page link:

```
update_issue({
  issueIdOrKey: "<EPIC_KEY>",
  description: "<DESCRIPTION_WITH_CONFLUENCE_LINK>"
})
```

Or add as a comment:

```
add_comment({
  issueIdOrKey: "<EPIC_KEY>",
  body: "Specification: [<PAGE_TITLE>|<CONFLUENCE_URL>]"
})
```

### Step 4.2: Update JPD Idea Status

Update the idea to reflect delivery status:

```
update_idea({
  ideaId: "<IDEA_ID>",
  status: "Delivery"
})
```

**Critical:** If updating labels, you must include ALL existing labels
plus new ones. The update REPLACES labels, not appends.

```
get_idea({ideaId: "<IDEA_ID>"})  # Get current labels first
update_idea({
  ideaId: "<IDEA_ID>",
  labels: [...existing_labels, "has-epic", "<EPIC_KEY>"]
})
```

### Step 4.3: Add Epic Reference to Idea

Add the Epic key as a label or in a comment/description update so the
idea links back to its delivery artifact.

### CHECKPOINT: Links Established

**Success criteria:**
- Epic links to Confluence spec
- Idea updated with delivery status
- Idea references Epic key

**If idea update fails:**
1. Check current idea status (some statuses may be locked)
2. Verify label format is valid
3. Note failure but don't roll back Epic/page

---

## Phase 5: Verification

Confirm all artifacts exist and are linked.

### Step 5.1: Verify Epic

```
get_issue({issueIdOrKey: "<EPIC_KEY>"})
```

Confirm:
- Epic exists with correct content
- Labels include traceability tags
- Description/comments reference Confluence

### Step 5.2: Verify Confluence Page

```
get_page({pageId: "<PAGE_ID>"})
```

Confirm:
- Page exists with correct content
- Labels applied

### Step 5.3: Verify Idea Update

```
get_idea({ideaId: "<IDEA_ID>"})
```

Confirm:
- Status updated
- Labels include Epic reference

### CHECKPOINT: Verification Complete

**Success criteria:**
- All three artifacts exist
- Bidirectional links verified
- Traceability chain complete

---

## Completion Report

```
IDEA TO DELIVERY COMPLETE
=========================
Source Idea: <IDEA_KEY> - <IDEA_SUMMARY>
Created: <DATE>

ARTIFACTS CREATED
-----------------
Jira Epic: <EPIC_KEY>
  URL: <JIRA_URL>

Confluence Spec: <PAGE_TITLE>
  URL: <CONFLUENCE_URL>

TRACEABILITY
------------
JPD Idea → Jira Epic: ✓
Jira Epic → Confluence Spec: ✓
JPD Idea Status: Updated to "Delivery"

CONTEXT TRANSFERRED
-------------------
Prioritization Score: <SCORE>
Evidence Pieces: <COUNT> insights
Themes: <THEME_SUMMARY>

NEXT STEPS
----------
1. Review spec page with delivery team
2. Break Epic into Stories/Tasks
3. Update idea status as delivery progresses
```

---

## Anti-Patterns (DO NOT)

1. **DO NOT** create Epic without scoring context. The prioritization rationale
   is critical context for delivery teams.

2. **DO NOT** update idea labels without fetching existing labels first.
   `update_idea` REPLACES labels, losing existing tags.

3. **DO NOT** use space key where spaceId is required. `create_page` needs
   numeric spaceId from `search_spaces`.

4. **DO NOT** skip the Confluence page. Without a spec, delivery teams lose
   the evidence and rationale that justified the idea.

5. **DO NOT** proceed if Epic creation fails. The Epic is the primary delivery
   artifact - Confluence page without Epic is orphaned.

6. **DO NOT** hardcode "Epic" issue type. Discover the correct type name
   and ID for the target project.

7. **DO NOT** create duplicate specs. Search for existing spec pages first
   if re-running this workflow.

8. **DO NOT** lose insight themes. The synthesized evidence is often more
   valuable than raw insight counts.

---

## Tool Reference

| Tool | Purpose | Phase |
|------|---------|-------|
| `get_idea` | Get idea details | 0, 4, 5 |
| `get_idea_scoring` | Get prioritization scores | 0 |
| `get_insights` | Count evidence | 0 |
| `analyze_idea_insights` | Summarize themes | 0 |
| `search_projects` | Validate target project | 1 |
| `get_issue_types` | Find Epic type | 1 |
| `get_issue_createmeta_issuetypes` | Validate Epic in project | 1 |
| `create_issue` | Create Epic | 2 |
| `update_issue` | Add links to Epic | 4 |
| `add_comment` | Add spec reference | 4 |
| `get_issue` | Verify Epic | 5 |
| `search_spaces` | Find Confluence space | 1 |
| `create_page` | Create spec page | 3 |
| `add_labels` | Tag spec page | 3 |
| `get_page` | Verify page | 5 |
| `update_idea` | Update idea status | 4 |

---

## Reference Files

- [epic-description-template.md](./reference/epic-description-template.md) -
  Template for Epic descriptions that preserve JPD context.
