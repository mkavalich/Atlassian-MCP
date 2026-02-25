# Jira System Admin MCP Server

A specialized Model Context Protocol (MCP) server focused on Jira system administration, reporting, and analytics. This server provides 22 comprehensive tools specifically designed for system administrators who need to monitor system health, generate reports, analyze usage, and manage system-level configuration.

## Overview

This server is part of a specialized suite of Jira MCP servers, designed to provide focused system administration capabilities for Jira Cloud instances. It separates system-level administration from project-level management to ensure clean separation of concerns and optimal performance.

### Target Users
- **System Administrators**: Monitor instance health and configuration
- **Analysts**: Generate usage reports and analytics  
- **Auditors**: Access audit logs and system reports
- **IT Managers**: System oversight and performance monitoring
- **Compliance Officers**: Generate compliance and security reports

## Features

### System Administration Tools (17 tools)
- **System Information & Health**: Instance info, limits, license monitoring
- **User & Group Management**: Search users, groups, and manage memberships
- **Permissions & Security**: Check bulk permissions, application roles  
- **Configuration Management**: Application properties, time tracking settings
- **Audit & Compliance**: Audit records, webhook management
- **JQL & Filtering**: Execute queries and create filters
- **System Assets**: Manage avatars and system resources

### Reporting & Analytics Tools (5 tools)
- **Data Export**: Comprehensive project and user data exports
- **System Reports**: Health, configuration, and usage reports  
- **Usage Analytics**: Detailed usage patterns and metrics
- **Health Monitoring**: System diagnostic and performance analysis
- **Custom Reporting**: Flexible report generation with multiple sections

## Complete Tool Reference

### System Administration Tools

#### 1. `search_jql`
**Description**: Search for issues using Jira Query Language (JQL)
**Parameters**:
- `jql` (required, string): The JQL query string
- `startAt` (optional, number, default: 0): The starting index for results
- `maxResults` (optional, number, max: 100, default: 50): Maximum number of results
- `fields` (optional, string[]): List of fields to return for each issue
- `expand` (optional, string): Comma-separated list of fields to expand
- `validateQuery` (optional, enum: 'strict'|'warn'|'none', default: 'strict'): Query validation level

**Usage Example**:
```json
{
  "jql": "project = DEMO AND created >= -7d",
  "maxResults": 25,
  "fields": ["key", "summary", "status", "created"],
  "validateQuery": "strict"
}
```

#### 2. `get_audit_records`
**Description**: Retrieve audit log records for administrative actions
**Parameters**:
- `offset` (optional, number, default: 0): Starting index for results
- `limit` (optional, number, max: 1000, default: 100): Maximum number of records
- `filter` (optional, string): Filter for audit records (e.g., "created > -1d")
- `from` (optional, string): Start date for audit records (ISO 8601 format)
- `to` (optional, string): End date for audit records (ISO 8601 format)

**Usage Example**:
```json
{
  "limit": 50,
  "filter": "category=PERMISSIONS",
  "from": "2024-01-01T00:00:00Z"
}
```

#### 3. `get_instance_info`
**Description**: Retrieve information about the Jira instance
**Parameters**: None

**Usage Example**:
```json
{}
```

#### 4. `get_system_limits`
**Description**: Retrieve system limits and usage information
**Parameters**: None

**Usage Example**:
```json
{}
```

#### 5. `create_filter`
**Description**: Create a new filter with JQL query and share permissions
**Parameters**:
- `name` (required, string, max: 255): The name of the filter
- `jql` (required, string): The JQL query for the filter
- `description` (optional, string): The description of the filter
- `favourite` (optional, boolean): Whether the filter is marked as favourite
- `sharePermissions` (optional, object[]): Share permissions for the filter
  - Each permission object contains:
    - `type` (enum: 'global'|'project'|'group'|'authenticated'|'user'): Permission type
    - `project` (optional, object): Project details for project type permissions
    - `group` (optional, object): Group details for group type permissions
    - `user` (optional, object): User details for user type permissions

