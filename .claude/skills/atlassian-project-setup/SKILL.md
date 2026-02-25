---
name: atlassian-project-setup
version: 2.0.0
description: >
  Dependency-aware Jira Cloud project provisioning with spec gap analysis,
  incremental verification, and JSM extension support. Use this skill whenever
  the user asks to set up a Jira project (Software, Business, or Service Desk),
  configure workflows, create issue types, assign schemes, build Confluence
  documentation spaces, or any combination of Jira Cloud infrastructure
  provisioning. Also trigger when the user mentions "project setup", "workflow
  scheme", "issue type scheme", "screen scheme", "field configuration",
  "Confluence space", "service desk setup", "request types", "SLA configuration",
  "JSM project", or any request that involves creating or configuring Jira Cloud
  infrastructure from a specification. This skill prevents the #1 failure mode:
  executing setup steps without validating the dependency chain first.
tags:
  - jira-cloud
  - confluence
  - jsm
  - project-setup
  - workflow-scheme
  - issue-type-scheme
---

# Atlassian Cloud Project Setup Guide

## Purpose

This skill ensures Jira Cloud and Confluence project setups complete at 100% by
enforcing dependency-aware execution. It works for **any company-managed project
type**: Jira Software (Scrum/Kanban), Jira Service Management, and Business projects.

**The core problem this solves:** Jira Cloud objects exist in a strict dependency
hierarchy. Creating a workflow without a workflow scheme, or creating issues without
an issue type scheme assigned to the project, produces orphaned objects that appear
to succeed but don't function. This skill forces pre-flight validation, spec gap
analysis, and incremental smoke testing at every phase.

**Scope:** Atlassian Cloud only. Company-managed projects only. Team-managed projects
use simplified configuration and don't require this level of orchestration.

Read [reference/dependency-tree.md](./reference/dependency-tree.md) before starting
any project setup — it maps every Jira Cloud object relationship and its API availability.

---

## Phase 0: Spec Analysis (MANDATORY — Before Touching Jira)

Before executing ANY tool calls, analyze the user's specification against the
dependency tree.

### Step 0.1: Detect Project Type

Determine what kind of project is being provisioned:

| Project Type | Template Key Contains | Enables |
|-------------|----------------------|---------|
| Jira Software (Scrum) | `software` | Boards, sprints, backlog |
| Jira Software (Kanban) | `software` | Boards, WIP limits |
| Jira Service Management | "service_desk" | Request types, SLAs, queues, portal |
| Business | `business` | Basic task tracking |

The project type determines which phases are required:
- **All types**: Phases 0–7 (core Jira + Confluence)
- **JSM only**: Phase 3A (Request Types, SLAs, Queues, Portal)
- **Software only**: Phase 5A (Board Configuration)

### Step 0.2: Parse Spec Into Capability Requirements

Read the entire spec and classify each line item:

| Capability | Spec Mentions? | Dependencies Required |
|------------|---------------|----------------------|
| Create Issues | | Issue Type Scheme → Project |
| Custom Workflows | | Workflow → Workflow Scheme → Project |
| Custom Fields on Screens | | Field → Context → Screen → Screen Scheme → ITSS → Project |
| Field Behavior (required/hidden) | | Field Config → FC Scheme → Project |
| Request Types (JSM) | | Issue Types + Request Type → Portal Group |
| SLA Configuration (JSM) | | Request Types + Priorities + Calendar |
| Queue Configuration (JSM) | | JQL filter + Columns + Assignment |
| Customer Portal (JSM) | | Service Desk project + Request Types |
| Board Configuration (Software) | | Filter + Workflow status categories |
| Confluence Documentation | | Space → Pages (hierarchical) |
| Automation Rules | | Working issue creation (all above) |
| Backlog Population | | Working issue creation + workflow verification |

### Step 0.3: Identify Spec Gaps

For EACH capability the spec requires, check every link in the dependency chain.

