# Jira Workflows Server

## Atlassian API Quirks

### Workflow States
- Workflows cannot be edited while in use by active projects
- Must create a draft, modify the draft, then publish
- Some workflow operations are async—check for `taskId` in response

### Workflow Creation API Format (CRITICAL)
The `/rest/api/3/workflows/create` endpoint requires a specific format with `toStatusReference` and `links` (discovered Jan 2026).

**User-Friendly Input Format** (what you provide to `create_workflow` tool):
```json
{
  "name": "My Workflow",
  "statuses": [
    { "id": "todo", "name": "To Do", "statusCategory": "TODO" },
    { "id": "done", "name": "Done", "statusCategory": "DONE" }
  ],
  "transitions": [
    { "name": "Create", "from": [], "to": "todo" },
    { "name": "Complete", "from": ["todo"], "to": "done" }
  ]
}
```
- Use `from: []` for initial transitions (issue creation)
- Use `from: ["status-id"]` for directed transitions
- Status categories must be exactly `TODO`, `IN_PROGRESS`, or `DONE`

**Internal API Format** (what the tool sends to Jira):
```json
{
  "scope": { "type": "GLOBAL" },
  "statuses": [
    { "name": "To Do", "statusCategory": "TODO", "statusReference": "todo" }
  ],
  "workflows": [{
    "name": "My Workflow",
    "statuses": [{ "statusReference": "todo" }],
    "transitions": [{
      "id": "1",
      "name": "Create",
      "type": "INITIAL",
      "toStatusReference": "todo",
      "links": [{ "toPort": 1 }]
    }]
  }]
}
```
- `toStatusReference` replaces deprecated `to` field
- `links` array replaces deprecated `from` array
- INITIAL transitions: `links: [{ toPort: N }]`
- DIRECTED transitions: `links: [{ fromStatusReference: "...", fromPort: N, toPort: N }]`

**Common error**: "Schema validation error" means statuses/transitions are using wrong format.

### Existing Status Reuse (CRITICAL - discovered Feb 2026)
The workflow create API rejects duplicate status names with "Status name already in use".
Per Atlassian team (Marcel Caroly): "When no `id` is supplied we assume you are trying to create a new status."

**Fix**: Include the existing status's `id` field in the top-level `statuses` array:
```json
{
  "statuses": [
    { "statusReference": "uuid-1", "name": "To Do", "statusCategory": "TODO", "id": "10038" },
    { "statusReference": "uuid-2", "name": "New Status", "statusCategory": "IN_PROGRESS" }
  ]
}
```
- Existing status: include `id` → Jira reuses it
- New status: omit `id` → Jira creates it
- Both `create_workflow` and `setup_workflow_guided` now auto-detect existing statuses via `/statuses/search`

Source: https://community.atlassian.com/forums/Jira-questions/Jira-Bulk-Create-Workflow-API-with-existing-statuses-is-always/qaq-p/2754997

### Workflow Schemes
- Scheme assignment to projects can take time to propagate
- Cannot delete schemes associated with projects
- Default workflow applies to issue types not explicitly mapped

### Screens and Screen Schemes
- Screen tabs have an order; reordering requires multiple API calls
- Field additions to screens are project-scoped in some contexts
- Screen schemes link screens to issue operations (create, edit, view)

### Automation Rules
- The Automation API is relatively new and less documented
- Rule execution is async; creating a rule doesn't immediately run it
- Some rule conditions/actions require specific Jira products (JSM, etc.)
- **Official API docs**: https://developer.atlassian.com/cloud/automation/rest/api-group-rule-management/
- **Component type identifiers are NOT enumerated in documentation**
  - Per Atlassian: "the component identifier must be obtained by exporting an existing rule"
  - This affects `create_automation_rule` - returns 400 without correct component format
  - **REUSABLE**: Once you export ONE rule of each trigger/action type, you can create unlimited new rules
- **CRITICAL: authorAccountId is REQUIRED for CREATE**
  - API returns 400 without this field (discovered via testing Jan 2026)
  - Get it from existing rules via `get_automation_rules` or from user profile
  - The `actor` field defaults to authorAccountId if not specified
- **API wrapper format**: All requests must use `{rule: {...}, connections: []}` wrapper
- **UI-Only Operations** (not available via API):
  - **Delete rules**: DELETE endpoint doesn't exist - must use Jira UI
  - **Validate rules**: /rule/validate endpoint is undocumented/internal
  - **View execution history**: /rule/{id}/executions endpoint is undocumented/internal
  - **Execute manual rules**: Requires manual-trigger rule created in UI first (backlog item)
- **Permission levels**:
  - READ operations (get_automation_rules, get_automation_templates): ADMINISTER permission sufficient
  - WRITE operations (validate, create): Require SYSTEM_ADMIN permission
  - The `system-administrators` group is protected and cannot be modified via API

#### Component Type Mapping (automation-component-types.ts)
The `resolveComponentType()` function maps friendly names to raw API identifiers. The `getDefaultValue()` function returns verified default value schemas. When `value` is omitted from a component, `create_automation_rule` auto-populates it from defaults.

Use friendly names (e.g., `ISSUE_CREATED`) or raw API types (e.g., `jira.issue.event.trigger:created`).

