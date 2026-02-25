# Jira Service Desk MCP Server

A specialized MCP (Model Context Protocol) server that provides comprehensive Jira Service Management (JSM) administration capabilities, including service desk management, request type configuration, and customer organization analysis.

## Overview

This MCP server focuses specifically on Jira Service Management functionality, providing 13 specialized tools organized into two main categories:

- **Service Desk Management**: 8 tools for managing service desks, request types, and field configurations
- **Customer Organization Analysis**: 5 tools for analyzing customer visibility, organization structures, and troubleshooting Azure AD sync issues

## Features

### Service Desk Management
- Service desk discovery and information retrieval
- Request type creation, modification, and deletion
- Field configuration for request types (visibility, requirements, defaults)
- Customer group access management for request types

### Customer Organization Analysis
- Customer organization structure analysis
- Customer membership tracking across organizations
- Project-specific customer organization relationships
- Comprehensive customer visibility troubleshooting
- Azure AD sync issue diagnosis

### Technical Features
- **Protocol Compliance**: Full MCP stdio transport compatibility
- **Type Safety**: Complete TypeScript implementation with Zod validation
- **Error Handling**: Comprehensive error responses with actionable suggestions
- **Security**: Input validation and sanitization for all parameters
- **Logging**: Structured logging to stderr (MCP compliant)

## Installation

### NPM Installation
```bash
npm install jira-service-desk-mcp-server
```

### Docker Installation
```bash
docker build -t jira-service-desk-mcp-server .
```

## Configuration

### Environment Variables

Create a `.env` file with the following required variables:

```bash
# Required - Jira Configuration
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-api-token
```

### Generating API Tokens