**Usage Example**:
```json
{
  "name": "Recent Critical Issues",
  "jql": "priority = Critical AND created >= -7d",
  "description": "Critical issues created in the last week",
  "favourite": true,
  "sharePermissions": [
    {
      "type": "group",
      "group": {"name": "jira-administrators"}
    }
  ]
}
```

#### 6. `search_users`
**Description**: Search for users by name, email, username, or account ID
**Parameters**:
- `query` (optional, string): Search query for users (name, email, or username)
- `username` (optional, string): Exact username to search for
- `accountId` (optional, string): Specific account ID to search for
- `startAt` (optional, number, default: 0): Starting index for results
- `maxResults` (optional, number, max: 1000, default: 50): Maximum number of results
- `includeActive` (optional, boolean, default: true): Include active users
- `includeInactive` (optional, boolean, default: false): Include inactive users

**Usage Example**:
```json
{
  "query": "john.doe",
  "includeActive": true,
  "maxResults": 25
}
```

#### 7. `search_groups`
**Description**: Search for groups by name or pattern
**Parameters**:
- `query` (optional, string): Search query for groups (group name)
- `exclude` (optional, string[]): Group names to exclude from results
- `maxResults` (optional, number, max: 1000, default: 20): Maximum number of results

**Usage Example**:
```json
{
  "query": "admin",
  "exclude": ["jira-administrators"],
  "maxResults": 10
}
```

#### 8. `get_user_groups`
**Description**: Get all groups that a specific user belongs to
**Parameters**:
- `accountId` (required, string): The account ID of the user

**Usage Example**:
```json
{
  "accountId": "557058:f58131cb-b67d-43c7-b30d-6b58d40bd077"
}
```

#### 9. `get_application_roles`
**Description**: Get all available application roles or a specific role
**Parameters**:
- `key` (optional, string): Specific application role key to retrieve

**Usage Example**:
```json
{
  "key": "jira-core-users"
}
```

#### 10. `get_bulk_permissions`
**Description**: Check permissions across multiple projects efficiently
**Parameters**:
- `projectKeys` (required, string[], min: 1, max: 100): Array of project keys to check
- `permissions` (required, string[], min: 1): Array of permission keys to check

**Usage Example**:
```json
{
  "projectKeys": ["PROJ1", "PROJ2", "PROJ3"],
  "permissions": ["BROWSE_PROJECTS", "CREATE_ISSUES", "EDIT_ISSUES"]
}
```

#### 11. `get_application_properties`
**Description**: Get Jira application properties and configuration settings
**Parameters**:
- `key` (optional, string): Specific property key to retrieve
- `keyFilter` (optional, string): Filter properties by key pattern

**Usage Example**:
```json
{
  "keyFilter": "jira.title"
}
```

#### 12. `set_application_property`
**Description**: Set or update a Jira application property configuration
**Parameters**:
- `id` (required, string): The property key/ID
- `value` (required, string): The property value to set

**Usage Example**:
```json
{
  "id": "jira.title",
  "value": "My Jira Instance"
}
```

#### 13. `get_system_avatars`
**Description**: Get all available system avatars for projects, issue types, or users
**Parameters**:
- `type` (required, enum: 'project'|'issuetype'|'user'): The type of avatar

**Usage Example**:
```json
{
  "type": "project"
}
```

#### 14. `get_time_tracking_settings`
**Description**: Get current time tracking configuration and settings
**Parameters**: None

**Usage Example**:
```json
{}
```

#### 15. `update_time_tracking_settings`
**Description**: Update time tracking configuration and working hours
**Parameters**:
- `workingHoursPerDay` (required, number, min: 1, max: 24): Working hours per day
- `workingDaysPerWeek` (required, number, min: 1, max: 7): Working days per week
- `timeFormat` (required, enum: 'pretty'|'days'|'hours'): Time display format
- `defaultUnit` (required, enum: 'minute'|'hour'|'day'|'week'): Default time unit

