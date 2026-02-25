# Jira Fields & Permissions Server

## Atlassian API Quirks

### Custom Fields
- Field IDs are `customfield_XXXXX` format (5+ digit number)
- System fields use short names: `summary`, `description`, `status`
- Field context determines which projects/issue types see the field

### Field Contexts
- A field can have multiple contexts with different configurations
- Default context applies when no specific context matches
- Context changes don't retroactively update existing issues

### Field Configurations
- Configurations define field behavior (required, hidden, renderer)
- Configuration schemes map configurations to issue types
- Cannot delete configurations in use by schemes

### Permissions
- Permission schemes are project-level
- Some permissions cascade (e.g., "Administer Projects" implies many others)
- Permission checks are complex—use the permission check API

### Notification Schemes
- Notification events are predefined by Jira
- Custom events require Jira admin access
- Email notifications respect user preferences

## Patterns in This Server

### Field Context Operations
When modifying field contexts:
1. Get current contexts for the field
2. Identify the correct context (global vs project-specific)
3. Apply changes to that specific context
4. Verify changes propagated

### Permission Checks
The API distinguishes between:
- `permissions` (what a user CAN do)
- `mypermissions` (what the API user can do)
- `permissionscheme` (scheme configuration)

## Known Issues

### Custom Field Options
- Options for select/multiselect fields are per-context
- Reordering options requires specific API calls
- Cascading select options have parent-child relationships

### Field Configuration Scheme Assignment
- Assigning a scheme to a project can be slow
- The API may return success before the change is fully applied
- Add a brief delay before verifying scheme assignment

### Screen Permissions
- Field visibility on screens is separate from field permissions
- A field can be on a screen but hidden by permissions
- Check both screen configuration and permission scheme

## Testing Notes

- Create test fields with prefix `MCP Test - `
- Use a dedicated test permission scheme
- Field deletions are permanent—test with new fields, not existing ones
