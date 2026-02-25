# Jira Organization MCP Server

An MCP (Model Context Protocol) server specialized for Atlassian organization administration, providing 17 tools focused on global user management, identity providers, and organization-level settings.

## Overview

This server is designed for **organization administrators** who manage global settings, identity providers, directory synchronization, and organization-wide user management. It's one of the focused MCP servers created by splitting the comprehensive jira-admin-mcp-server into specialized components.

## Target Users

- **Organization Administrators**: Manage global Atlassian organization settings
- **Azure AD/SSO Administrators**: Configure and troubleshoot identity provider integrations
- **Global User Administrators**: Oversee organization-wide user management and access

## Available Tools (17 Total)

### Global Organization Tools (5 tools)

#### `get_organization_info`
**Description**: Retrieve comprehensive organization details and configuration  
**Parameters**: None  
**Current Status**: ✅ **Partially Functional** - Returns Jira instance information  
**Usage**: Basic organization info available through Jira serverInfo API  
**Example**:
```json
{
  "organizationInfo": {
    "baseUrl": "https://yourorg.atlassian.net",
    "version": "9.12.0",
    "deployment": "cloud",
    "serverTitle": "Your Organization Jira"
  }
}
```

#### `get_organization_policies`
**Description**: List all security and access policies at organization level  
**Parameters**: None  
**Current Status**: ⚠️ **Organization API Required**  
**Future API**: `https://api.atlassian.com/admin/v1/orgs/{orgId}/policies`  
**Required Scopes**: `read:org-policies`, `read:org-admin`

#### `get_organization_domains`
**Description**: List all verified domains and their verification status  
**Parameters**: None  
**Current Status**: ⚠️ **Organization API Required**  
**Future API**: `https://api.atlassian.com/admin/v1/orgs/{orgId}/domains`  
**Required Scopes**: `read:org-domains`, `read:org-admin`

#### `get_organization_workspaces`
**Description**: List all product workspaces (Jira, Confluence, etc.)  
**Parameters**: None  
**Current Status**: ⚠️ **Organization API Required**  
**Future API**: `https://api.atlassian.com/admin/v1/orgs/{orgId}/workspaces`  
**Workspace Types**: `jira`, `confluence`, `bitbucket`, `trello`, `jira-service-management`

#### `get_organization_events`
**Description**: Retrieve organization audit events and administrative activities  
**Parameters**:
- `limit` (optional): Maximum number of events to return (default: 50, max: 1000)
- `from` (optional): Start date for events (ISO 8601 format)
- `to` (optional): End date for events (ISO 8601 format)

**Current Status**: ⚠️ **Organization API Required**  
**Future API**: `https://api.atlassian.com/admin/v1/orgs/{orgId}/events`  
**Event Types**: `user-created`, `user-deactivated`, `group-created`, `policy-updated`, `domain-verified`, `sso-configured`

### Identity Providers & Directory Tools (7 tools)

#### `get_identity_providers`
**Description**: List all configured identity providers and their status  
**Parameters**: None  
**Current Status**: ⚠️ **Organization API Required**  
**Future API**: `https://api.atlassian.com/admin/v1/orgs/{orgId}/directories`  
**Supported Providers**: `azure-ad`, `azure-ad-nested-groups`, `scim`, `okta`, `google-workspace`, `onelogin`, `ping-identity`, `generic-saml`

#### `get_directory_info`
**Description**: Get detailed information about specific directory configuration  
**Parameters**:
- `directoryId` (required): Directory ID to get information for

**Current Status**: ⚠️ **Organization API Required**  
**Configuration Fields**: `name`, `type`, `status`, `created`, `lastSyncTime`, `syncEnabled`, `domains`, `userIdentifierAttribute`

#### `get_directory_sync_status`
**Description**: Check sync status and health of directory synchronization  
**Parameters**:
- `directoryId` (optional): Directory ID to check sync status for (checks all if not specified)

**Current Status**: ⚠️ **Organization API Required**  
**Status Fields**: `lastSyncTime`, `lastSyncResult`, `syncInProgress`, `usersSynced`, `groupsSynced`, `errors`, `warnings`  
**Azure AD Specific**: `tenantId`, `applicationId`, `nestedGroupsEnabled`, `domainSync`