**Usage Example**:
```json
{
  "workingHoursPerDay": 8,
  "workingDaysPerWeek": 5,
  "timeFormat": "pretty",
  "defaultUnit": "hour"
}
```

#### 16. `get_jira_license`
**Description**: Get current Jira license information and limits
**Parameters**: None

**Usage Example**:
```json
{}
```

#### 17. `get_system_webhooks`
**Description**: Get all configured system webhooks
**Parameters**:
- `startAt` (optional, number, default: 0): Starting index for results
- `maxResults` (optional, number, max: 100, default: 25): Maximum number of results

**Usage Example**:
```json
{
  "startAt": 0,
  "maxResults": 50
}
```

### Reporting & Analytics Tools

#### 18. `export_project_data`
**Description**: Export comprehensive project data including issues, configurations, and metadata
**Parameters**:
- `projectKey` (required, string): The project key to export data for
- `includeIssues` (optional, boolean, default: true): Include issues in export
- `includeWorkflows` (optional, boolean, default: true): Include workflow configurations
- `includePermissions` (optional, boolean, default: true): Include permission schemes
- `includeCustomFields` (optional, boolean, default: true): Include custom field configurations
- `maxIssues` (optional, number, max: 10000, default: 1000): Maximum number of issues to export

**Usage Example**:
```json
{
  "projectKey": "DEMO",
  "includeIssues": true,
  "includeWorkflows": true,
  "includePermissions": true,
  "includeCustomFields": true,
  "maxIssues": 500
}
```

#### 19. `export_user_data`
**Description**: Export user data including profile, groups, permissions, and activity
**Parameters**:
- `accountId` (required, string): The account ID of the user to export data for
- `includeGroups` (optional, boolean, default: true): Include user group memberships
- `includePermissions` (optional, boolean, default: true): Include user permissions
- `includeActivity` (optional, boolean, default: false): Include user activity and issue history

**Usage Example**:
```json
{
  "accountId": "557058:f58131cb-b67d-43c7-b30d-6b58d40bd077",
  "includeGroups": true,
  "includePermissions": true,
  "includeActivity": true
}
```

#### 20. `generate_system_report`
**Description**: Generate comprehensive system health and configuration report
**Parameters**:
- `reportType` (required, enum: 'basic'|'full'|'custom'): Type of system report to generate
- `sections` (optional, enum[]): Specific sections to include (for custom reports)
  - Available sections: 'system', 'license', 'usage', 'security', 'performance'

**Usage Example**:
```json
{
  "reportType": "custom",
  "sections": ["system", "license", "security"]
}
```

#### 21. `generate_usage_analytics`
**Description**: Generate detailed usage analytics and activity reports
**Parameters**:
- `period` (optional, enum: 'week'|'month'|'quarter'|'year'): Predefined time period
- `startDate` (optional, string): Start date for custom period (ISO 8601)
- `endDate` (optional, string): End date for custom period (ISO 8601)
- `includeAuditData` (optional, boolean, default: false): Include audit log data in analytics

**Usage Example**:
```json
{
  "period": "month",
  "includeAuditData": true
}
```

#### 22. `generate_health_check_report`
**Description**: Generate comprehensive system health check and diagnostic report
**Parameters**:
- `checkLevel` (optional, enum: 'basic'|'comprehensive', default: 'basic'): Level of health checks
- `checks` (optional, enum[]): Specific health checks to perform
  - Available checks: 'system', 'license', 'performance', 'security', 'integrations'

**Usage Example**:
```json
{
  "checkLevel": "comprehensive",
  "checks": ["system", "license", "performance", "security"]
}
```

## Installation & Setup

### Prerequisites
- Node.js 18+ 
- Docker (optional, for containerized deployment)
- Jira Cloud instance with administrative access

### Environment Variables
Create a `.env` file with the following required variables:
```bash
JIRA_BASE_URL=https://your-org.atlassian.net
JIRA_EMAIL=your-admin-email@company.com
JIRA_API_TOKEN=your-atlassian-api-token
```

### Local Development
```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start the server
npm start
```