1. Log in to [Atlassian Account Settings](https://id.atlassian.com/manage/api-tokens)
2. Click "Create API token"
3. Give your token a descriptive name (e.g., "JSM MCP Server")
4. Copy the token and use it as `JIRA_API_TOKEN`

### Required Permissions

Your Jira account needs the following permissions:
- **Service Desk Agent** or **Service Desk Administrator** permissions
- **Browse Projects** permission for service projects
- **Administer Projects** permission for modifying request types and configurations

## Usage

### As an MCP Server

#### With Claude Code
```bash
claude mcp add jira-service-desk docker exec -i mcp-jira-service-desk node /app/dist/index.js
```

#### With Claude Desktop
Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "jira-service-desk": {
      "command": "npx",
      "args": ["jira-service-desk-mcp-server"]
    }
  }
}
```

#### With Docker
```bash
docker run -it --env-file .env jira-service-desk-mcp-server
```

## Available Tools

### Service Desk Management Tools

#### `get_service_desks`
List all available service desks in the Jira instance.

**Parameters:**
- `start` (number, optional): Starting index for pagination (default: 0)
- `limit` (number, optional): Maximum results to return (default: 50, max: 100)

**Usage Example:**
```json
{
  "start": 0,
  "limit": 25
}
```

**Response:**
```json
{
  "success": true,
  "serviceDesks": [...],
  "pagination": {
    "size": 25,
    "start": 0,
    "isLastPage": false
  },
  "count": 25
}
```

#### `get_service_desk_info`
Get detailed information about a specific service desk.

**Parameters:**
- `serviceDeskId` (string, required): The ID of the service desk

**Usage Example:**
```json
{
  "serviceDeskId": "1"
}
```

#### `get_request_types`
Get all request types for a specific service desk.

**Parameters:**
- `serviceDeskId` (string, required): The ID of the service desk
- `start` (number, optional): Starting index for pagination (default: 0)
- `limit` (number, optional): Maximum results to return (default: 50, max: 100)
- `expand` (string, optional): Comma-separated fields to expand (e.g., "field")

**Usage Example:**
```json
{
  "serviceDeskId": "1",
  "expand": "field"
}
```

#### `create_request_type`
Create a new request type for a service desk.

**Parameters:**
- `serviceDeskId` (string, required): The ID of the service desk
- `name` (string, required): Request type name (1-255 characters)
- `description` (string, optional): Request type description
- `helpText` (string, optional): Help text displayed to customers
- `issueTypeId` (string, required): ID of the Jira issue type to use
- `groupIds` (array, optional): Customer group names that can access this request type

**Usage Example:**
```json
{
  "serviceDeskId": "1",
  "name": "Hardware Request",
  "description": "Request new hardware equipment",
  "helpText": "Use this form to request laptops, monitors, or other hardware",
  "issueTypeId": "10004",
  "groupIds": ["employees", "contractors"]
}
```

#### `delete_request_type`
Delete a request type from a service desk.

**Parameters:**
- `serviceDeskId` (string, required): The ID of the service desk
- `requestTypeId` (string, required): The ID of the request type to delete

**Usage Example:**
```json
{
  "serviceDeskId": "1",
  "requestTypeId": "25"
}
```

**Warning:** This operation is permanent and may affect existing customer requests.

#### `get_request_type_fields`
Get field configuration for a specific request type.

**Parameters:**
- `serviceDeskId` (string, required): The ID of the service desk
- `requestTypeId` (string, required): The ID of the request type

**Usage Example:**
```json
{
  "serviceDeskId": "1",
  "requestTypeId": "25"
}
```

**Response:**
```json
{
  "success": true,
  "requestTypeFields": [
    {
      "fieldId": "summary",
      "required": true,
      "visible": true,
      "defaultValue": null
    }
  ],
  "count": 5
}
```

#### `update_request_type_fields`
Configure field settings for a request type (visibility, requirements, defaults).

**Parameters:**
- `serviceDeskId` (string, required): The ID of the service desk
- `requestTypeId` (string, required): The ID of the request type
- `requestTypeFields` (array, required): Array of field configuration objects:
  - `fieldId` (string): The ID of the field to configure
  - `required` (boolean, optional): Whether the field is required
  - `visible` (boolean, optional): Whether the field is visible to customers
  - `defaultValues` (array, optional): Default values for the field
  - `presetValues` (array, optional): Preset values available for selection

**Usage Example:**
```json
{
  "serviceDeskId": "1",
  "requestTypeId": "25",
  "requestTypeFields": [
    {
      "fieldId": "summary",
      "required": true,
      "visible": true
    },
    {
      "fieldId": "priority",
      "required": false,
      "visible": true,
      "defaultValues": ["Medium"]
    }
  ]
}
```

#### `get_request_type_groups`
Get customer groups that have access to a specific request type.

**Parameters:**
- `serviceDeskId` (string, required): The ID of the service desk
- `requestTypeId` (string, required): The ID of the request type
- `start` (number, optional): Starting index for pagination (default: 0)
- `limit` (number, optional): Maximum results to return (default: 50, max: 100)

**Usage Example:**
```json
{
  "serviceDeskId": "1",
  "requestTypeId": "25"
}
```

#### `update_request_type_groups`
Update customer group access permissions for a request type.

**Parameters:**
- `serviceDeskId` (string, required): The ID of the service desk
- `requestTypeId` (string, required): The ID of the request type
- `groupNames` (array, required): Array of customer group names to grant access

**Usage Example:**
```json
{
  "serviceDeskId": "1",
  "requestTypeId": "25",
  "groupNames": ["employees", "contractors", "vendors"]
}
```

### Customer Organization Analysis Tools

#### `get_customer_organizations`
List all customer organizations across all service projects.

**Parameters:**
- `limit` (number, optional): Maximum organizations to return (default: 50, max: 1000)
- `start` (number, optional): Starting index for pagination (default: 0)

**Usage Example:**
```json
{
  "limit": 100
}
```

**Response:**
```json
{
  "success": true,
  "organizations": [...],
  "totalOrganizations": 25,
  "analysis": {
    "note": "Customer organizations are containers for grouping customers in JSM",
    "visibilityImpact": "Customer sharing permissions determine if customers can see each other within organizations",
    "azureAdRelevance": "Azure AD synced users should be properly assigned to organizations for visibility"
  }
}
```

#### `get_organization_customers`
List all customers in a specific organization with Azure AD analysis.

**Parameters:**
- `organizationId` (string, required): Organization ID to get customers from
- `limit` (number, optional): Maximum customers to return (default: 50, max: 1000)
- `start` (number, optional): Starting index for pagination (default: 0)

**Usage Example:**
```json
{
  "organizationId": "org-123",
  "limit": 50
}
```

**Response:**
```json
{
  "success": true,
  "customers": [
    {
      "accountId": "user-123",
      "email": "user@company.com",
      "analysis": {
        "accountType": "customer",
        "isAzureADSynced": true,
        "hasExternalDomain": true
      }
    }
  ],
  "analysis": {
    "totalCustomers": 50,
    "azureADSyncedCustomers": 45,
    "troubleshooting": {
      "ifCustomersCantSeeEachOther": "Check project customer permissions and sharing settings",
      "azureAdIssues": "Verify Azure AD sync is working and customers are properly provisioned"
    }
  }
}
```

#### `get_customer_organization_membership`
Check which organizations a specific customer belongs to.

**Parameters:**
- `accountId` (string, optional): Customer account ID to check
- `email` (string, optional): Customer email to check (alternative to accountId)

**Note:** Either `accountId` or `email` must be provided.

**Usage Example:**
```json
{
  "email": "customer@company.com"
}
```

**Response:**
```json
{
  "success": true,
  "customer": {
    "email": "customer@company.com"
  },
  "memberships": [
    {
      "organization": {...},
      "memberDetails": {...},
      "joinedDate": "2024-01-15T10:30:00Z"
    }
  ],
  "analysis": {
    "totalMemberships": 2,
    "visibilityImplication": "Customer can potentially see other customers in 2 organization(s)",
    "troubleshooting": {
      "noMemberships": "If customer cannot see others, they may not be assigned to any organization",
      "azureAdSync": "Check if Azure AD sync is properly assigning customers to organizations"
    }
  }
}
```

#### `get_project_customer_organizations`
List organizations associated with a specific service project.

**Parameters:**
- `projectKey` (string, optional): Service project key
- `serviceDeskId` (string, optional): Service desk ID (alternative to projectKey)

**Note:** Either `projectKey` or `serviceDeskId` must be provided.

**Usage Example:**
```json
{
  "projectKey": "HELP"
}
```

**Response:**
```json
{
  "success": true,
  "project": {
    "projectKey": "HELP",
    "serviceDeskId": "1"
  },
  "organizations": [...],
  "analysis": {
    "totalOrganizations": 5,
    "totalCustomers": 150,
    "averageCustomersPerOrg": 30,
    "troubleshooting": {
      "customerVisibility": "Check Project Settings > Access > Customer permissions > Customer sharing",
      "azureAdCustomers": "Verify Azure AD synced customers are assigned to appropriate organizations"
    }
  }
}
```

#### `analyze_customer_visibility`
Comprehensive analysis of why customers can or cannot see each other in user pickers.

**Parameters:**
- `projectKey` (string, required): Service project key to analyze
- `customerAccountId` (string, optional): Specific customer account ID to analyze

**Usage Example:**
```json
{
  "projectKey": "HELP",
  "customerAccountId": "customer-123"
}
```

**Response:**
```json
{
  "success": true,
  "analysis": {
    "projectKey": "HELP",
    "factors": {
      "customerSharingSettings": {
        "status": "requires_manual_check",
        "description": "Check Project Settings > Access > Customer permissions > Customer sharing",
        "possibleValues": [
          "Customers can search for other customers within their organizations",
          "Customers can search for other customers within their organizations, or manually enter the email address of other customers within their project",
          "Customers can search for other customers within their project or organizations"
        ],
        "recommendation": "Set to 'within their project or organizations' for maximum visibility"
      },
      "organizationMembership": {
        "status": "analysis_needed",
        "note": "Use get_customer_organization_membership tool to check specific customer memberships"
      }
    },
    "commonIssues": {
      "azureAdSyncProblems": [
        "Users synced as wrong account type (licensed instead of customer)",
        "Users not assigned to any customer organizations",
        "Organization email domain mapping issues"
      ],
      "permissionProblems": [
        "Customer sharing set to 'within organizations only' but customers not in organizations",
        "User picker fields have restrictive filtering applied"
      ]
    },
    "diagnosticSteps": [
      "Check customer sharing settings in project permissions",
      "Verify customer organization memberships",
      "Test user picker fields with different customer accounts",
      "Check Azure AD sync status and user provisioning"
    ]
  }
}
```

## Error Handling

All tools return structured error responses with actionable suggestions:

```json
{
  "success": false,
  "error": {
    "code": "GET_SERVICE_DESKS_ERROR",
    "message": "Failed to retrieve service desks",
    "details": "Unauthorized access",
    "suggestion": "Verify you have permission to access service desks"
  }
}
```

### Common Error Codes

- `GET_SERVICE_DESKS_ERROR`: Failed to retrieve service desks
- `GET_SERVICE_DESK_INFO_ERROR`: Failed to get service desk information
- `CREATE_REQUEST_TYPE_ERROR`: Failed to create request type
- `DELETE_REQUEST_TYPE_ERROR`: Failed to delete request type
- `GET_REQUEST_TYPE_FIELDS_ERROR`: Failed to retrieve field configuration
- `UPDATE_REQUEST_TYPE_FIELDS_ERROR`: Failed to update field settings
- `GET_CUSTOMER_ORGANIZATIONS_ERROR`: Failed to retrieve organizations
- `GET_ORGANIZATION_CUSTOMERS_ERROR`: Failed to get organization customers
- `ANALYZE_CUSTOMER_VISIBILITY_ERROR`: Failed to analyze visibility settings

## Use Cases

### Service Desk Administration
- Audit all service desks and their configurations
- Standardize request types across multiple service desks
- Configure field requirements for better data collection
- Manage customer group access to request types

### Customer Visibility Troubleshooting
- Diagnose why customers cannot see each other in user pickers
- Analyze Azure AD sync issues with customer organizations
- Verify customer organization membership assignments
- Troubleshoot customer sharing permission configurations

### Azure AD Integration Analysis
- Identify customers synced from Azure AD
- Verify organization assignments for Azure AD users
- Diagnose customer account type issues
- Analyze domain-based organization mapping

## Docker Usage

### Building the Container
```bash
docker build -t jira-service-desk-mcp-server .
```

### Running with Environment File
```bash
docker run -it --env-file .env jira-service-desk-mcp-server
```

### Docker Compose Integration
```yaml
version: '3.8'
services:
  jira-service-desk:
    build: .
    environment:
      - JIRA_BASE_URL=${JIRA_BASE_URL}
      - JIRA_EMAIL=${JIRA_EMAIL}
      - JIRA_API_TOKEN=${JIRA_API_TOKEN}
    networks:
      - mcp-network
    restart: unless-stopped