**Almost always missing from user specs:**
- Issue type scheme creation/assignment (users assume projects "just have" issue types)
- Workflow scheme creation and assignment (users say "create workflow" not "create workflow scheme")
- Screen scheme and Issue Type Screen Scheme (ITSS) wiring
- Field configuration scheme assignment
- For JSM: request type → issue type mapping, SLA calendar prerequisites
- Pre-flight validation and smoke testing steps
- Rollback procedures

**Generate a gap report:**

```
SPEC GAP ANALYSIS
=================
Your spec requests these capabilities:
  ✅ [Capability] — Fully specified
  ⚠️ [Capability] — Partially specified (missing: [dependency])
  ❌ [Capability] — Not addressed but required by [other capability]

MISSING PREREQUISITES:
  1. [What's missing] — Required before [spec step X]
  2. [What's missing] — Required before [spec step Y]

ASSUMPTIONS (confirm or correct):
  1. [Assumption]
  2. [Assumption]

BLOCKING QUESTIONS:
  1. [Question]
```

### Step 0.4: Get User Confirmation

Present the gap report. **DO NOT PROCEED** until the user confirms or corrects
each assumption and answers blocking questions.

---

## Phase 1: Pre-Flight Validation (MANDATORY)

Before creating ANY new objects, validate the current state.

### Step 1.1: Project Discovery

```
search_projects({query: "<PROJECT_KEY>"})
```

If project doesn't exist: project creation is first. If it exists: validate.

### Step 1.2: Platform Guardrails Check

Before creating objects, check instance limits:

```
get_system_limits()
```

**Known Jira Cloud limits (verify against response):**
- Custom fields: ~500 per instance (varies by plan)
- Automation rules: varies by plan (Free: 100/month, Standard: 500, Premium: 1000, Enterprise: unlimited)
- Workflows: no hard limit but complexity degrades performance
- Projects: no hard limit

If the spec would push any limit over 80% capacity, **flag this to the user** before
proceeding.

### Step 1.3: Issue Creation Smoke Test

The single most important validation. If you cannot create a test issue in the
target project, STOP and fix the foundation.

```
create_issue({
  projectKey: "<KEY>",
  summary: "Pre-flight validation — safe to delete",
  issueType: "Task"
})
```

- **Succeeds:** Clean up test issue. Basic creation works.
- **Fails with "Specify a valid issue type":** Issue type scheme missing or empty.
  Jump to Phase 2 remediation.
- **Fails with other error:** Investigate and document before proceeding.

### Step 1.4: Scheme Audit

Discover current scheme assignments:

```
get_issue_type_schemes()
  → get_issue_type_scheme_mappings()
    → Does the target project appear?

get_workflow_schemes_detailed()
  → Does any scheme reference the target project?

get_screen_schemes()
  → Note available screen schemes

get_field_configurations()
  → Note available field configurations

get_permission_schemes()
  → Note current permission scheme

get_notification_schemes()
  → Note current notification scheme
```

Record this as your baseline and rollback reference.

### Step 1.5: Generate Execution Plan

Based on spec (with gaps filled) and audit results, generate a numbered plan:

```
EXECUTION PLAN
==============
Phase 2: Foundation (Issue Types + Schemes)
  Step 2.1: [Action]
  ✓ CHECKPOINT: Issue creation works with all required types

Phase 3: Workflows + Schemes
  Step 3.1: [Action]
  ✓ CHECKPOINT: Transitions work on test issue

Phase 3A: JSM Extension (if service_desk) ← CONDITIONAL
  Step 3A.1: [Action]
  ✓ CHECKPOINT: Request types visible in portal

Phase 4: Fields + Screens
  Step 4.1: [Action]
  ✓ CHECKPOINT: Custom fields appear on create/edit screens

Phase 5: Populate Data
  Step 5.1: [Action]
  ✓ CHECKPOINT: Issues have correct fields and workflow

Phase 5A: Board Configuration (if software) ← CONDITIONAL
  Step 5A.1: [Action]
  ✓ CHECKPOINT: Board shows correct columns

Phase 6: Automation
  Step 6.1: [Action]
  ✓ CHECKPOINT: Automation triggers correctly

Phase 7: Confluence Documentation
  Step 7.1: [Action]
  ✓ CHECKPOINT: Pages render and cross-links work
```

