---
name: tool-validation
description: Systematic integration testing of all MCP tools against a live Atlassian Cloud instance. Use this skill before building production skills to ensure all tools work correctly.
license: MIT
---

# MCP Tool Validation Guide

## Overview

Before building skills that depend on MCP tools, all tools must be validated against the live Atlassian Cloud instance. This skill provides a systematic approach to test all 278 tools across 8 servers, record results, and build a remediation plan for any failures.

**Why validate first?**
- Skills built on broken tools create debugging nightmares
- Discovery tools must work before CRUD operations can be tested
- Destructive operations need careful sequencing
- Test data must be created before it can be read/updated/deleted

---

# Process

## High-Level Workflow

Tool validation follows five phases executed in strict order:

```
Phase 1: Discovery (read-only) → Validates connectivity, discovers IDs
Phase 2: Create → Creates test entities with MCP_TEST_ prefix
Phase 3: Read → Validates entity retrieval
Phase 4: Update → Modifies test entities  
Phase 5: Delete → Cleans up test data
```

---

## Phase 1: Discovery Tools

**Goal:** Validate API connectivity and discover existing entity IDs needed for subsequent tests.

**These tools are safe** - they only read data and cannot modify anything.

### Priority Order

Test these first as they validate basic connectivity:

1. `jira-system-admin:get_instance_info` - Validates Jira API connectivity
2. `confluence:get_system_info` - Validates Confluence API connectivity
3. `jira-projects:search_projects` - Find existing projects, get project keys
4. `jira-projects:get_issue_types` - Find issue types for creating issues
5. `jira-workflows:get_workflows` - Find existing workflows
6. `jira-fields-permissions:get_permission_schemes` - Find permission schemes
7. `jira-service-desk:get_service_desks` - Find service desks (if JSM enabled)
8. `jira-product-discovery:get_jpd_projects` - Find JPD projects (if enabled)
9. `confluence:search_spaces` - Find Confluence spaces

### All Discovery Tools

See [Tool Inventory](./reference/tool-inventory.md) for the complete list organized by server.

### Recording Discovery Results

After each successful discovery call, record found IDs in `test-results/results.json`:

```json
{
  "testData": {
    "jira": {
      "existingProjectKey": "PROJ",
      "existingIssueTypeId": "10001",
      "existingWorkflowId": "10100"
    }
  }
}
```

---

## Phase 2: Create Tools

**Goal:** Create test entities that will be used in subsequent phases.

### Naming Convention

All test entities use prefixes for easy identification and cleanup:
- Projects: `MCPTEST`
- Issues: Summary starts with `MCP_TEST_`
- Dashboards: `MCP Test Dashboard`
- Workflows: `MCP Test Workflow`
- Screens: `MCP Test Screen`
- Permission Schemes: `MCP Test Permissions`
- Custom Fields: `MCP Test Field`
- Confluence Spaces: `MCPTEST`
- Pages: `MCP Test Page`

### Create Order

Some entities depend on others. Follow this order:

1. **Jira Project** (if testing project creation)
   ```
   jira-projects:create_project { key: "MCPTEST", name: "MCP Test Project", ... }
   ```

2. **Issue Types** (if testing custom types)
   ```
   jira-projects:create_issue_type { name: "MCP Test Task", ... }
   ```

3. **Issues** (requires project + issue type)
   ```
   jira-projects:create_issue { projectKey: "MCPTEST", issueType: "Task", summary: "MCP_TEST_ Issue 1" }
   ```

4. **Comments** (requires issue)
   ```
   jira-projects:add_comment { issueIdOrKey: "MCPTEST-1", body: "MCP Test Comment" }
   ```

5. **Confluence Space**
   ```
   confluence:create_space { key: "MCPTEST", name: "MCP Test Space" }
   ```

6. **Confluence Page** (requires space)
   ```
   confluence:create_page { spaceId: "<id>", title: "MCP Test Page", body: "Test content" }
   ```

### Recording Created Entities

Store all created entity IDs for later phases:

```json
{
  "testData": {
    "jira": {
      "testProjectKey": "MCPTEST",
      "testIssueKey": "MCPTEST-1",
      "testCommentId": "10500"
    }
  }
}
```

---

## Phase 3: Read Tools

**Goal:** Validate detailed read operations on entities from Phase 2.

### Test Pattern

For each read tool:
1. Call with ID from Phase 2
2. Verify response contains expected fields
3. Check data matches what was created

```
jira-projects:get_issue { issueIdOrKey: "MCPTEST-1" }
→ Expect: summary contains "MCP_TEST_"
```

---

## Phase 4: Update Tools

**Goal:** Modify test entities and verify changes persist.

### Test Pattern

For each update tool:
1. Call with ID from Phase 2 + modified field
2. Verify success response
3. Call corresponding read tool to confirm change

```
jira-projects:update_issue { issueIdOrKey: "MCPTEST-1", summary: "MCP_TEST_ Updated" }
→ Then: get_issue to verify summary changed
```

