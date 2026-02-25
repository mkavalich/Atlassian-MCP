# Test Patterns

Expected inputs and outputs for each tool category.

---

## Discovery Tools

### Pattern
```
Input: {} or { maxResults: 20 }
Expected: { success: true, data: [...], count: N }
```

### Validation
- Response is not an error
- Response contains array or object of entities
- Count matches array length (if provided)

### Examples

**search_projects**
```json
// Input
{}

// Expected Output
{
  "success": true,
  "projects": [
    { "key": "PROJ", "name": "Project Name", "id": "10001" }
  ],
  "count": 15
}
```

**get_instance_info**
```json
// Input
{}

// Expected Output
{
  "success": true,
  "baseUrl": "https://your-site.atlassian.net",
  "version": "1001.0.0",
  "deploymentType": "Cloud"
}
```

---

## Create Tools

### Pattern
```
Input: { ...required fields with MCP_TEST_ prefix }
Expected: { success: true, id: "xxx", ...created entity }
Action: Store ID for later phases
```

### Validation
- Response is not an error
- Response contains created entity with ID
- ID is valid (non-empty string or number)

### Examples

**create_project**
```json
// Input
{
  "key": "MCPTEST",
  "name": "MCP Test Project",
  "projectTypeKey": "software",
  "leadAccountId": "<your-account-id>"
}

// Expected Output
{
  "success": true,
  "project": {
    "id": "10100",
    "key": "MCPTEST",
    "name": "MCP Test Project"
  }
}

// Store
testData.jira.testProjectKey = "MCPTEST"
testData.jira.testProjectId = "10100"
```

**create_issue**
```json
// Input
{
  "projectKey": "MCPTEST",
  "issueType": "Task",
  "summary": "MCP_TEST_ Integration Test Issue"
}

// Expected Output
{
  "success": true,
  "issue": {
    "id": "10500",
    "key": "MCPTEST-1",
    "self": "https://..."
  }
}

// Store
testData.jira.testIssueKey = "MCPTEST-1"
```

**create_space (Confluence)**
```json
// Input
{
  "key": "MCPTEST",
  "name": "MCP Test Space"
}

// Expected Output
{
  "success": true,
  "space": {
    "id": "12345",
    "key": "MCPTEST",
    "name": "MCP Test Space"
  }
}

// Store
testData.confluence.testSpaceId = "12345"
testData.confluence.testSpaceKey = "MCPTEST"
```

---

## Read Tools

### Pattern
```
Input: { id: <from Phase 2> }
Expected: { success: true, ...entity details }
Validation: Entity data matches what was created
```

### Examples

**get_issue**
```json
// Input
{
  "issueIdOrKey": "MCPTEST-1"
}

// Expected Output
{
  "success": true,
  "issue": {
    "key": "MCPTEST-1",
    "fields": {
      "summary": "MCP_TEST_ Integration Test Issue",
      "status": { "name": "To Do" }
    }
  }
}

// Validation
- summary contains "MCP_TEST_"
- key matches input
```

**get_page (Confluence)**
```json
// Input
{
  "pageId": "98765"
}

// Expected Output
{
  "success": true,
  "page": {
    "id": "98765",
    "title": "MCP Test Page",
    "version": { "number": 1 }
  }
}
```

---

## Update Tools

### Pattern
```
Input: { id: <from Phase 2>, field: "new value" }
Expected: { success: true, ...updated entity }
Verification: Call read tool to confirm change persisted
```

### Examples

**update_issue**
```json
// Input
{
  "issueIdOrKey": "MCPTEST-1",
  "summary": "MCP_TEST_ Updated Summary"
}

// Expected Output
{
  "success": true,
  "message": "Issue updated successfully"
}

// Verification
// Call get_issue and check summary = "MCP_TEST_ Updated Summary"
```

**update_page (Confluence)**
```json
// Input
{
  "pageId": "98765",
  "title": "MCP Test Page - Updated",
  "version": 1  // Current version required
}

// Expected Output
{
  "success": true,
  "page": {
    "id": "98765",
    "title": "MCP Test Page - Updated",
    "version": { "number": 2 }
  }
}
```

---

## Delete Tools

### Pattern
```
Input: { id: <from Phase 2> }
Expected: { success: true } or 204 No Content
Verification: Call read tool - should return 404
```

### Examples

**delete_issue**
```json
// Input
{
  "issueIdOrKey": "MCPTEST-1"
}

// Expected Output
{
  "success": true,
  "message": "Issue MCPTEST-1 deleted successfully"
}

// Verification
// Call get_issue("MCPTEST-1") - should fail with 404
```

**delete_space (Confluence)**
```json
// Input
{
  "spaceId": "12345"
}

// Expected Output
{
  "success": true
}

// Verification
// Call get_space("12345") - should fail with 404
```

---

## Error Response Patterns

### 400 Bad Request
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Missing required field: summary",
    "suggestion": "Provide a summary for the issue"
  }
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "error": {
    "code": "AUTHENTICATION_ERROR",
    "message": "Invalid or expired API token"
  }
}
```

### 403 Forbidden
```json
{
  "success": false,
  "error": {
    "code": "PERMISSION_ERROR",
    "message": "You don't have permission to perform this action"
  }
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Issue MCPTEST-999 not found",
    "suggestion": "Verify the issue key is correct"
  }
}
```

### 429 Rate Limited
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT",
    "message": "Too many requests",
    "retryAfter": 60
  }
}
```

---

## Special Tool Patterns

### Transition Tools
```json
// First get available transitions
{
  "tool": "get_transitions",
  "input": { "issueIdOrKey": "MCPTEST-1" }
}
// Returns: { transitions: [{ id: "21", name: "In Progress" }] }

// Then transition
{
  "tool": "transition_issue",
  "input": { 
    "issueIdOrKey": "MCPTEST-1",
    "transitionId": "21"
  }
}
```

### Guided Tools (LLM-friendly)
```json
// These handle discovery internally
{
  "tool": "get_custom_field_options_guided",
  "input": { "fieldId": "customfield_10001" }
}
// Returns options from all contexts automatically
```

### Bulk Operations
```json
{
  "tool": "bulk_update_permissions",
  "input": {
    "spaceId": "12345",
    "permissions": [
      { "principalType": "user", "principalId": "xxx", "operation": "read" },
      { "principalType": "group", "principalId": "developers", "operation": "write" }
    ]
  }
}
```
