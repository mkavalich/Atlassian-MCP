# Jira Service Desk Server

## Atlassian API Quirks

### Service Desk IDs vs Project IDs
- Service desks have their own ID separate from project ID
- Use `serviceDeskId` for JSM-specific APIs
- Use `projectKey` or `projectId` for standard Jira APIs
- Map between them using `get_service_desk_info`

### Request Types vs Issue Types
- Request types are JSM-specific wrappers around issue types
- One issue type can back multiple request types
- Request types have customer-facing names/descriptions separate from issue type

### Customer vs Agent Permissions
- Customers see a portal view, agents see full Jira
- Some APIs work differently for customer vs agent accounts
- Test with both account types when developing

### Customer Organizations
- Organizations group customers for visibility/permissions
- A customer can belong to multiple organizations
- Organization membership affects what customers see in user pickers

## Patterns in This Server

### Customer Visibility Analysis
The `analyze_customer_visibility` tool is a diagnostic tool that:
- Doesn't modify anything
- Aggregates information from multiple API calls
- Provides troubleshooting guidance

Use it as a pattern for building diagnostic/analysis tools.

### Azure AD Integration
Many customers sync users from Azure AD. Common issues:
- Users created as wrong account type (licensed vs customer)
- Users not assigned to organizations
- Email domain mapping problems

The customer organization tools include Azure AD sync analysis.

## Known Issues

### Request Type Field Configuration
- Field configuration for request types is separate from issue type fields
- Changes to request type fields don't affect the underlying issue type
- Some field types behave differently in portal vs agent view

### Group Names in Request Types
- `groupIds` parameter actually expects group names, not IDs
- The API naming is misleading—it's a known Atlassian inconsistency

### Service Desk Pagination
- Some JSM endpoints use `start`/`limit` instead of `startAt`/`maxResults`
- Check each endpoint's specific pagination parameters

## Testing Notes

- Use a test service desk project, not production
- Customer creation/deletion affects portal access immediately
- Request type changes are visible to customers right away