---

## Phase 5: Delete Tools

**Goal:** Clean up all test entities while validating delete operations.

### Delete Order (Reverse of Create)

Delete children before parents:

1. Comments → before deleting issues
2. Attachments → before deleting issues
3. Issues → before deleting projects
4. Pages → before deleting spaces
5. Dashboards, Workflows, Screens → can be deleted independently
6. Projects, Spaces → delete last

### Verify Deletion

After delete, attempt to read the entity - should return 404:

```
jira-projects:delete_issue { issueIdOrKey: "MCPTEST-1" }
→ Then: get_issue should fail with "not found"
```

---

## Recording Test Results

### Result Structure

Update `test-results/results.json` after each tool test:

```json
{
  "servers": {
    "jira-projects": {
      "tools": {
        "search_projects": {
          "status": "passed",
          "testedAt": "2026-01-05T10:30:00Z",
          "testInput": {},
          "actualResult": { "count": 15 },
          "notes": "Found 15 projects"
        },
        "create_issue": {
          "status": "failed",
          "testedAt": "2026-01-05T10:35:00Z",
          "testInput": { "projectKey": "MCPTEST", "issueType": "Task", "summary": "Test" },
          "errorMessage": "Project MCPTEST not found",
          "notes": "Need to create project first"
        }
      }
    }
  }
}
```

### Status Values

| Status | When to Use |
|--------|-------------|
| `passed` | Tool returned expected response, no errors |
| `failed` | Tool returned error or unexpected response |
| `blocked` | Cannot test due to dependency failure |
| `skipped` | Not applicable to test environment (e.g., JPD not enabled) |

---

## Common Failure Patterns

### Authentication Errors
```
Error: 401 Unauthorized
Cause: Invalid or expired API token
Fix: Regenerate API token, update .env
```

### Permission Errors
```
Error: 403 Forbidden
Cause: API token user lacks permission
Fix: Grant admin permissions to API user
```

### Not Found Errors
```
Error: 404 Not Found
Cause: Entity doesn't exist or wrong ID format
Fix: Verify ID exists, check ID format (numeric vs string)
```

### Validation Errors
```
Error: 400 Bad Request
Cause: Invalid input parameters
Fix: Check required fields, data types, enum values
```

### Rate Limiting
```
Error: 429 Too Many Requests
Cause: Exceeded Atlassian API rate limits
Fix: Add delay between tests, implement backoff
```

---

## Generating Remediation Plan

After all tests complete:

1. **Collect failures** from `results.json`
2. **Group by error type** (auth, permission, validation, etc.)
3. **Prioritize fixes:**
   - P1: Discovery tools (blocks all other tests)
   - P2: Create tools (blocks CRUD flow)
   - P3: Read tools (core functionality)
   - P4: Update/Delete tools

4. **Document each fix:**
   ```json
   {
     "remediationPlan": [
       {
         "tool": "jira-projects:create_issue",
         "priority": "P2",
         "errorType": "validation",
         "errorMessage": "issueType is required",
         "proposedFix": "Add issueType to required fields in schema",
         "effort": "small"
       }
     ]
   }
   ```

---

## Quick Reference

### Test Session Checklist

```markdown
## Pre-Test
- [ ] .env credentials configured
- [ ] MCP servers accessible (check .mcp.json)
- [ ] Previous test data cleaned up

## During Test
- [ ] Recording results in results.json
- [ ] Noting any unexpected behavior
- [ ] Saving created entity IDs

## Post-Test
- [ ] All test entities cleaned up
- [ ] Failed tools documented
- [ ] Remediation plan created (if failures)
```

### Server Tool Counts

| Server | Tools | Discovery | Create | Read | Update | Delete |
|--------|-------|-----------|--------|------|--------|--------|
| jira-projects | 37 | 4 | 8 | 13 | 6 | 6 |
| jira-workflows | 41 | 8 | 10 | 10 | 8 | 7 |
| jira-fields-permissions | 35 | 6 | 11 | 10 | 5 | 4 |
| jira-service-desk | 11 | 3 | 1 | 4 | 1 | 0 |
| jira-organization | 37 | 2 | 0 | 32 | 0 | 0 |
| jira-system-admin | 21 | 10 | 1 | 4 | 2 | 0 |
| jira-product-discovery | 15 | 4 | 2 | 5 | 2 | 2 |
| confluence | 81 | 7 | 16 | 38 | 11 | 9 |
| **TOTAL** | **278** | **44** | **49** | **116** | **35** | **28** |

---

# Reference Files

## Documentation

- [Tool Inventory](./reference/tool-inventory.md) - Complete list of all 278 tools organized by server and test phase
- [Test Patterns](./reference/test-patterns.md) - Expected inputs/outputs for each tool type
- [Results Template](./reference/results-template.json) - JSON template for recording test results

## Output Location

Test results are stored in `test-results/` at the project root:
- `results.json` - Live test results (copy from template)
- `remediation-plan.md` - Generated after testing (if failures found)
