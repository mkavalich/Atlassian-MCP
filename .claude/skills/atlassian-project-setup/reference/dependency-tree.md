# Jira Cloud Object Dependency Tree

## Overview

Every configurable object in Jira Cloud exists within a hierarchy. Creating an object
without its parent being properly configured results in either an error or an orphaned
object that appears to exist but doesn't function.

This reference maps every dependency chain relevant to project setup, with API
availability confirmed against Atlassian REST API v3 documentation.

**Last verified:** February 2026
**Source:** developer.atlassian.com/cloud/jira/platform/rest/v3/

---

## Table of Contents

1. [Core Jira Dependency Chains](#core-jira-dependency-chains)
2. [JSM Extension Chains](#jsm-extension-chains)
3. [Confluence Chains](#confluence-chains)
4. [Scheme Assignment Matrix](#scheme-assignment-matrix)
5. [API vs UI Operations](#api-vs-ui-operations)
6. [Common Failure Patterns](#common-failure-patterns)

---

## Core Jira Dependency Chains

### Chain 1: Issue Creation

```
Issue Type (global)
  └→ Issue Type Scheme (groups types)               [API: CRUD ✅]
      └→ Issue Type Scheme → Project assignment      [API: PUT ✅]
          └→ Issue (can now be created)              [API: CRUD ✅]
```

**Discovery → Fix sequence:**
```
get_issue_types()                           → Do required types exist globally?
get_issue_type_schemes()                    → Does a scheme contain them?
get_issue_type_scheme_mappings()             → Is the scheme assigned to the project?
assign_issue_type_scheme_to_project()        → Fix: Assign scheme
```

**Failure symptom:** "Specify a valid issue type" when creating issues.

### Chain 2: Workflow Governance

```
Status (global, categorized: TODO/IN_PROGRESS/DONE)
  └→ Workflow (statuses + transitions)               [API: CRUD ✅]
      └→ Workflow Scheme (maps issue types → workflows) [API: CRUD ✅]
          └→ Workflow Scheme → Project assignment     [API: PUT ✅ *]
              └→ Issue follows custom workflow
```

*Constraint: Workflow scheme assignment via API only works when the project has
**no existing issues**. Projects with issues require UI-based migration.

**Discovery → Fix sequence:**
```
get_statuses()                              → Available statuses and categories
get_workflows()                             → Does the workflow exist?
get_workflow_schemes_detailed()             → Does a scheme map it?
  → Check project association                  → Is the scheme assigned?
  → Assign or flag manual step
```

**Failure symptom:** Issues use default Jira workflow instead of custom workflow.

### Chain 3: Screen Configuration

```
Field (system or custom)
  └→ Screen (contains fields on tabs)                [API: CRUD ✅]
      └→ Screen Scheme (maps screens to operations)  [API: CRUD ✅]
          └→ Issue Type Screen Scheme (ITSS)         [API: CRUD ✅]
              └→ ITSS → Project assignment           [API: PUT ✅]
                  └→ Fields visible on create/edit/view
```

**Discovery → Fix sequence:**
```
get_fields_paginated()                     → Does the field exist?
get_screens()                               → Is the field on a screen?
get_screen_tabs() → get_screen_tab_fields() → Which tab? Which fields?
get_screen_schemes()                        → Is the screen in a scheme?
  → Check ITSS                                 → Is the screen scheme in an ITSS?
  → Check ITSS → Project                       → Is the ITSS assigned to the project?
```

**Failure symptom:** Custom fields invisible on issue create/edit/view.

### Chain 4: Field Behavior

```
Field Configuration (required/optional/hidden per field)
  └→ Field Configuration Scheme (maps issue types → configs) [API: CRUD ✅]
      └→ FC Scheme → Project assignment                      [API: PUT ✅]
          └→ Field validation behavior active
```

**Discovery → Fix sequence:**
```
get_field_configurations()                 → Does a config with correct behavior exist?
get_field_configuration_schemes()          → Is it in a scheme?
  → Check scheme → project assignment
```

### Chain 5: Custom Field Options

```
Custom Field (must be select-type)
  └→ Field Context (global or project-scoped)        [API: CRUD ✅]
      └→ Field Options (values for select fields)    [API: CRUD ✅]
```

**Only these field types support options:**
- `customfieldtypes:select` (Select List single)
- `customfieldtypes:multiselect` (Select List multi)
- `customfieldtypes:cascadingselect` (Cascading Select)
- `customfieldtypes:radiobuttons` (Radio Buttons)
- `customfieldtypes:multicheckboxes` (Checkboxes)

**Discovery → Fix sequence:**
```
get_fields_paginated()                     → Check schema.custom for type
get_custom_field_contexts({fieldId})        → Get context IDs
get_custom_field_options({fieldId, contextId}) → Check existing options
create_custom_field_options({fieldId, contextId, options}) → Add options
```

**Failure symptom:** "Field doesn't support options" error.

### Chain 6: Permissions

```
Permission Scheme (defines who can do what)          [API: CRUD ✅]
  └→ Permission Scheme → Project (via project update) [API: PUT ✅]
      └→ Users can perform permitted actions
```

**Assignment method:** Include `permissionScheme` in `update_project()` body.

### Chain 7: Notifications

```
Notification Scheme (who gets notified of what)      [API: CRUD ✅]
  └→ Notification Scheme → Project (via project update) [API: PUT ✅]
      └→ Email notifications fire on events
```

**Assignment method:** Include `notificationScheme` in `update_project()` body.

---

## JSM Extension Chains

These chains are **only relevant for service_desk project types**.

### Chain 8: Request Types

```
Issue Type (must exist in project's ITS)
  └→ Request Type (portal-facing wrapper)            [API: CRUD ✅]
      └→ Portal Group (organizes request types)      [API: ❌ UI only]
          └→ Customer Portal displays request types
```

**Discovery → Fix sequence:**
```
get_service_desks()                        → Find service desk ID
get_request_types({serviceDeskId})          → What request types exist?
create_request_type({serviceDeskId, ...})   → Create missing types
```

**Dependency:** The issue type referenced by the request type MUST be in the
project's issue type scheme. Otherwise the request type creation may succeed
but the portal won't function correctly.

### Chain 9: SLA Configuration

```
Request Types (must exist)
  + Priorities (system or custom)
  + Working Hours Calendar                           [API: ❌ UI only]
  └→ SLA Metric (goal + conditions)                  [API: ❌ UI only]
```

**Entirely UI-managed.** The agent should flag all SLA configuration as manual steps.

### Chain 10: Queues

```
JQL Filter (defines which issues appear)
  + Column Configuration
  └→ Queue (agent view of filtered issues)           [API: ❌ UI only]
```

**Entirely UI-managed.** Flag as manual step.

### Chain 11: Customer Organizations

```
Organization (groups customers)                      [API: Read ✅, Limited write]
  └→ Organization → Service Desk association
      └→ Customers in org can access portal
```

**Discovery:**
```
get_customer_organizations()
get_project_customer_organizations({projectId})
get_organization_customers({organizationId})
```

### Chain 12: Knowledge Base (JSM + Confluence)

```
Confluence Space (linked to service desk)
  └→ Knowledge Base Articles (Confluence pages)
      └→ Portal surfaces articles to customers
```

**Configuration:** Linking a Confluence space as a knowledge base is done through
the JSM project settings UI.

---

## Confluence Chains

### Chain 13: Documentation Space

```
Confluence Space                                     [API: CRUD ✅]
  └→ Root Page (home page)                           [API: CRUD ✅]
      └→ Child Pages (hierarchical)                  [API: CRUD ✅]
```

**Execution sequence:**
```
create_space({key, name})
create_page({spaceId, title, body})             → Root page
create_page({spaceId, parentId, title, body})   → Child pages
```

**Content format:** Confluence storage format (XHTML). Do NOT include `<?xml?>`
or `<!DOCTYPE>` declarations. Escape special characters: `&amp;` `&lt;` `&gt;`

---

## Scheme Assignment Matrix

| Scheme Type | API Endpoint | Method | Status | Constraint |
|-------------|-------------|--------|--------|------------|
| Issue Type Scheme | `/issuetypescheme/project` | PUT | ✅ | None |
| Workflow Scheme | `/workflowscheme/project` | PUT | ✅ | Empty projects only |
| Screen Scheme | `/screenscheme` | CRUD | ✅ | N/A (not directly assigned) |
| Issue Type Screen Scheme | `/issuetypescreenscheme/project` | PUT | ✅ | Classic projects only |
| Field Config Scheme | `/fieldconfigurationscheme/project` | PUT | ✅ | None |
| Permission Scheme | `/project/{key}` (body field) | PUT | ✅ | Via project update |
| Notification Scheme | `/project/{key}` (body field) | PUT | ✅ | Via project update |
| Priority Scheme | `/priorityscheme` | CRUD | ✅ | Check available tools |
| Issue Security Scheme | `/project/{key}` (body field) | PUT | ✅ | Via project update |

**Key finding:** All major scheme assignments are available via Jira Cloud REST API v3.
The original skill incorrectly marked several as "check available tools" — they are
definitively available.

---

## API vs UI Operations

### Fully Automatable via API

- Project creation (all types: software, service_desk, business)
- Issue type CRUD and scheme management
- Workflow CRUD and scheme management
- Screen, screen scheme, ITSS CRUD and assignment
- Custom field CRUD, contexts, and options
- Field configuration and scheme management
- Permission and notification scheme management
- Issue CRUD, transitions, comments, attachments
- Confluence space and page CRUD
- JSM request type CRUD
- JSM customer organization read/query
- Automation rule CRUD (with component type ID caveat)

### UI-Only Operations

- Workflow scheme assignment to projects **with existing issues** (requires migration)
- JSM portal group configuration (request type categorization)
- JSM SLA configuration (goals, calendars, conditions)
- JSM queue configuration
- JSM knowledge base linking (Confluence → service desk)
- JSM portal branding and help text
- Board configuration (columns, swimlanes, card layout, quick filters)
- Automation rule component type discovery (must export existing rule first)
- Request type field ordering and portal-specific required/optional settings

---

## Common Failure Patterns

### 1. "Issue type exists but project can't use it"
Issue types are global, but projects only see types in their assigned Issue Type
Scheme. Creating a custom issue type doesn't add it to any scheme.

### 2. "Workflow created but issues still use default"
A workflow is just a definition. It must be in a Workflow Scheme, mapped to issue
types, and that scheme assigned to the project.

### 3. "Custom field created but invisible"
Custom fields must be: added to a screen → that screen in a screen scheme → that
screen scheme in an ITSS → that ITSS assigned to the project.

### 4. "Field exists but won't accept options"
Only select-type fields support options. Check `schema.custom` before calling
`create_custom_field_options`.

### 5. "Can't modify workflow scheme via API"
Active workflow schemes (assigned to projects with issues) can't be reassigned via
API. Create a new scheme or use the Jira UI.

### 6. "Test issue fails across ALL projects"
Systemic issue: instance-level config, API scope limitation, or default issue type
scheme misconfiguration. Investigate at instance level.

### 7. "Request type created but not visible on portal"
The underlying issue type must be in the project's issue type scheme. Also check
portal group configuration (UI-only).

### 8. "Custom field appears globally when it should be project-scoped"
Use project-scoped field contexts to limit where a field appears. Creating a field
without a context makes it global by default.
