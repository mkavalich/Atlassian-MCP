# Jira Fields & Permissions MCP Server

A specialized MCP (Model Context Protocol) server that focuses specifically on Jira field configuration and permission management via Atlassian Cloud REST APIs. This server provides comprehensive tools for managing custom fields, field contexts, field configurations, permission schemes, and screen/notification configurations.

## Overview

This server is part of a suite of specialized Jira MCP servers, specifically designed to handle:

- **Field Management**: Create, update, and delete custom fields
- **Field Context Management**: Manage custom field contexts and options
- **Field Configuration Management**: Configure field configurations and schemes
- **Permission Management**: Comprehensive permission scheme and grant management
- **Screen & Notification Management**: Manage screens and notification schemes

## Table of Contents

- [Installation](#installation)
- [Configuration](#configuration)
- [Available Tools](#available-tools)
  - [Field Management Tools](#field-management-tools)
  - [Field Context Management Tools](#field-context-management-tools)
  - [Field Configuration Tools](#field-configuration-tools)
  - [Permission Management Tools](#permission-management-tools)
  - [Screen & Notification Tools](#screen--notification-tools)
- [Docker Setup](#docker-setup)
- [Usage Examples](#usage-examples)
- [Error Handling](#error-handling)
- [Development](#development)

## Installation

### As an MCP Server

```bash
# Install dependencies
npm install

# Build the server
npm run build

# Start the server
npm start
```

### With Docker

```bash
# Build the Docker image
docker build -t jira-fields-permissions-mcp-server -f docker/Dockerfile .

# Run the container
docker run --env-file .env jira-fields-permissions-mcp-server
```

## Configuration

### Environment Variables

Create a `.env` file with the following required variables:

```bash
# Required - Jira Configuration
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-api-token

# Optional - Logging
LOG_LEVEL=info  # debug, info, warn, error
```

### Generating API Tokens

1. Log in to [Atlassian Account Settings](https://id.atlassian.com/manage/api-tokens)
2. Click "Create API token"
3. Give your token a descriptive name
4. Copy the token and use it as `JIRA_API_TOKEN`

**Note**: You must have Jira Administrator permissions to use most tools in this server.

## Available Tools

### Field Management Tools

#### `get_fields_paginated`
Retrieve fields with pagination support, query-based search, and type filtering.

**Parameters:**
- `query` (string, optional): String to search for in field names
- `type` (array, optional): Types of fields to search - can include 'custom', 'system'
- `orderBy` (string, optional): Field to order results by
- `expand` (string, optional): Additional data to include
- `startAt` (number, optional): Starting index for pagination (default: 0)
- `maxResults` (number, optional): Maximum results to return - max 100 (default: 50)

**Example:**
```json
{
  "query": "priority",
  "type": ["custom"],
  "startAt": 0,
  "maxResults": 25
}
```

#### `create_custom_field`
Create a new custom field in Jira.

**Parameters:**
- `name` (string, required): The name of the custom field (1-255 characters)
- `description` (string, optional): The description of the custom field
- `type` (string, required): The type of the custom field (e.g., `com.atlassian.jira.plugin.system.customfieldtypes:textfield`)
- `searcherKey` (string, optional): The searcher key for the custom field

**Example:**
```json
{
  "name": "Customer Priority",
  "description": "Priority level assigned by customer",
  "type": "com.atlassian.jira.plugin.system.customfieldtypes:select",
  "searcherKey": "com.atlassian.jira.plugin.system.customfieldtypes:selectsearcher"
}
```

#### `update_custom_field`
Update the name or description of an existing custom field.

**Parameters:**
- `fieldId` (string, required): The ID of the custom field to update
- `name` (string, optional): The new name of the custom field (1-255 characters)
- `description` (string, optional): The new description of the custom field

**Example:**
```json
{
  "fieldId": "customfield_10001",
  "name": "Updated Customer Priority",
  "description": "Updated description for customer priority field"
}
```

#### `delete_custom_field`
Delete a custom field from Jira.

**Parameters:**
- `fieldId` (string, required): The ID of the custom field to delete

**Example:**
```json
{
  "fieldId": "customfield_10001"
}
```

### Field Context Management Tools

#### `get_custom_field_contexts`
Retrieve all contexts for a custom field with pagination support.

**Parameters:**
- `fieldId` (string, required): The ID of the custom field
- `startAt` (number, optional): Starting index for results (default: 0)
- `maxResults` (number, optional): Maximum results to return - max 100 (default: 50)

#### `create_custom_field_context`
Create a new context for a custom field with project and issue type scoping.

**Parameters:**
- `fieldId` (string, required): The ID of the custom field
- `name` (string, required): The name of the context (1-255 characters)
- `description` (string, optional): The description of the context
- `projectIds` (array, optional): Array of project IDs to scope this context to (empty for global)
- `issueTypeIds` (array, optional): Array of issue type IDs to scope this context to (empty for all issue types)

**Example:**
```json
{
  "fieldId": "customfield_10001",
  "name": "Development Team Context",
  "description": "Context for development projects only",
  "projectIds": ["10001", "10002"],
  "issueTypeIds": ["10001", "10004"]
}
```

#### `update_custom_field_context`
Update an existing custom field context name and/or description.

**Parameters:**
- `fieldId` (string, required): The ID of the custom field
- `contextId` (string, required): The ID of the context to update
- `name` (string, optional): The new name of the context
- `description` (string, optional): The new description of the context

#### `delete_custom_field_context`
Delete a custom field context by field ID and context ID.

**Parameters:**
- `fieldId` (string, required): The ID of the custom field
- `contextId` (string, required): The ID of the context to delete

#### `get_custom_field_options`
Retrieve all options for a custom field context with pagination support.

**Parameters:**
- `fieldId` (string, required): The ID of the custom field
- `contextId` (string, required): The ID of the context
- `startAt` (number, optional): Starting index for results (default: 0)
- `maxResults` (number, optional): Maximum results to return - max 100 (default: 50)

#### `create_custom_field_options`
Create new options for a custom field context.

**Parameters:**
- `fieldId` (string, required): The ID of the custom field
- `contextId` (string, required): The ID of the context
- `options` (array, required): Array of options to create, each containing:
  - `value` (string, required): The value of the option
  - `disabled` (boolean, optional): Whether the option is disabled (default: false)

**Example:**
```json
{
  "fieldId": "customfield_10001",
  "contextId": "10001",
  "options": [
    {"value": "High", "disabled": false},
    {"value": "Medium", "disabled": false},
    {"value": "Low", "disabled": false}
  ]
}
```

### Field Configuration Tools

#### `get_field_configurations`
Retrieve all field configurations in Jira with pagination support.

**Parameters:**
- `startAt` (number, optional): Starting index for results (default: 0)
- `maxResults` (number, optional): Maximum results to return - max 100 (default: 50)

#### `create_field_configuration`
Create a new field configuration with specified name and description.

**Parameters:**
- `name` (string, required): The name of the field configuration (1-255 characters)
- `description` (string, optional): The description of the field configuration

#### `update_field_configuration`
Update an existing field configuration name and/or description.

**Parameters:**
- `id` (number, required): The ID of the field configuration to update
- `name` (string, optional): The new name of the field configuration
- `description` (string, optional): The new description of the field configuration

#### `get_field_configuration_schemes`
Retrieve all field configuration schemes in Jira with pagination support.

**Parameters:**
- `startAt` (number, optional): Starting index for results (default: 0)
- `maxResults` (number, optional): Maximum results to return - max 100 (default: 50)

#### `create_field_configuration_scheme`
Create a new field configuration scheme with mappings between issue types and field configurations.

**Parameters:**
- `name` (string, required): The name of the field configuration scheme (1-255 characters)
- `description` (string, optional): The description of the field configuration scheme
- `fieldConfigurationMappings` (array, optional): Mappings between issue types and field configurations, each containing:
  - `issueTypeId` (string): The ID of the issue type
  - `fieldConfigurationId` (number): The ID of the field configuration

### Permission Management Tools

#### `get_permission_schemes`
Retrieve all permission schemes in Jira.

**Parameters:**
- `expand` (string, optional): Use expand to include additional information

#### `create_permission_scheme`
Create a new permission scheme with specified permissions.

**Parameters:**
- `name` (string, required): The name of the permission scheme (1-255 characters)
- `description` (string, optional): The description of the permission scheme
- `permissions` (array, optional): The permissions to include in the scheme, each containing:
  - `permission` (string): The permission type
  - `holder` (object): Permission holder details
    - `type` (enum): 'anyone', 'assignee', 'reporter', 'user', 'group', 'projectRole', 'applicationRole'
    - `parameter` (string, optional): The parameter for the permission holder

**Example:**
```json
{
  "name": "Development Team Permissions",
  "description": "Permissions for development team members",
  "permissions": [
    {
      "permission": "BROWSE_PROJECTS",
      "holder": {"type": "anyone"}
    },
    {
      "permission": "CREATE_ISSUES",
      "holder": {"type": "group", "parameter": "jira-developers"}
    }
  ]
}
```

#### `assign_permission_scheme_to_project`
Assign a permission scheme to a specific project.

**Parameters:**
- `projectIdOrKey` (string, required): The project ID or key
- `schemeId` (number, required): The ID of the permission scheme to assign

#### `update_permission_scheme`
Update an existing permission scheme name and/or description.

**Parameters:**
- `schemeId` (number, required): The ID of the permission scheme to update
- `name` (string, optional): The new name of the permission scheme
- `description` (string, optional): The new description of the permission scheme

#### `delete_permission_scheme`
Delete a permission scheme by ID.

**Parameters:**
- `schemeId` (number, required): The ID of the permission scheme to delete

#### `get_permission_grants`
Get all permission grants for a specific permission scheme.

**Parameters:**
- `schemeId` (number, required): The ID of the permission scheme
- `expand` (string, optional): Use expand to include additional information

#### `create_permission_grant`
Add a permission grant to a permission scheme.

**Parameters:**
- `schemeId` (number, required): The ID of the permission scheme
- `permission` (string, required): The permission key (e.g., BROWSE_PROJECTS, CREATE_ISSUES, etc.)
- `holder` (object, required): Permission holder details
  - `type` (enum): 'anyone', 'assignee', 'reporter', 'group', 'projectRole', 'user', 'applicationRole'
  - `parameter` (string, optional): The parameter for the holder type

#### `delete_permission_grant`
Remove a permission grant from a permission scheme.

**Parameters:**
- `schemeId` (number, required): The ID of the permission scheme
- `permissionId` (number, required): The ID of the permission grant to delete

#### `get_global_permissions`
Retrieve all global permissions available in Jira with their descriptions and metadata.

**Parameters:**
- `expand` (string, optional): Comma-separated list of fields to expand

#### `get_my_permissions`
Get current user permissions for a specific project, issue, or globally.

**Parameters:**
- `projectKey` (string, optional): The project key to check permissions for
- `projectId` (string, optional): The project ID to check permissions for
- `issueKey` (string, optional): The issue key to check permissions for
- `issueId` (string, optional): The issue ID to check permissions for
- `permissions` (string, optional): Comma-separated list of permission keys to check

#### `get_user_permissions`
Get permissions for a specific user in a project or issue context.

**Parameters:**
- `accountId` (string, required): The account ID of the user to check permissions for
- `projectKey` (string, optional): The project key to check permissions for
- `projectId` (string, optional): The project ID to check permissions for
- `issueKey` (string, optional): The issue key to check permissions for
- `issueId` (string, optional): The issue ID to check permissions for
- `permissions` (string, optional): Comma-separated list of permission keys to check

#### `validate_permissions`
Validate whether specific subjects have certain permissions in given contexts.

**Parameters:**
- `permissions` (array, required): Array of permissions to validate, each containing:
  - `key` (string): The permission key to validate
  - `subject` (object, optional): The subject to validate permissions for
  - `context` (object, optional): The context to validate permissions in

#### `get_permission_scheme_users`
Get all users who have permissions in a specific permission scheme.

**Parameters:**
- `schemeId` (number, required): The ID of the permission scheme
- `startAt` (number, optional): The starting index for results (default: 0)
- `maxResults` (number, optional): The maximum number of results to return (max: 200, default: 50)
- `permission` (string, optional): Filter users by specific permission key

#### `get_project_permissions`
Get permission information for a specific project including effective permissions.

**Parameters:**
- `projectKey` (string, required): The project key to get permissions for
- `permissions` (string, optional): Comma-separated list of permission keys to check
- `expand` (string, optional): Comma-separated list of fields to expand

### Screen & Notification Tools

#### `get_notification_schemes`
Retrieve all notification schemes with pagination support.

**Parameters:**
- `startAt` (number, optional): Starting index for results (default: 0)
- `maxResults` (number, optional): Maximum results to return - max 100 (default: 50)
- `expand` (string, optional): Comma-separated list of fields to expand

#### `create_notification_scheme`
Create a new notification scheme with event notifications.

**Parameters:**
- `name` (string, required): The name of the notification scheme (1-255 characters)
- `description` (string, optional): The description of the notification scheme
- `notificationSchemeEvents` (array, optional): Array of event notifications for the scheme

#### `get_notification_screens`
Retrieve all screens available for notification configuration.

**Parameters:**
- `startAt` (number, optional): Starting index for results (default: 0)
- `maxResults` (number, optional): Maximum results to return - max 100 (default: 50)
- `expand` (string, optional): Comma-separated list of fields to expand

#### `create_notification_screen`
Create a new screen for notification workflows with tabs and fields.

**Parameters:**
- `name` (string, required): The name of the screen (1-255 characters)
- `description` (string, optional): The description of the screen
- `tabs` (array, optional): Array of tabs for the screen

#### `add_field_to_notification_screen`
Add a field to a specific tab on a notification screen.

**Parameters:**
- `screenId` (string, required): The ID of the screen
- `tabId` (string, required): The ID of the tab
- `fieldId` (string, required): The ID of the field to add

## Docker Setup

### Using Docker Compose

Add to your `docker-compose.yaml`:

```yaml
version: '3.8'
services:
  jira-fields-permissions:
    build:
      context: ./jira-fields-permissions-mcp-server
      dockerfile: docker/Dockerfile
    environment:
      - JIRA_BASE_URL=${JIRA_BASE_URL}
      - JIRA_EMAIL=${JIRA_EMAIL}
      - JIRA_API_TOKEN=${JIRA_API_TOKEN}
      - LOG_LEVEL=${LOG_LEVEL:-info}
    restart: unless-stopped
    networks:
      - mcp-network
    healthcheck:
      test: ["CMD", "node", "-e", "console.log('Health check passed')"]
      interval: 30s
      timeout: 3s
      retries: 3

networks:
  mcp-network:
    driver: bridge
```

### Standalone Docker

```bash
# Build the image
docker build -t jira-fields-permissions-mcp-server -f docker/Dockerfile .

# Run with environment variables
docker run -d \
  --name jira-fields-permissions \
  --env-file .env \
  --restart unless-stopped \
  jira-fields-permissions-mcp-server
```

## Usage Examples

### Claude Code Integration

Add the server to your MCP configuration:

```bash
claude mcp add jira-fields-permissions docker exec -i mcp-jira-fields-permissions node /app/dist/index.js
```

### Example Use Cases

#### 1. Setting up a new custom field with context
```json
// First create the custom field
{
  "tool": "create_custom_field",
  "params": {
    "name": "Customer Impact",
    "description": "Level of impact on customers",
    "type": "com.atlassian.jira.plugin.system.customfieldtypes:select"
  }
}

// Create a context for specific projects
{
  "tool": "create_custom_field_context", 
  "params": {
    "fieldId": "customfield_10001",
    "name": "Support Projects Only",
    "description": "Context for customer support projects",
    "projectIds": ["10001", "10002"]
  }
}

// Add options to the context
{
  "tool": "create_custom_field_options",
  "params": {
    "fieldId": "customfield_10001",
    "contextId": "10001",
    "options": [
      {"value": "Critical", "disabled": false},
      {"value": "High", "disabled": false},
      {"value": "Medium", "disabled": false},
      {"value": "Low", "disabled": false}
    ]
  }
}
```

#### 2. Setting up a comprehensive permission scheme
```json
// Create the permission scheme
{
  "tool": "create_permission_scheme",
  "params": {
    "name": "Customer Support Team Permissions",
    "description": "Tailored permissions for customer support operations",
    "permissions": [
      {
        "permission": "BROWSE_PROJECTS",
        "holder": {"type": "anyone"}
      },
      {
        "permission": "CREATE_ISSUES", 
        "holder": {"type": "group", "parameter": "jira-support-agents"}
      },
      {
        "permission": "EDIT_ISSUES",
        "holder": {"type": "assignee"}
      }
    ]
  }
}

// Assign to project
{
  "tool": "assign_permission_scheme_to_project",
  "params": {
    "projectIdOrKey": "SUP",
    "schemeId": 12345
  }
}
```

#### 3. Auditing field usage and permissions
```json
// Get all custom fields
{
  "tool": "get_fields_paginated",
  "params": {
    "type": ["custom"],
    "maxResults": 100
  }
}

// Check current user's permissions in a project
{
  "tool": "get_my_permissions", 
  "params": {
    "projectKey": "SUP",
    "permissions": "BROWSE_PROJECTS,CREATE_ISSUES,EDIT_ISSUES,DELETE_ISSUES"
  }
}

// Validate specific permissions for users
{
  "tool": "validate_permissions",
  "params": {
    "permissions": [
      {
        "key": "CREATE_ISSUES",
        "subject": {
          "type": "user",
          "id": "user123"
        },
        "context": {
          "project": {"key": "SUP"}
        }
      }
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
    "code": "PERMISSION_DENIED",
    "message": "You don't have permission to create custom fields",
    "details": { ... },
    "suggestion": "Request Jira Administrator permissions from your Jira administrator"
  }
}
```

### Common Error Codes

- `AUTH_ERROR`: Authentication failed - check API token
- `PERMISSION_DENIED`: Insufficient permissions - need Jira Administrator access
- `VALIDATION_ERROR`: Invalid input parameters
- `NOT_FOUND`: Resource not found
- `FIELD_CONFIGURATION_ERROR`: Field configuration issues
- `CONTEXT_ERROR`: Custom field context problems

## Development

### Building from Source

```bash
# Clone and install
git clone <repository-url>
cd jira-fields-permissions-mcp-server
npm install

# Build
npm run build

# Run in development mode
npm run dev

# Run tests
npm test
npm run test:coverage
```

### Project Structure

```
jira-fields-permissions-mcp-server/
├── src/
│   ├── index.ts                    # MCP server entry point
│   ├── tools/                      # Tool implementations
│   │   ├── fields.ts              # Field management tools
│   │   ├── field-contexts.ts      # Field context tools
│   │   ├── field-configurations.ts # Field configuration tools
│   │   ├── permissions.ts         # Permission management tools
│   │   └── notifications-screens.ts # Screen and notification tools
│   ├── api/                       # Jira API client
│   │   └── client.ts              # API client with retry logic
│   ├── auth/                      # Authentication
│   │   └── index.ts               # Auth manager
│   ├── validation/                # Input validation
│   │   ├── schemas.ts             # Zod validation schemas
│   │   └── input-schemas.ts       # Input schema definitions
│   ├── utils/                     # Utilities
│   │   ├── logger.ts              # Winston logger
│   │   └── errors.ts              # Custom error classes
│   └── types/                     # TypeScript types
│       └── index.ts               # Type definitions
├── tests/                         # Test files
├── docker/                        # Docker configuration
│   └── Dockerfile
├── package.json
├── tsconfig.json
└── README.md
```

## Security Best Practices

1. **API Token Security**: Never commit API tokens to version control
2. **Least Privilege**: Only request necessary Jira permissions
3. **Input Validation**: All inputs are validated with Zod schemas
4. **Audit Logging**: All administrative actions are logged
5. **Container Security**: Runs as non-root user in Docker

## Support

- **Issues**: Report issues in the project repository
- **Documentation**: [Atlassian Jira Cloud REST API v3](https://developer.atlassian.com/cloud/jira/platform/rest/v3/)
- **MCP Protocol**: [Model Context Protocol Documentation](https://github.com/anthropics/model-context-protocol)

## License

MIT License - see LICENSE file for details.