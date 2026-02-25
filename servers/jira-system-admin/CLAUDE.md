# Jira System Admin Server

## Atlassian API Quirks

### System Configuration
- Most system settings require Jira admin (not just project admin)
- Some settings are read-only in Cloud (configurable only in Data Center)
- Changes may require cache refresh to take effect

### Audit Logs
- Audit log API has date range limits (typically 6 months)
- Log entries are immutable—cannot delete or modify
- Large exports may timeout; use pagination

### Application Properties
- Properties have different scopes (system, user, project)
- Some properties are deprecated but still returned by API
- Not all properties visible in UI are available via API

### Licensing
- License info is read-only via API
- User counts are eventually consistent
- License compliance warnings may lag behind actual state

## Patterns in This Server

### Reporting Tools
The reporting tools generate aggregated views:
- They make multiple API calls internally
- Results are formatted for human readability
- Consider caching for expensive reports

### System Health
Health check tools validate:
- API connectivity
- License status
- Configuration consistency
- Integration health

## Known Issues

### Audit Log Filtering
- Filter parameters are AND-ed together
- Some filter combinations return no results unexpectedly
- Date range is required for large instances

### Application Properties
- Some properties require restart to take effect
- The API doesn't indicate which properties need restart
- Document known restart-required properties

### User/Group Enumeration
- Large instances may have performance issues
- Pagination is essential for user/group lists
- Consider caching group membership

## Testing Notes

- System admin operations affect all users
- Prefer read-only tools for testing
- Audit log tests don't create test entries easily
- License operations are read-only (safe to test)
