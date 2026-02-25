# Jira Projects Server

## Atlassian API Quirks

### Project Keys
- Must be 2-10 uppercase characters, starting with a letter
- Cannot be reused after deletion (even with `enableUndo`)
- Some keys are reserved by Atlassian

### Pagination
- `startAt` is 0-indexed
- `maxResults` caps at 100 for most endpoints, 50 for some
- Always check `isLast` or calculate from `total` to know if more pages exist

### Expand Parameters
- Use `expand=description,lead,issueTypes` to reduce API calls
- Over-expanding impacts performance; only request what's needed
- Some expand values require additional permissions

### Issue Type Schemes
- Cannot delete a scheme if it's associated with projects
- Default issue type must be in the scheme's issue type list
- Scheme changes don't retroactively affect existing issues

## Patterns in This Server

### Tool Naming
All tools prefixed with `jira_` even though they're in jira-projects server. This prevents collision when users enable multiple MCP servers.

### Error Response Format
```typescript
{
  success: false,
  error: "Human-readable message",
  code: "ERROR_CODE",
  suggestion: "What to try next"
}
```

### JQL in search_jql
- Validate JQL with `validateQuery: "warn"` during development
- Use `validateQuery: "strict"` for production
- Fields parameter significantly reduces response size

## Known Issues

### Dashboard Permissions
The Jira API for dashboard `sharePermissions` is inconsistent. When creating dashboards:
- `type: "project"` requires `project.id`, not `project.key`
- `type: "group"` requires `group.name`, but returns `group.groupId`

### Project Categories
- `categoryId` in create/update expects a number, but search returns string
- Cast appropriately when chaining operations

## Testing Notes

- Use a test project with key like `TEST` or `MCPTEST`
- Dashboard tests create real dashboards—clean up after
- Issue type scheme tests should use dedicated test schemes