#### `get_directory_sync_settings`
**Description**: Get sync configuration including frequency, domains, and group settings  
**Parameters**:
- `directoryId` (required): Directory ID to get sync settings for

**Current Status**: ⚠️ **Organization API Required**  
**Settings**: `enabled`, `frequency`, `userIdentification`, `domains`, `groups`, `syncNestedGroups`  
**Azure AD Settings**: `tenantId`, `clientId`, `userPrincipalNameAttribute`, `emailAttribute`

#### `get_directory_users`
**Description**: List users synced from directories with sync status and attributes  
**Parameters**:
- `directoryId` (optional): Directory ID to get users from (gets from all directories if not specified)
- `limit` (optional): Maximum number of users to return (default: 100, max: 1000)
- `cursor` (optional): Pagination cursor for large result sets

**Current Status**: ⚠️ **Organization API Required**  
**User Fields**: `accountId`, `email`, `displayName`, `active`, `lastActive`, `directoryId`, `syncStatus`  
**Azure AD Fields**: `userPrincipalName`, `objectId`, `tenantId`, `lastSyncTime`, `syncErrors`

#### `get_directory_groups`
**Description**: List groups synced from directories with membership information  
**Parameters**:
- `directoryId` (optional): Directory ID to get groups from (gets from all directories if not specified)
- `limit` (optional): Maximum number of groups to return (default: 100, max: 1000)

**Current Status**: ⚠️ **Organization API Required**  
**Group Fields**: `groupId`, `name`, `displayName`, `memberCount`, `lastSyncTime`, `syncStatus`  
**Azure AD Fields**: `objectId`, `tenantId`, `groupType`, `nestedGroups`, `parentGroups`

#### `get_user_last_active`
**Description**: Get user's last active dates across all Atlassian products  
**Parameters**:
- `accountId` (required): User account ID to get last active dates for

**Current Status**: ⚠️ **Organization API Required**  
**Products**: `jira-software`, `jira-service-management`, `confluence`, `bitbucket`, `trello`, `opsgenie`  
**Activity Fields**: `product`, `lastActiveDate`, `workspaceId`, `activityType`, `licenseType`

### Global User Management Tools (5 tools)

#### `get_organization_users`
**Description**: Get all users in organization with detailed account information  
**Parameters**:
- `limit` (optional): Maximum number of users to return (default: 100, max: 1000)
- `accountType` (optional): Filter by account type (`atlassian`, `customer`, `app`)
- `status` (optional): Filter by account status (`active`, `inactive`, `suspended`)

**Current Status**: ⚠️ **Organization API Required** (provides limited Jira API data)  
**User Fields**: `accountId`, `email`, `displayName`, `accountType`, `accountStatus`, `lastActive`, `productAccess`  
**Azure AD Fields**: `userPrincipalName`, `objectId`, `syncStatus`, `groupMemberships`

#### `search_organization_users`
**Description**: Advanced search for users with filters (domain, type, activity)  
**Parameters**:
- `query` (optional): Search query for user name, email, or display name
- `domain` (optional): Filter by email domain (useful for Azure AD analysis)
- `accountType` (optional): Filter by account type (`atlassian`, `customer`, `app`)
- `lastActiveAfter` (optional): Filter users active after this date (ISO 8601 format)
- `limit` (optional): Maximum number of users to return (default: 50, max: 1000)

**Current Status**: ⚠️ **Organization API Required** (provides limited Jira search)  
**Search Capabilities**: Name/email pattern matching, domain-based filtering, activity-based filtering  
**Azure AD Use Case**: Search users from specific domains to analyze Azure AD sync

#### `get_user_role_assignments`
**Description**: Get user's product access and role assignments across all Atlassian products  
**Parameters**:
- `accountId` (required): User account ID to get role assignments for

**Current Status**: ⚠️ **Organization API Required** (provides limited Jira user info)  
**Role Types**: `product-access`, `site-admin`, `org-admin`, `billing-admin`, `support-admin`  
**Products**: `jira-software`, `jira-service-management`, `confluence`, `bitbucket`, `trello`  
**Analysis**: Product license assignments, administrative roles, site-specific permissions

#### `get_user_group_memberships`
**Description**: Get all groups a user belongs to organization-wide  
**Parameters**:
- `accountId` (required): User account ID to get group memberships for