### Docker Deployment
```bash
# Build the Docker image
docker build -f docker/Dockerfile -t jira-system-admin-mcp .

# Run the container
docker run -e JIRA_BASE_URL=https://your-org.atlassian.net \
           -e JIRA_EMAIL=your-email@company.com \
           -e JIRA_API_TOKEN=your-token \
           jira-system-admin-mcp
```

### Docker Compose Integration
Add to your `docker-compose.yaml`:
```yaml
services:
  jira-system-admin:
    build: 
      context: ./jira-system-admin-mcp-server
      dockerfile: docker/Dockerfile
    container_name: mcp-jira-system-admin
    environment:
      - JIRA_BASE_URL=${JIRA_BASE_URL}
      - JIRA_EMAIL=${JIRA_EMAIL}
      - JIRA_API_TOKEN=${JIRA_API_TOKEN}
    networks:
      - mcp-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "console.log('Health check')"]
      interval: 30s
      timeout: 10s
      retries: 3
```

## Usage Examples

### System Health Monitoring
```bash
# Get comprehensive system health report
generate_health_check_report: {
  "checkLevel": "comprehensive",
  "checks": ["license", "performance", "security"]
}

# Check system limits and usage
get_system_limits: {}

# Get instance information
get_instance_info: {}

# Monitor license usage
get_jira_license: {}
```

### Usage Analytics & Reporting
```bash
# Generate monthly usage analytics
generate_usage_analytics: {
  "period": "month",
  "includeAuditData": true
}

# Export project data for analysis
export_project_data: {
  "projectKey": "PROJ",
  "includeIssues": true,
  "includeWorkflows": true,
  "includePermissions": true,
  "maxIssues": 1000
}

# Generate custom system report
generate_system_report: {
  "reportType": "custom",
  "sections": ["system", "license", "usage", "security"]
}
```

### Audit & Compliance
```bash
# Get recent audit records
get_audit_records: {
  "limit": 100,
  "filter": "category=PERMISSIONS",
  "from": "2024-01-01T00:00:00Z"
}

# Check system webhooks
get_system_webhooks: {
  "maxResults": 25
}

# Export user data for compliance
export_user_data: {
  "accountId": "557058:f58131cb-b67d-43c7-b30d-6b58d40bd077",
  "includeGroups": true,
  "includePermissions": true,
  "includeActivity": true
}
```

### User & Permission Management
```bash
# Search for users
search_users: {
  "query": "john.doe",
  "includeActive": true,
  "maxResults": 50
}

# Get user's groups
get_user_groups: {
  "accountId": "557058:f58131cb-b67d-43c7-b30d-6b58d40bd077"
}

# Check permissions across projects
get_bulk_permissions: {
  "projectKeys": ["PROJ1", "PROJ2", "PROJ3"],
  "permissions": ["BROWSE_PROJECTS", "CREATE_ISSUES"]
}

# Search groups
search_groups: {
  "query": "admin",
  "maxResults": 20
}
```

### System Configuration
```bash
# Get application properties
get_application_properties: {
  "keyFilter": "jira."
}

# Update time tracking settings
update_time_tracking_settings: {
  "workingHoursPerDay": 8,
  "workingDaysPerWeek": 5,
  "timeFormat": "pretty",
  "defaultUnit": "hour"
}

# Get system avatars
get_system_avatars: {
  "type": "project"
}
```

## Integration with Claude Code

Add this server to your Claude Code configuration:

```bash
claude mcp add jira-system-admin docker exec -i mcp-jira-system-admin node /app/dist/index.js
```

## Security & Permissions

### Required Jira Permissions
- **Jira System Administrator**: For most system configuration tools
- **Browse Users and Groups**: For user and group management  
- **Administer Projects**: For project-level analytics
- **System Dashboard**: For system health monitoring
- **Audit Log Access**: For audit record retrieval
- **Global Permission Management**: For permission checking tools