**Trigger Types:**
| Friendly Name | API Type | Status |
|---|---|---|
| ISSUE_CREATED | jira.issue.event.trigger:created | verified |
| ISSUE_UPDATED | jira.issue.event.trigger:updated | verified |
| ISSUE_TRANSITIONED | jira.issue.event.trigger:transitioned | verified |
| ISSUE_ASSIGNED | jira.issue.event.trigger:assigned | verified |
| ISSUE_COMMENTED | jira.issue.event.trigger:commented | verified |
| ISSUE_DELETED | jira.issue.event.trigger:deleted | verified |
| ISSUE_LINKED | jira.issue.event.trigger:link | verified |
| ISSUE_MOVED | jira.issue.event.trigger:moved | verified |
| WORK_LOGGED | jira.issue.event.trigger:worklog | verified |
| FIELD_VALUE_CHANGED | jira.issue.field.changed | verified |
| SCHEDULED | jira.jql.scheduled | verified |
| MANUAL | jira.manual.trigger.issue | verified |
| INCOMING_WEBHOOK | jira.incoming.webhook | verified |
| MULTIPLE_ISSUE_EVENTS | jira.multiple.issue.event | verified |
| VERSION_CREATED | jira.version.event.trigger:created | verified |
| VERSION_RELEASED | jira.version.event.trigger:released | inferred |
| SPRINT_STARTED | jira.sprint.event.trigger:started | verified |
| SPRINT_CREATED | jira.sprint.event.trigger:created | inferred |
| SPRINT_COMPLETED | jira.sprint.event.trigger:completed | inferred |
| DEPLOYMENT_STATE_CHANGED | devops.deploy.event.trigger:statechange | verified |

**Action Types:**
| Friendly Name | API Type | Status |
|---|---|---|
| ASSIGN_ISSUE | jira.issue.assign | verified |
| CREATE_ISSUE | jira.issue.create | verified |
| EDIT_ISSUE | jira.issue.edit | verified |
| TRANSITION_ISSUE | jira.issue.transition | verified |
| COMMENT_ISSUE | jira.issue.comment | verified |
| LINK_ISSUES | jira.issue.link | verified |
| DELETE_ISSUE | jira.issue.delete | inferred |
| CLONE_ISSUE | jira.issue.clone | inferred |
| CREATE_SUBTASK | jira.issue.create.subtask | inferred |
| SEND_EMAIL | jira.send.email | inferred |
| SEND_WEB_REQUEST | jira.issue.outgoing.webhook | verified |
| CREATE_VARIABLE | jira.create.variable | verified |
| LOG_ACTION | codebarrel.action.log | verified |
| LOOKUP_ISSUES | jira.lookup.issues | inferred |

**Condition Types:**
| Friendly Name | API Type | Status |
|---|---|---|
| JQL_CONDITION | jira.jql.condition | verified |
| ISSUE_FIELDS_CONDITION | jira.issue.condition | verified |
| ADVANCED_COMPARE | jira.comparator.condition | verified |
| USER_CONDITION | jira.user.condition | verified |
| RELATED_ISSUES | jira.related.issues.condition | inferred |
| IF_ELSE_BLOCK | jira.condition.if.block | inferred |

**Branch Types:**
| Friendly Name | API Type | Status |
|---|---|---|
| RELATED_ISSUES_BRANCH | jira.issue.related | verified |

Types marked "verified" were confirmed via React state extraction from Jira Cloud Automation UI (Feb 2026). Types marked "inferred" follow confirmed naming patterns.

## Patterns in This Server

### Guided Workflows
The `guided-workflows.ts` file contains tools that combine multiple API calls:
- They're higher-level abstractions
- They handle common multi-step operations
- Good examples of composing atomic tools

### Workflow Validation
Before modifying workflows, the tools should:
1. Check if workflow is in use
2. Create draft if needed
3. Apply changes to draft
4. Validate draft
5. Publish draft

## Known Issues

### Workflow Transition Properties
- Transition properties API is inconsistent between workflow versions
- Some properties are read-only even though the API suggests otherwise

### Screen Field Order
- Adding fields to screens doesn't guarantee order
- Use the explicit ordering endpoint after adding fields

### Automation Rule Scope
- Rules can be project-scoped or global
- Global rules require Jira admin permissions, not just project admin

## Testing Notes

- Create test workflows with prefix `MCP_TEST_`
- Never modify the default "Software Simplified Workflow"
- Automation rule tests may trigger actual automations—use test projects

### Automation Tool Testing Prerequisites

#### Workflow for Creating Rules via API:
1. Get `authorAccountId` from an existing rule via `get_automation_rules` or from user profile
2. Use friendly type names (ISSUE_CREATED, ASSIGN_ISSUE) with `create_automation_rule`
3. The resolver in `automation-component-types.ts` maps them to raw API identifiers automatically
4. Raw API types (jira.issue.event.trigger:created) also work and pass through unchanged

#### Tool Availability:
Without existing rules:
- `get_automation_rules` - Works (returns empty list)
- `get_automation_templates` - Works (returns available templates)

With existing rules (full functionality):
- `get_automation_rule_details` - Retrieves rule configuration
- `create_automation_rule` - **NOW WORKS** with correct authorAccountId + component types
- `update_automation_rule` - Modifies existing rule
- `delete_automation_rule` - Removes rule
- `enable_disable_automation_rule` - Toggles rule state
- `get_rule_executions` - Views execution history
- `execute_manual_rule` - Triggers manual rules

Tools with permission restrictions:
- `validate_automation_rule` - Requires SYSTEM_ADMIN permission