**Current Status**: ✅ **Partially Functional** - Returns Jira groups, limited organization scope  
**Available**: Jira API group memberships  
**Missing**: Azure AD synced groups, organization-wide groups, cross-product groups

#### `analyze_user_access`
**Description**: Comprehensive analysis of user's access across all products and services  
**Parameters**:
- `accountId` (optional): User account ID to analyze
- `email` (optional): User email to analyze (alternative to accountId)

**Current Status**: ✅ **Functional** - Provides analysis with available Jira data  
**Analysis Includes**:
- Account type identification (customer vs licensed)
- Azure AD sync detection
- Account status and activity
- Customer visibility implications
- Troubleshooting recommendations

**Example Usage**:
```json
{
  "email": "user@yourorg.com"
}
```

**Example Response**:
```json
{
  "analysis": {
    "user": {
      "accountId": "12345",
      "email": "user@yourorg.com", 
      "accountType": "customer",
      "active": true
    },
    "jiraAccess": {
      "hasJiraAccess": true,
      "accountStatus": "active"
    },
    "analysis": {
      "isAzureADSynced": true,
      "accountTypeAnalysis": "Customer account - limited Jira access, can use JSM",
      "visibilityImplications": "Customer accounts have restricted visibility in user pickers"
    },
    "troubleshooting": {
      "customerVisibilityIssues": [
        "Check if user is assigned to customer organizations",
        "Verify JSM project customer sharing settings"
      ]
    }
  }
}
```

## Key Features

### Organization API Integration
Most tools are designed to work with the **Atlassian Organization API**, which provides access to:
- Global organization settings and policies
- Identity provider configurations (Azure AD, SCIM, etc.)
- Cross-product user activity and licensing
- Directory synchronization status and health

**Note**: Full Organization API integration is planned for future releases. Current implementation provides detailed specifications and limited functionality through Jira API where available.

### Azure AD Specialization
Specialized tools for Azure AD environments:
- Directory sync analysis and troubleshooting
- User Principal Name mapping analysis
- Nested group configuration review
- Domain verification status checking

### User Access Analysis
Comprehensive user access analysis including:
- Account type identification (customer vs licensed)
- Product access across all Atlassian products
- Group membership analysis
- Activity tracking and licensing utilization

## Practical Use Cases

### 1. Azure AD Sync Troubleshooting
```bash
# Analyze a user who isn't syncing properly from Azure AD
analyze_user_access: { "email": "problem.user@yourorg.com" }

# Check directory sync status
get_directory_sync_status: { "directoryId": "azure-ad-directory-id" }

# List all identity providers to verify configuration
get_identity_providers: {}
```

### 2. Customer Account Visibility Issues
```bash
# Analyze why a customer user isn't visible in user pickers
analyze_user_access: { "email": "customer@clientorg.com" }

# Check user's group memberships 
get_user_group_memberships: { "accountId": "customer-account-id" }

# Search for users from specific customer domain
search_organization_users: { "domain": "clientorg.com", "accountType": "customer" }
```

### 3. Organization-wide User Audit
```bash
# Get all users with their account types
get_organization_users: { "limit": 500 }

# Search for inactive users
search_organization_users: { "lastActiveAfter": "2023-01-01T00:00:00Z" }

# Get organization audit events
get_organization_events: { "limit": 100, "from": "2024-01-01T00:00:00Z" }
```

### 4. Identity Provider Health Check
```bash
# List all configured identity providers
get_identity_providers: {}

# Check sync status for specific directory
get_directory_sync_status: { "directoryId": "your-directory-id" }

# Get sync configuration details
get_directory_sync_settings: { "directoryId": "your-directory-id" }
```

## Environment Configuration

Required environment variables:
```bash
# Jira API Authentication (base level access)
JIRA_BASE_URL=https://yourorg.atlassian.net
JIRA_EMAIL=your-email@yourorg.com
JIRA_API_TOKEN=your-api-token

# Organization API (for full functionality - future enhancement)
# ATLASSIAN_ORG_API_KEY=your-org-api-key
# ATLASSIAN_ORG_ID=your-org-id
```

## Installation & Usage

### Docker (Recommended)

#### Building the Container
```bash
# Clone the repository (if not already done)
cd jira-organization-mcp-server

# Build the Docker image
docker build -f docker/Dockerfile -t jira-organization-mcp-server .
```

