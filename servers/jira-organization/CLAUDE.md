# Jira Organization Server

## Atlassian API Quirks

### Admin API vs Jira API
This server uses the **Atlassian Admin API**, not the Jira REST API:
- Base URL: `https://api.atlassian.com/admin/v1/orgs/{orgId}`
- Different authentication: requires organization admin access
- Different rate limits than Jira APIs

### Organization ID
- Required for all Admin API calls
- Found in Atlassian Admin at admin.atlassian.com
- Set via `ATLASSIAN_ORG_ID` environment variable
- Format is a UUID, not a numeric ID

### User Account Types
Atlassian distinguishes between:
- **Atlassian accounts**: Full licensed users
- **Customer accounts**: JSM portal-only users  
- **App accounts**: Service/bot accounts

Some APIs work only with specific account types.

### Directory Sync
- Azure AD, Okta, Google sync happens through Atlassian Access
- Sync status and logs are in Admin API, not Jira API
- User provisioning can be delayed after sync

## Patterns in This Server

### Cross-Product Scope
This server's tools affect the entire Atlassian organization:
- Changes propagate to Jira, Confluence, and other products
- User deactivation affects all products simultaneously
- Be cautious with destructive operations

### Analytics Tools
The analytics and health check tools aggregate data across:
- Multiple Jira sites
- User directories
- Identity providers

They're read-only but can be slow for large organizations.

## Known Issues

### Rate Limiting
- Admin API has stricter rate limits than Jira API
- Bulk user operations may hit limits quickly
- Implement exponential backoff for retries

### User Search
- Search is eventually consistent after user changes
- New users may not appear in search immediately
- Use direct user lookup by ID when possible

### Directory Health
- Health check tools rely on multiple API calls
- Slow or failed APIs affect health assessment
- Timeout handling is important

## Testing Notes

- Admin API changes affect the real organization
- No sandbox/test organization available
- Use extreme caution with user/group modifications
- Prefer read-only tools for testing