---

## Phase 2: Foundation — Issue Types & Schemes

### Step 2.1: Verify or Create Issue Types

```
get_issue_types()
```

Check if required issue types exist globally. If not:

```
create_issue_type({
  name: "<TYPE_NAME>",
  description: "<DESCRIPTION>",
  type: "standard"  // or "subtask"
})
```

### Step 2.2: Create or Update Issue Type Scheme

```
create_issue_type_scheme({
  name: "<PROJECT_KEY> Issue Type Scheme",
  issueTypeIds: ["<ID1>", "<ID2>", ...],
  defaultIssueTypeId: "<DEFAULT_ID>"
})
```

### Step 2.3: Assign Issue Type Scheme to Project

```
assign_issue_type_scheme_to_project({
  projectId: "<PROJECT_ID>",
  issueTypeSchemeId: "<SCHEME_ID>"
})
```

**API:** `PUT /rest/api/3/issuetypescheme/project` — ✅ Fully available via API.

### ✓ CHECKPOINT: Issue Creation Verification

Create a test issue for EACH required issue type:

```
create_issue({
  projectKey: "<KEY>",
  summary: "Checkpoint: [TYPE_NAME] creation test",
  issueType: "<TYPE_NAME>"
})
```

**ALL must succeed.** Delete test issues after verification. If any fail, do not
proceed — trace the dependency chain backward.

---

## Phase 3: Workflows & Schemes

### Step 3.1: Create Workflows

```
create_workflow({
  name: "<WORKFLOW_NAME>",
  statuses: [...],
  transitions: [...]
})
```

Or use the guided setup:

```
setup_workflow_guided({
  name: "<WORKFLOW_NAME>",
  workflowType: "development" | "support" | "simple" | "custom",
  customStatuses: [...]  // if custom
})
```

**Critical:** Every workflow MUST have at least one initial transition (from: []).

### Step 3.2: Create Workflow Scheme

```
create_workflow_scheme({
  name: "<PROJECT_KEY> Workflow Scheme",
  defaultWorkflow: "<DEFAULT_WORKFLOW_NAME>",
  issueTypeMappings: {
    "<ISSUE_TYPE_ID>": "<WORKFLOW_NAME>",
    ...
  }
})
```

### Step 3.3: Assign Workflow Scheme to Project

**API:** `PUT /rest/api/3/workflowscheme/project` — ✅ Available via API.

**Critical constraint:** This endpoint only works when there are **no issues** in
the project. If the project has existing issues, workflow scheme assignment requires
migration through the UI.

Use MCP tool (check the jira-workflows server for workflow scheme project association tools)
or flag as manual step if no MCP tool wraps this endpoint.

⚠️ **UI-ONLY FALLBACK:** If the project has existing issues, flag this:
```
MANUAL STEP REQUIRED:
  Navigate to Project Settings → Workflows → Switch Scheme
  Select: "<SCHEME_NAME>"
  Map existing statuses to new workflow statuses
```

### ✓ CHECKPOINT: Workflow Verification

```
create_issue({projectKey: "<KEY>", summary: "Workflow test", issueType: "<TYPE>"})
get_transitions({issueIdOrKey: "<KEY>-N"})
```

Verify the correct transitions appear. If default Jira workflow transitions appear
instead of your custom ones, the workflow scheme is not assigned.

---

## Phase 3A: JSM Extension (Service Desk Projects Only)

Skip this phase entirely if the project is not a service_desk type.

### Step 3A.1: Discover Service Desk

```
get_service_desks()
```

Find the service desk associated with the project.

### Step 3A.2: Create Request Types

JSM request types wrap Jira issue types with portal-facing metadata.

```
get_request_types({serviceDeskId: "<SD_ID>"})
```

Check what exists. Create missing request types:

```
create_request_type({
  serviceDeskId: "<SD_ID>",
  name: "<REQUEST_TYPE_NAME>",
  description: "<DESCRIPTION>",
  issueTypeId: "<ISSUE_TYPE_ID>"
})
```