#### Running with Docker Compose
Add to your `docker-compose.yaml`:
```yaml
services:
  jira-organization:
    build:
      context: ./jira-organization-mcp-server
      dockerfile: docker/Dockerfile
    container_name: mcp-jira-organization
    environment:
      - JIRA_BASE_URL=${JIRA_BASE_URL}
      - JIRA_EMAIL=${JIRA_EMAIL}
      - JIRA_API_TOKEN=${JIRA_API_TOKEN}
    networks:
      - mcp-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "console.log('Health check passed')"]
      interval: 30s
      timeout: 3s
      retries: 3

networks:
  mcp-network:
    driver: bridge
```

#### Running Standalone
```bash
docker run -d \
  --name mcp-jira-organization \
  -e JIRA_BASE_URL=${JIRA_BASE_URL} \
  -e JIRA_EMAIL=${JIRA_EMAIL} \
  -e JIRA_API_TOKEN=${JIRA_API_TOKEN} \
  jira-organization-mcp-server
```

### MCP Client Integration

#### Claude Code Integration
```bash
# Add the MCP server to Claude Code
claude mcp add jira-organization docker exec -i mcp-jira-organization node /app/dist/index.js

# Verify the connection
claude mcp list
```

#### Cursor IDE Integration
Add to your Cursor MCP configuration:
```json
{
  "mcpServers": {
    "jira-organization": {
      "command": "docker",
      "args": ["exec", "-i", "mcp-jira-organization", "node", "/app/dist/index.js"]
    }
  }
}
```

#### Claude Desktop Integration
Add to your Claude Desktop configuration:
```json
{
  "mcpServers": {
    "jira-organization": {
      "command": "docker",
      "args": ["exec", "-i", "mcp-jira-organization", "node", "/app/dist/index.js"]
    }
  }
}
```

### Local Development

#### Prerequisites
- Node.js 20 or higher
- npm or yarn package manager
- TypeScript compiler

#### Setup
```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.sample .env
# Edit .env with your Jira credentials

# Build TypeScript
npm run build

# Start the development server with hot reload
npm run dev

# Or start the compiled server
npm start
```

#### Development Scripts
```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Format code
npm run format
```

## Current Limitations

### Organization API Dependency
Most tools require **Atlassian Organization API** access which is not yet implemented:

**Currently Available**:
- ✅ `get_organization_info` - Basic Jira instance information
- ✅ `get_user_group_memberships` - Jira groups only  
- ✅ `analyze_user_access` - Limited analysis with Jira data
- ⚠️ `get_organization_users` - Limited Jira user search
- ⚠️ `search_organization_users` - Limited Jira search capabilities

**Organization API Required** (Future Implementation):
- Identity provider configurations and status
- Directory synchronization monitoring
- Cross-product user activity tracking
- Organization-wide policies and settings
- Complete user role assignments
- Audit events and compliance reporting

### What Each Tool Provides Today

**Working Tools** provide:
1. **Immediate value**: Functional analysis with available Jira data
2. **Troubleshooting insights**: Account type analysis, Azure AD detection
3. **Actionable recommendations**: Customer visibility troubleshooting

**API-Required Tools** provide:
1. **Detailed specifications**: Complete API endpoints and requirements
2. **Implementation roadmap**: Clear path to full functionality
3. **Future-ready structure**: Ready for Organization API integration

## Troubleshooting

### Common Issues

#### 1. Container Won't Start
```bash
# Check Docker logs
docker logs mcp-jira-organization

# Common causes:
# - Missing environment variables
# - Invalid Jira credentials  
# - Network connectivity issues
```

#### 2. MCP Connection Failed
```bash
# Verify container is running
docker ps | grep jira-organization

# Test container health
docker exec mcp-jira-organization node -e "console.log('Container accessible')"

# Check MCP server logs
docker logs mcp-jira-organization 2>&1 | grep -i error
```

#### 3. Authentication Errors
```bash
# Verify environment variables are set
docker exec mcp-jira-organization env | grep JIRA

# Test Jira API access
curl -u "${JIRA_EMAIL}:${JIRA_API_TOKEN}" \
  "${JIRA_BASE_URL}/rest/api/3/serverInfo"
```

