# Audit Logging & Compliance Monitoring Tools

## Overview

This document describes the newly implemented org-level READ endpoints for **Audit Logging & Compliance Monitoring** in the jira-system-admin-mcp-server. These tools provide comprehensive security and compliance insights for enterprise Jira administrators.

## Implemented Tools

### 1. Organization Audit Events API

#### `get_org_audit_events`
- **Endpoint**: `GET /v1/orgs/{orgId}/events`
- **Description**: Retrieve comprehensive audit log events for the organization with advanced filtering
- **Required Scope**: `read:audit-log:admin`
- **Parameters**:
  - `orgId` (required): Organization ID
  - `startDate` (optional): Start date for audit events (ISO 8601)
  - `endDate` (optional): End date for audit events (ISO 8601)
  - `eventType` (optional): Filter by specific event type
  - `actor` (optional): Filter by actor who performed the action
  - `resource` (optional): Filter by affected resource
  - `limit` (optional): Maximum events to return (max 1000, default 100)
  - `cursor` (optional): Pagination cursor

#### `get_org_audit_events_stream`
- **Endpoint**: `GET /v1/orgs/{orgId}/events-stream`
- **Description**: Retrieve paginated audit events stream for large-scale audit log analysis
- **Required Scope**: `read:audit-log:admin`
- **Parameters**:
  - `orgId` (required): Organization ID
  - `startDate` (optional): Start date for audit events (ISO 8601)
  - `endDate` (optional): End date for audit events (ISO 8601)
  - `eventType` (optional): Filter by specific event type
  - `limit` (optional): Maximum events per page (max 1000, default 100)
  - `cursor` (optional): Pagination cursor

### 2. Security Policies API

#### `get_org_security_policies`
- **Endpoint**: `GET /admin/control/v2/orgs/{orgId}/policies`
- **Description**: Retrieve all security policies configured for the organization
- **Required Scope**: `read:admin-control:admin`
- **Parameters**:
  - `orgId` (required): Organization ID
  - `policyType` (optional): Filter by policy type (e.g., access-control, data-governance)
  - `status` (optional): Filter by status (active, inactive, all) - default: active

#### `get_org_security_policy`
- **Endpoint**: `GET /admin/control/v2/orgs/{orgId}/policies/{policyId}`
- **Description**: Retrieve detailed information about a specific security policy
- **Required Scope**: `read:admin-control:admin`
- **Parameters**:
  - `orgId` (required): Organization ID
  - `policyId` (required): Specific policy ID

### 3. Authentication Policies API

#### `get_org_auth_policies`
- **Endpoint**: `GET /admin/control/v1/orgs/{orgId}/users/auth-policies/bulk-fetch`
- **Description**: Retrieve authentication policies for users in the organization
- **Required Scope**: `read:auth-policies:admin`
- **Parameters**:
  - `orgId` (required): Organization ID
  - `userIds` (optional): Specific user IDs array
  - `policyType` (optional): Filter by authentication policy type
  - `includeInherited` (optional): Include inherited policies (default: true)

### 4. Data Classification API

#### `get_org_classification_levels`
- **Endpoint**: `GET /orgs/{orgId}/classification-levels`
- **Description**: Retrieve all data classification levels defined for the organization
- **Required Scope**: `read:classification-levels:admin`
- **Parameters**:
  - `orgId` (required): Organization ID
  - `includeInactive` (optional): Include inactive classification levels (default: false)

#### `get_org_classification_level`
- **Endpoint**: `GET /orgs/{orgId}/classification-levels/{levelId}`
- **Description**: Retrieve detailed information about a specific data classification level
- **Required Scope**: `read:classification-levels:admin`
- **Parameters**:
  - `orgId` (required): Organization ID
  - `levelId` (required): Classification level ID

## Authentication Requirements

All these endpoints require **Organization Admin API tokens** with enhanced scopes. The regular site-level API tokens used for standard Jira operations are insufficient.

### Required Setup:
1. Create an Organization Admin API token at: https://id.atlassian.com/manage-profile/security/api-tokens
2. Ensure the token has the required scopes for each tool
3. Configure the `JIRA_ORG_ADMIN_TOKEN` environment variable in your `.env` file

## Automatic Endpoint Detection

The API client automatically detects org-level endpoints and uses the appropriate authentication method:

```typescript
private requiresOrgAdminToken(path: string): boolean {
  const orgAdminEndpoints = [
    '/v1/orgs/',                    // Org-level audit events API
    '/admin/control/v2/orgs/',      // Security policies API
    '/admin/control/v1/orgs/',      // Authentication policies API
    '/orgs/',                       // Data classification API
  ];
  
  return orgAdminEndpoints.some(endpoint => path.startsWith(endpoint));
}
```

## Error Handling

Each tool provides comprehensive error handling with:
- Specific error codes for different failure scenarios
- Clear suggestions for resolving authentication issues
- Required scopes and authentication method information
- Detailed endpoint information for debugging

## Usage Examples

### Retrieve Recent Audit Events
```bash
claude mcp call jira-system-admin get_org_audit_events '{"orgId": "your-org-id", "startDate": "2024-08-01T00:00:00Z", "limit": 100}'
```

### Get Security Policies
```bash
claude mcp call jira-system-admin get_org_security_policies '{"orgId": "your-org-id", "status": "active"}'
```

### Fetch Authentication Policies for Specific Users
```bash
claude mcp call jira-system-admin get_org_auth_policies '{"orgId": "your-org-id", "userIds": ["user1", "user2"], "includeInherited": true}'
```

### List Data Classification Levels
```bash
claude mcp call jira-system-admin get_org_classification_levels '{"orgId": "your-org-id", "includeInactive": false}'
```

## Implementation Details

- **Protocol Compliance**: All tools strictly follow MCP protocol standards with stdio communication
- **READ-Only**: All endpoints are read-only operations for compliance monitoring
- **Security First**: Comprehensive input validation using Zod schemas
- **Error Handling**: Enhanced Atlassian error mapping and analysis
- **Logging**: All operations log to stderr only (MCP compliant)
- **Rate Limiting**: Built-in rate limit detection and handling
- **Retry Logic**: Automatic retry with exponential backoff for transient failures

## File Structure

The implementation spans several files:

- `src/tools/system.ts`: Tool implementations
- `src/validation/schemas.ts`: Zod validation schemas
- `src/validation/input-schemas.ts`: MCP input schemas
- `src/api/client.ts`: Enhanced org admin token detection
- `src/auth/index.ts`: Organization admin authentication support

This provides enterprise Jira administrators with comprehensive audit logging and compliance monitoring capabilities through the MCP protocol.