**Dependency:** The issue type must exist in the project's issue type scheme first
(Phase 2). Request types that reference missing issue types will fail silently.

### Step 3A.3: Configure Request Type Fields

```
get_request_type_fields({
  serviceDeskId: "<SD_ID>",
  requestTypeId: "<RT_ID>"
})
```

Review which fields are visible on each request type. Field visibility on the
portal is controlled separately from Jira screens.

⚠️ **UI-ONLY:** Request type field configuration (which fields appear on the
customer portal form, field ordering, required/optional status on portal) is
primarily managed through the JSM portal configuration UI. The API can read
field configurations but modifications are limited.

### Step 3A.4: Customer Portal Groups

⚠️ **UI-ONLY:** Portal group configuration (organizing request types into
categories on the portal) must be done through the JSM portal settings UI.

### Step 3A.5: SLA Configuration

⚠️ **UI-ONLY:** SLA configuration (goals, calendars, conditions, metrics) is
managed entirely through the JSM project settings UI. No REST API endpoints
exist for SLA CRUD operations.

**Flag as manual step:**
```
MANUAL STEPS REQUIRED (JSM-Specific):
  1. Portal → Request type grouping and ordering
  2. SLAs → Create SLA metrics with goals and calendars
  3. Queues → Create and configure agent queues
  4. Portal → Customize branding and help text
```

### Step 3A.6: Queue Configuration

⚠️ **UI-ONLY:** Queue creation and configuration is managed through the JSM UI.

### Step 3A.7: Customer Organization Setup

```
get_customer_organizations()
```

Check existing organizations. Customer organizations control which customers can
access the service desk portal.

### ✓ CHECKPOINT: JSM Verification

Verify request types are accessible:
```
get_request_types({serviceDeskId: "<SD_ID>"})
```

Confirm all expected request types appear and are linked to correct issue types.

---

## Phase 4: Fields & Screens

### Step 4.1: Create Custom Fields

Check existing fields first to avoid duplicates:

```
get_fields_paginated({type: "custom"})
```

**Platform guardrail:** Before creating fields, verify the instance won't exceed
field limits (checked in Phase 1 Step 1.2). Each custom field adds overhead to
every issue in the instance, not just the target project.

Create missing fields:

```
create_custom_field({
  name: "<FIELD_NAME>",
  type: "<FIELD_TYPE>",
  description: "<DESCRIPTION>"
})
```

### Step 4.2: Configure Field Contexts

Custom fields need contexts to control where they appear:

```
get_custom_field_contexts({fieldId: "<FIELD_ID>"})
```

If no project-scoped context exists:

```
create_custom_field_context({
  fieldId: "<FIELD_ID>",
  name: "<CONTEXT_NAME>",
  projectIds: ["<PROJECT_ID>"]
})
```

### Step 4.3: Add Field Options (Select Fields Only)

Only for: Select List, Multi-select, Checkboxes, Radio Buttons, Cascading Select.
Check `schema.custom` contains one of: `select`, `multiselect`, `multicheckboxes`,
`radiobuttons`, `cascadingselect`.

```
create_custom_field_options({
  fieldId: "<FIELD_ID>",
  contextId: "<CONTEXT_ID>",
  options: [{value: "<OPTION_1>"}, {value: "<OPTION_2>"}]
})
```

### Step 4.4: Create Screens

```
create_screen({
  name: "<SCREEN_NAME>",
  description: "<DESCRIPTION>"
})
```

Add fields to screens:

```
add_field_to_screen({
  screenId: "<SCREEN_ID>",
  tabId: "<TAB_ID>",
  fieldId: "<FIELD_ID>"
})
```

### Step 4.5: Create Screen Schemes

Screen schemes map screens to operations (create/edit/view):

```
create_screen_scheme({
  name: "<SCREEN_SCHEME_NAME>",
  screens: {
    default: "<DEFAULT_SCREEN_ID>",
    create: "<CREATE_SCREEN_ID>",
    edit: "<EDIT_SCREEN_ID>",
    view: "<VIEW_SCREEN_ID>"
  }
})
```