### Security Features
- **Input Validation**: All inputs validated with Zod schemas
- **Error Handling**: Comprehensive error handling with secure messages
- **Rate Limiting**: Built-in request rate limiting with axios-retry
- **Audit Logging**: All administrative actions are logged
- **MCP Protocol Compliance**: Secure stdio communication
- **No stdout logging**: All debug output goes to stderr for protocol compliance

## Architecture

### Tool Organization
```
src/
├── tools/
│   ├── system.ts (17 tools)
│   │   ├── System Information & Health
│   │   ├── User & Group Management  
│   │   ├── Permission Management
│   │   ├── Application Configuration
│   │   ├── Time Tracking Settings
│   │   ├── License Management
│   │   └── System Assets & Webhooks
│   └── reporting.ts (5 tools)
│       ├── Data Export (Projects & Users)
│       ├── System Reports
│       ├── Usage Analytics
│       └── Health Check Reports
├── validation/
│   ├── schemas.ts (Response validation)
│   └── input-schemas.ts (Input validation)
├── api/
│   └── client.ts (Jira API client)
├── auth/
│   └── index.ts (Authentication)
└── utils/
    ├── logger.ts (Logging utilities)
    └── errors.ts (Error handling)
```

### Performance Considerations
- **Optimized Queries**: Efficient JQL and API calls
- **Caching**: Built-in response caching for static data
- **Bulk Operations**: Batch API calls where possible
- **Resource Limits**: Configurable limits for large data exports
- **Async Processing**: Non-blocking report generation
- **Retry Logic**: Automatic retry for transient failures

## Monitoring & Troubleshooting

### Health Checks
The server includes comprehensive health monitoring:
- **System connectivity** to Jira API
- **License status** and usage warnings
- **Performance metrics** and thresholds  
- **Security compliance** checks
- **Container health** monitoring

### Common Issues
1. **Permission Errors**: Ensure API token has system admin privileges
2. **Rate Limiting**: Server uses built-in retry mechanisms  
3. **Large Reports**: Adjust maxResults parameters for performance
4. **Audit Access**: Verify audit log permissions in Jira
5. **Memory Usage**: Monitor export sizes for large data exports

### Debugging
```bash
# Check container logs
docker logs mcp-jira-system-admin

# Test API connectivity
get_instance_info: {}

# Verify permissions
get_application_roles: {}

# Check system health
generate_health_check_report: {
  "checkLevel": "basic"
}
```

### Logging
- All logs go to stderr to maintain MCP protocol compliance
- Winston logger with structured logging
- Different log levels: error, warn, info, debug
- Request/response logging available in debug mode

## Development

### Scripts
```bash
npm run build       # Compile TypeScript
npm run dev         # Watch mode development
npm run start       # Start the server
npm run test        # Run tests
npm run test:watch  # Run tests in watch mode
npm run test:coverage # Generate coverage report
npm run lint        # ESLint validation
npm run format      # Prettier formatting
```

### Testing
The server includes comprehensive test coverage:
- Unit tests for all tools
- Integration tests for API client
- Mock responses for consistent testing
- Coverage reporting with Jest

## Contributing

This server is part of a larger MCP server suite. See the main repository for contribution guidelines and development setup.

## License

MIT License - see LICENSE file for details.

## Related Servers

This server works well in combination with:
- **jira-projects-mcp**: Project management and configuration (~35 tools)
- **jira-workflows-mcp**: Workflow and process management (~27 tools)  
- **jira-fields-permissions-mcp**: Field and permission administration (~38 tools)
- **jira-service-desk-mcp**: JSM-specific functionality (~18 tools)
- **jira-organization-mcp**: Organization-level management (~17 tools)
- **jira-admin-mcp**: Legacy comprehensive server (~65+ tools)

## API Reference

All tools return responses in the following format:
```json
{
  "success": true|false,
  "data": { /* tool-specific data */ },
  "error": { /* error details if success is false */ },
  "message": "Human-readable message"
}
```

Error responses include:
- `code`: Error code for programmatic handling
- `message`: Human-readable error message  
- `details`: Additional error context
- `suggestion`: Recommended remediation steps