#### 4. Tool Returns "Organization API Required"
This is expected behavior for most tools. The error message provides:
- Required API endpoint for future implementation
- Necessary authentication scopes
- Detailed field specifications

### Diagnostic Commands

#### Container Health Check
```bash
# Check if container is healthy
docker inspect mcp-jira-organization | grep Health -A 20

# Manual health check
docker exec mcp-jira-organization node -e "
const { spawn } = require('child_process');
const child = spawn('npm', ['start'], { stdio: 'inherit' });
child.on('error', (error) => console.error('Error:', error));
child.on('exit', (code) => console.log('Process exited with code:', code));
"
```

#### Network Connectivity
```bash
# Test Jira connectivity from container
docker exec mcp-jira-organization curl -I ${JIRA_BASE_URL}/status

# Check container network
docker network inspect mcp-network
```

#### MCP Protocol Testing
```bash
# Test MCP initialization
echo '{"jsonrpc":"2.0","method":"initialize","params":{"capabilities":{}},"id":1}' | \
  docker exec -i mcp-jira-organization node /app/dist/index.js

# Test tool listing
echo '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":2}' | \
  docker exec -i mcp-jira-organization node /app/dist/index.js
```

### Performance Optimization

#### Memory Usage
```bash
# Monitor container memory
docker stats mcp-jira-organization

# Adjust container memory limits if needed
docker run --memory=512m --memory-swap=1g \
  -e JIRA_BASE_URL=${JIRA_BASE_URL} \
  jira-organization-mcp-server
```

#### Response Times
The server includes request timeout handling and retry logic:
- Default timeout: 30 seconds
- Retry attempts: 3
- Exponential backoff for rate limiting

### Getting Help

#### Enable Debug Logging
Set environment variable:
```bash
DEBUG=jira-organization:* docker run ...
```

#### Common Error Messages

**"ORGANIZATION_API_REQUIRED"**
- Expected for most tools
- Indicates future enhancement needed
- Provides implementation specifications

**"Authentication failed"**
- Check JIRA_EMAIL and JIRA_API_TOKEN
- Verify API token has proper permissions
- Test credentials with curl command above

**"Network timeout"**
- Check JIRA_BASE_URL is accessible
- Verify firewall/proxy settings
- Consider increasing timeout values

## Architecture Notes

### MCP Protocol Compliance
- **Clean stdout**: All logging goes to stderr to maintain JSON protocol communication
- **StdioServerTransport**: Uses stdio transport for MCP communication
- **Error handling**: Comprehensive error responses with actionable suggestions
- **Request timeout**: 30-second timeout with retry logic
- **Health checks**: Container health monitoring and diagnostics

### Security Features
- **Read-only focus**: Primarily analysis and reporting tools
- **Input validation**: Zod schema validation for all tool parameters
- **Error sanitization**: Secure error messages without sensitive data exposure
- **Non-root container**: Runs as dedicated `jira` user for security
- **API token authentication**: Secure token-based authentication with Jira

### Code Architecture
```
src/
├── index.ts              # Main server entry point
├── api/
│   └── client.ts         # Jira API client with retry logic
├── auth/
│   └── index.ts          # Authentication management
├── tools/
│   ├── global-organization.ts    # 5 organization tools
│   ├── identity-providers.ts     # 7 identity provider tools
│   └── global-users.ts           # 5 user management tools
├── types/
│   └── index.ts          # TypeScript type definitions
├── utils/
│   ├── errors.ts         # Error handling utilities
│   └── logger.ts         # Logging configuration
└── validation/
    ├── input-schemas.ts   # Zod input validation schemas
    └── schemas.ts         # Additional validation schemas
```

### Future Enhancements

#### Organization API Integration
Planned implementation for full functionality:
```typescript
// Future enhancement structure
interface OrganizationApiClient {
  // Identity providers
  getIdentityProviders(): Promise<IdentityProvider[]>;
  getDirectoryInfo(directoryId: string): Promise<DirectoryInfo>;
  getDirectorySyncStatus(directoryId?: string): Promise<SyncStatus[]>;
  
  // User management
  getOrganizationUsers(filters: UserFilters): Promise<User[]>;
  getUserRoleAssignments(accountId: string): Promise<RoleAssignment[]>;
  
  // Organization settings
  getOrganizationPolicies(): Promise<Policy[]>;
  getOrganizationDomains(): Promise<Domain[]>;
  getOrganizationEvents(filters: EventFilters): Promise<Event[]>;
}
```