### Step 4.6: Create Issue Type Screen Scheme (ITSS)

The ITSS maps issue types to screen schemes:

**API:** `POST /rest/api/3/issuetypescreenscheme` — ✅ Available via API.

Use the appropriate MCP tool, or construct:

```
Create ITSS with mappings:
  default → <DEFAULT_SCREEN_SCHEME_ID>
  <ISSUE_TYPE_ID> → <SPECIFIC_SCREEN_SCHEME_ID>
  ...
```

### Step 4.7: Assign ITSS to Project

**API:** `PUT /rest/api/3/issuetypescreenscheme/project` — ✅ Available via API.

Use the appropriate MCP tool for ITSS project assignment.

### Step 4.8: Field Configuration (Optional)

If the spec requires fields to be required, hidden, or have specific descriptions:

```
get_field_configurations()
create_field_configuration({...})
```

Field configuration scheme assignment to project:

**API:** `PUT /rest/api/3/fieldconfigurationscheme/project` — ✅ Available via API.
Check the jira-fields-permissions server for the appropriate tool.

### ✓ CHECKPOINT: Field Verification

Create a test issue and verify custom fields:

```
get_issue_createmeta_fields({
  projectIdOrKey: "<KEY>",
  issueTypeId: "<TYPE_ID>"
})
```

Verify all expected fields appear in the create metadata. If fields are missing,
trace: Field → Screen → Screen Scheme → ITSS → Project assignment.

---

## Phase 5: Populate Data

### Step 5.1: Create Issues

```
bulk_create_issues({
  issues: [
    {projectKey: "<KEY>", issueType: "<TYPE>", summary: "<TITLE>", ...},
    ...
  ]
})
```

Or individually for issues needing custom field values:

```
create_issue({
  projectKey: "<KEY>",
  issueType: "<TYPE>",
  summary: "<TITLE>",
  customFields: {
    "customfield_XXXXX": <VALUE>
  }
})
```

### Step 5.2: Set Issue States

For issues that should start in non-default states:

```
get_transitions({issueIdOrKey: "<KEY>-N"})
transition_issue({issueIdOrKey: "<KEY>-N", transitionId: "<ID>"})
```

### ✓ CHECKPOINT: Data Verification

```
search_jql({jql: "project = <KEY> ORDER BY created DESC", maxResults: 50})
```

Verify issue count, types, and field values match the spec.

---

## Phase 5A: Board Configuration (Software Projects Only)

Skip if not a software project.

⚠️ **UI-ONLY:** Board creation and configuration (columns, swimlanes, card layout,
quick filters, estimation) is managed through the Jira Software board settings UI.
The REST API has limited board configuration support.

**Flag as manual step:**
```
MANUAL STEPS REQUIRED (Board Configuration):
  1. Navigate to project board → Board Settings
  2. Configure columns to match workflow statuses
  3. Set WIP limits (Kanban) or sprint settings (Scrum)
  4. Configure card layout and quick filters
```

---

## Phase 6: Automation Rules

### Step 6.1: Check Existing Rules

```
get_automation_rules()
```

### Step 6.2: Create Automation Rules

```
create_automation_rule({
  name: "<RULE_NAME>",
  ...
})
```

**Platform guardrail:** Check plan-level automation limits:
- Free: 100 rule executions/month
- Standard: 500 rule executions/month
- Premium: 1,000 rule executions/month
- Enterprise: Unlimited

If the spec includes high-frequency automation (e.g., auto-assign on every issue
creation), verify the plan supports the expected execution volume.

⚠️ **API LIMITATION:** Creating automation rules via API requires knowing the
exact component type identifiers (trigger.type, action.type). These are not
documented — you must export an existing rule from the Jira UI to discover them.
For complex automation rules, flag as a manual step.

### ✓ CHECKPOINT: Automation Verification

```
get_automation_rules()
```

Verify rules were created and are enabled.

---

## Phase 7: Confluence Documentation