networks:
  mcp-network:
    driver: bridge
```

## Security Best Practices

1. **Environment Variables**: Never commit credentials to version control
2. **API Token Security**: Use API tokens instead of passwords
3. **Least Privilege**: Only grant necessary JSM permissions
4. **Input Validation**: All inputs are validated with Zod schemas
5. **Error Handling**: Sensitive information is not exposed in error messages

## Development

### Building from Source
```bash
# Clone and setup
git clone <repository-url>
cd jira-service-desk-mcp-server
npm install

# Build the project
npm run build

# Run in development mode
npm run dev
```

### Testing
```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Project Structure
```
jira-service-desk-mcp-server/
├── src/
│   ├── index.ts                     # MCP server entry point
│   ├── tools/
│   │   ├── service-desk.ts          # Service desk management tools
│   │   └── customer-organizations.ts # Customer analysis tools
│   ├── api/
│   │   └── client.ts                # Jira API client
│   ├── auth/
│   │   └── index.ts                 # Authentication manager
│   ├── validation/
│   │   ├── schemas.ts               # Response validation schemas
│   │   └── input-schemas.ts         # Input validation schemas
│   ├── utils/
│   │   ├── logger.ts                # Winston logger (stderr only)
│   │   └── errors.ts                # Custom error handling
│   └── types/
│       └── index.ts                 # TypeScript type definitions
├── docker/
│   └── Dockerfile                   # Container configuration
├── tests/                           # Test files
└── README.md
```

