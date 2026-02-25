# Project Setup Failure Analysis: Phoenix Platform Case Study

## Executive Summary

**Verdict: 70% Admin Failure, 30% Spec Gap**

A Jira Cloud SDLC project setup failed at 60% completion due to missing foundational
configuration (issue type schemes and workflow schemes). The admin executed spec steps
sequentially without validating the dependency chain, creating orphaned objects.

This case study is the reason the atlassian-project-setup skill exists. Every phase
and checkpoint maps directly to a failure that occurred here.

---

## What Happened

### The Spec

A user requested a complete SDLC project in a Jira sandbox:
- Scrum project with custom workflow (7 statuses with gates)
- Custom fields (Story Points, Environment, Deployment Date, etc.)
- Issue types: Epic, Story, Bug, Spike, Tech Debt
- Workflow scheme and screen scheme "tying it all together"
- Realistic backlog of 10-15 issues
- Automation rules
- Full Confluence documentation space

### The Execution

**Phase 1: Partial Success**
- Project created ✅
- Custom fields created ✅
- Workflow creation failed initially (API bug — separate issue)

**Phase 2: Workflow Created**
- Workflow created with 7 statuses, 6 transitions ✅
- Admin marked as "PASS" and moved on
- **No workflow scheme created** ❌
- **No scheme assigned to project** ❌

**Phase 3: Total Blocker — Issue Creation**
- `create_issue()` → "Specify a valid issue type"
- Tested on multiple projects — ALL failed identically
- Root cause: No issue type scheme assigned to any project

### The Three Red Flags Ignored

#### Red Flag #1: Workflow Without a Scheme

The admin created a workflow but never:
- Created a workflow scheme
- Mapped the workflow to issue types
- Assigned the scheme to the project

A workflow without a scheme is an orphaned object. It exists in the instance but
no project uses it.

#### Red Flag #2: No Issue Type Scheme

The admin assumed that because issue types existed globally, any project could use
them. This is wrong. Projects use issue types through Issue Type Schemes, and the
scheme must be explicitly assigned.

#### Red Flag #3: Random ID Variations

When issue creation failed, instead of analyzing the dependency chain, the admin
tried different issue type IDs repeatedly — cargo cult administration.

---

## Root Cause Analysis

### The Dependency Chain (What Was Needed)

```
Phase 0: Verify spec, fill gaps, get confirmation
Phase 1: Pre-flight → smoke test → scheme audit
Phase 2: Issue types → scheme → assign to project → VERIFY
Phase 3: Workflow → scheme → assign to project → VERIFY
Phase 4: Fields → screens → screen schemes → ITSS → assign → VERIFY
Phase 5: Create issues → set states → VERIFY
Phase 6: Automation rules → VERIFY
Phase 7: Confluence space → pages → VERIFY
```

### What Was Actually Executed

```
Step 1: Create project → ✅
Step 2: Create fields → ✅ (but orphaned — no screens)
Step 3: Create workflow → ✅ (but orphaned — no scheme)
Step 4: Create issues → ❌ (no issue type scheme)
         ↳ Try different IDs → ❌
         ↳ Try different IDs → ❌
         ↳ Give up
```

### The Correct Diagnosis

When an admin encounters "Specify a valid issue type":

**A competent admin thinks:**
> "Issue types are valid globally, but projects use issue type SCHEMES to control
> which types are available. If I can't create any issue types in this project,
> the scheme is probably missing or empty."

**The failing admin thought:**
> "Let me try a different issue type ID... and another... and another..."

---

## Lessons Encoded in the Skill

| Failure | Skill Prevention |
|---------|------------------|
| No spec gap analysis | Phase 0 is MANDATORY |
| No pre-flight validation | Phase 1 smoke test |
| Orphaned workflow (no scheme) | Phase 3 requires scheme + assignment |
| No incremental testing | Checkpoints after every phase |
| Random ID guessing | Dependency tree for structured debugging |
| Missing issue type scheme | Phase 2 handles scheme creation + verification |
| Proceeding past failures | STOP instructions at every checkpoint |
| No rollback plan | Phase 1 baseline recording |

---

## The 70/30 Split

### 70% Admin Failure
A Jira admin should know:
- Workflows need schemes
- Projects need issue type schemes
- You validate foundations before building features

### 30% Spec Gap
The spec should have:
- Explicit scheme creation and assignment steps
- Verification checkpoints
- Dependency ordering
- Rollback procedures

This is exactly why the skill performs spec gap analysis in Phase 0 — to catch
the 30% before execution begins.