### Step 7.1: Create Space

```
create_space({
  key: "<SPACE_KEY>",
  name: "<SPACE_NAME>",
  description: "<DESCRIPTION>"
})
```

### Step 7.2: Create Page Hierarchy

Pages must be created in dependency order (parent before child):

```
create_page({
  spaceId: "<SPACE_ID>",
  title: "<PAGE_TITLE>",
  body: "<XHTML_CONTENT>"  // Confluence storage format
})
```

For child pages:

```
create_page({
  spaceId: "<SPACE_ID>",
  parentId: "<PARENT_PAGE_ID>",
  title: "<CHILD_TITLE>",
  body: "<XHTML_CONTENT>"
})
```

### ✓ CHECKPOINT: Confluence Verification

```
search_pages({spaceId: "<SPACE_ID>"})
```

Verify all expected pages exist and parent-child relationships are correct.

---

## Phase 8: Completion Report

Generate a structured summary:

- Phase-by-phase pass/fail with object counts
- All created objects with IDs (project, schemes, fields, space, pages)
- Manual steps required (anything the API could not handle)
- Verification status for each checkpoint
- Any assumptions made during spec gap resolution

Include a **manual steps checklist** for anything flagged with ⚠️ UI-ONLY.

---

## Scheme Assignment API Reference

Every scheme assignment the skill needs, with definitive API status:

| Scheme Type | API Endpoint | Status | MCP Server |
|-------------|-------------|--------|---------------|
| Issue Type Scheme → Project | `PUT /issuetypescheme/project` | ✅ API | jira-projects |
| Workflow Scheme → Project | `PUT /workflowscheme/project` | ✅ API (empty projects only) | jira-workflows |
| Screen Scheme (CRUD) | `/screenscheme` | ✅ API | jira-workflows |
| Issue Type Screen Scheme → Project | `PUT /issuetypescreenscheme/project` | ✅ API | jira-workflows or jira-fields-permissions |
| Field Configuration Scheme → Project | `PUT /fieldconfigurationscheme/project` | ✅ API | jira-fields-permissions |
| Permission Scheme → Project | `PUT /project/{key}` (body) | ✅ API (via project update) | jira-projects |
| Notification Scheme → Project | `PUT /project/{key}` (body) | ✅ API (via project update) | jira-projects |
| Priority Scheme → Project | `/priorityscheme` | ✅ API | Check available |

**Sources:** Atlassian REST API v3 documentation (developer.atlassian.com/cloud/jira/platform/rest/v3/)

---

## Anti-Patterns (DO NOT)

1. **DO NOT** create a workflow without also creating a workflow scheme and
   assigning it to the project. An unassigned workflow is an orphan.

2. **DO NOT** attempt issue creation without first verifying the issue type
   scheme is assigned to the project.

3. **DO NOT** create custom fields without adding them to screens. Invisible
   fields are useless fields.

4. **DO NOT** skip checkpoints. Each verifies the foundation for the next phase.

5. **DO NOT** assume any Jira project configuration "just works." Validate.

6. **DO NOT** try random ID variations when a tool call fails. Trace the
   dependency chain backward to find the missing link.

7. **DO NOT** proceed past a systemic failure (same error across multiple
   projects) without root cause analysis.

8. **DO NOT** create custom fields globally when project-scoped contexts suffice.
   Every global field adds overhead to every issue in the instance.

9. **DO NOT** share schemes across projects unless intentional. Modifying a shared
   scheme affects all projects using it.

10. **DO NOT** assign a workflow scheme to a project with existing issues via API.
    This requires status migration mapping which is UI-only.

---

## Reference Files

- [dependency-tree.md](./reference/dependency-tree.md) — Complete Jira Cloud object
  hierarchy with all dependency chains, API availability status, and MCP tool mappings.
  **Consult this when ANY tool call fails** to trace the missing prerequisite.

- [failure-analysis.md](./reference/failure-analysis.md) — Case study of a real project
  setup that failed at 60% due to missing foundational configuration. Shows exact
  failure patterns and the correct execution path.