## Troubleshooting

### Common Issues

1. **Authentication Errors**
   - Verify API token is valid and hasn't expired
   - Ensure email matches the token owner exactly
   - Check that base URL includes `https://` and domain

2. **Permission Errors**
   - Verify you have Service Desk Agent/Administrator permissions
   - Check project-level permissions for specific service projects
   - Ensure your account can access customer organizations

3. **Customer Visibility Issues**
   - Use `analyze_customer_visibility` tool for comprehensive diagnosis
   - Check project customer sharing settings manually
   - Verify Azure AD sync is working properly
   - Use organization membership tools to validate assignments

4. **Request Type Issues**
   - Verify issue type ID exists and is available
   - Check customer group names are correct and exist
   - Ensure service desk ID is valid

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Ensure all tests pass
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

- **GitHub Issues**: Report bugs and request features
- **Documentation**: Comprehensive tool documentation
- **Jira Service Management**: [Official JSM Documentation](https://support.atlassian.com/jira-service-management/)
- **MCP Protocol**: [Model Context Protocol](https://github.com/anthropics/model-context-protocol)

## Acknowledgments

- Built with [Model Context Protocol SDK](https://github.com/anthropics/model-context-protocol)
- Powered by [Atlassian Jira Service Management REST API](https://developer.atlassian.com/cloud/jira/service-desk/)
- TypeScript validation with [Zod](https://github.com/colinhacks/zod)