#### Enhanced Analytics
Planned features for comprehensive organization analysis:
- Cross-product license utilization tracking
- Azure AD sync health monitoring
- User activity patterns and insights
- Security compliance reporting
- Cost optimization recommendations

## Organizational Focus

This server is specifically designed for organization-level administration tasks:

### Global Scope
- **Cross-product analysis**: User access across all Atlassian products
- **Organization-wide policies**: Security and access policy management
- **Enterprise identity**: Identity provider and directory integration
- **Compliance monitoring**: Audit events and administrative activities

### Identity Management Specialization
- **Azure AD integration**: Comprehensive Azure AD sync analysis
- **Directory synchronization**: Health monitoring and troubleshooting
- **User provisioning**: SCIM and automated user lifecycle management
- **Domain verification**: Organization domain verification status

### User Lifecycle Management
- **Account type analysis**: Customer vs licensed account identification
- **Access patterns**: User activity and licensing utilization
- **Group memberships**: Organization-wide group analysis
- **Troubleshooting**: Customer visibility and access issue resolution

### Compliance & Audit
- **Audit events**: Organization-level administrative activity tracking
- **Policy management**: Security and access policy configuration
- **User access reviews**: Comprehensive user access analysis
- **Compliance reporting**: Organization-wide compliance status

## Related Servers

This server is part of a specialized MCP server architecture designed for comprehensive Jira administration:

### **Core Jira Administration Servers**
- **[jira-admin-mcp-server](../jira-admin-mcp-server/)**: General Jira administration (~65 tools)
- **[jira-projects-mcp-server](../jira-projects-mcp-server/)**: Project management and configuration (~35 tools)
- **[jira-workflows-mcp-server](../jira-workflows-mcp-server/)**: Workflow and process configuration (~27 tools)
- **[jira-fields-permissions-mcp-server](../jira-fields-permissions-mcp-server/)**: Field configuration and permissions (~38 tools)

### **Specialized Servers**
- **[jira-service-desk-mcp-server](../jira-service-desk-mcp-server/)**: JSM administration (~18 tools)
- **[jira-organization-mcp-server](../jira-organization-mcp-server/)**: Organization and user management (~17 tools) **← This Server**
- **[jira-system-admin-mcp-server](../jira-system-admin-mcp-server/)**: System administration and analytics (~22 tools)

### **Server Selection Guide**

**Use this server (jira-organization) for**:
- Organization-wide user management
- Azure AD / identity provider troubleshooting
- Customer account visibility issues
- Cross-product user access analysis
- Directory synchronization monitoring

**Use other servers for**:
- **jira-projects**: Project creation, configuration, and management
- **jira-workflows**: Workflow design and process configuration  
- **jira-fields-permissions**: Custom fields and permission schemes
- **jira-service-desk**: JSM-specific configuration and customer management
- **jira-system-admin**: System performance and analytics

### **Deployment Architecture**
All servers are designed to work together:
- **Independent operation**: Each server can run standalone
- **Shared network**: Common Docker network for inter-server communication
- **Coordinated deployment**: Single docker-compose.yaml for all servers
- **Unified monitoring**: Shared health check and logging infrastructure

## Contributing

### Development Workflow
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/organization-api-integration`
3. Make changes with comprehensive tests
4. Run security scan: `npm run security-check`
5. Submit pull request with detailed description

### Code Standards
- **TypeScript strict mode**: Full type safety
- **ESLint configuration**: Consistent code style
- **Prettier formatting**: Automated code formatting
- **Jest testing**: Comprehensive unit and integration tests
- **Security scanning**: Automated vulnerability detection

### Testing Organization API Integration
When implementing Organization API features:
```bash
# Test with mock Organization API responses
npm run test:org-api-mock

# Integration test with real Organization API (requires credentials)
npm run test:org-api-integration

# Security test for new Organization API endpoints
npm run test:security
```

## License

MIT License - See [LICENSE](LICENSE) file for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/your-org/jira-organization-mcp-server/issues)
- **Documentation**: This README and inline code documentation
- **Community**: MCP Server Architecture discussions
- **Security**: Report security issues privately to security@yourorg.com