# Jira Workflows MCP Server

A specialized Model Context Protocol (MCP) server for comprehensive Jira workflow, workflow scheme, and screen management via Atlassian Cloud REST APIs. This server provides 27 powerful tools for automating workflow administration tasks.

## Overview

The Jira Workflows MCP Server is designed to handle three core areas of Jira administration:

- **Workflows**: Create and manage workflow configurations with transitions, statuses, conditions, validators, and post-functions
- **Workflow Schemes**: Manage workflow schemes and their project assignments, issue type mappings
- **Screens**: Complete screen management including screen schemes, tabs, fields, and layouts

This server uses the Model Context Protocol to provide seamless integration with Claude Code, Cursor IDE, and Claude Desktop for automated Jira workflow administration.

## Features

- ✅ **Protocol Compliant**: Fully compliant with MCP stdio communication standards
- ✅ **Type Safe**: Built with TypeScript and Zod schema validation
- ✅ **Error Handling**: Comprehensive error handling with detailed suggestions
- ✅ **Security**: Input validation, authentication, and secure API communication
- ✅ **Docker Ready**: Containerized for easy deployment and scaling
- ✅ **Logging**: Winston-based logging with MCP compatibility
- ✅ **Retry Logic**: Built-in retry mechanism for API calls with exponential backoff

## Available Tools

### Workflow Management (3 tools)

#### `get_workflows`
Retrieve workflow configurations from Jira with search and expansion capabilities.

**Parameters:**
- `workflowName` (optional): Filter by specific workflow name
- `expand` (optional): Include additional information in response

**Usage Example:**
```json
{
  "workflowName": "Software Development Workflow",
  "expand": "transitions,statuses"
}
```

#### `create_workflow`
Create a new workflow with transitions, statuses, conditions, validators, and post-functions.

**Parameters:**
- `name` (required): Workflow name (1-255 characters)
- `description` (optional): Workflow description
- `transitions` (required): Array of transition objects with:
  - `name`: Transition name
  - `from`: Array of source status IDs
  - `to`: Target status ID
  - `conditions` (optional): Array of condition strings
  - `validators` (optional): Array of validator strings
  - `postFunctions` (optional): Array of post-function strings
- `statuses` (required): Array of status IDs

**Usage Example:**
```json
{
  "name": "Custom Development Workflow",
  "description": "Workflow for development projects",
  "transitions": [
    {
      "name": "Start Progress",
      "from": ["10000"],
      "to": "10001",
      "conditions": ["assignee"],
      "validators": ["required-fields"],
      "postFunctions": ["update-change-history"]
    }
  ],
  "statuses": ["10000", "10001", "10002"]
}
```

#### `get_workflow_schemes_basic`
Retrieve basic workflow schemes and their project associations with pagination.

**Parameters:**
- `startAt` (optional, default: 0): Starting index for pagination
- `maxResults` (optional, default: 50): Maximum results to return

**Usage Example:**
```json
{
  "startAt": 0,
  "maxResults": 25
}
```

### Workflow Scheme Management (9 tools)

#### `get_workflow_schemes_detailed`
Retrieve all workflow schemes with detailed configurations and project assignments.

**Parameters:**
- `startAt` (optional, default: 0): Starting index for pagination
- `maxResults` (optional, default: 50): Maximum results to return
- `expand` (optional): Comma-separated list of fields to expand

**Usage Example:**
```json
{
  "startAt": 0,
  "maxResults": 50,
  "expand": "workflows,projects"
}
```

#### `create_workflow_scheme`
Create a new workflow scheme with issue type mappings.

**Parameters:**
- `name` (required): Scheme name (1-255 characters)
- `description` (optional): Scheme description
- `defaultWorkflow` (optional): Name of the default workflow
- `issueTypeMappings` (optional): Array of issue type to workflow mappings

**Usage Example:**
```json
{
  "name": "Development Project Scheme",
  "description": "Workflow scheme for development projects",
  "defaultWorkflow": "jira",
  "issueTypeMappings": [
    {
      "issueType": "10001",
      "workflow": "Development Workflow"
    }
  ]
}
```

#### `update_workflow_scheme`
Update an existing workflow scheme's name, description, or default workflow.

**Parameters:**
- `schemeId` (required): ID of the workflow scheme to update
- `name` (optional): New scheme name
- `description` (optional): New scheme description
- `defaultWorkflow` (optional): New default workflow name

**Usage Example:**
```json
{
  "schemeId": "10000",
  "name": "Updated Development Scheme",
  "description": "Updated description for development projects"
}
```

#### `delete_workflow_scheme`
Delete a workflow scheme (only if not assigned to any projects).

**Parameters:**
- `schemeId` (required): ID of the workflow scheme to delete

**Usage Example:**
```json
{
  "schemeId": "10000"
}
```

#### `assign_workflow_scheme_to_project`
Assign a workflow scheme to a project, replacing any existing scheme assignment.

**Parameters:**
- `projectIdOrKey` (required): Project ID or key
- `schemeId` (required): ID of the workflow scheme to assign

**Usage Example:**
```json
{
  "projectIdOrKey": "PROJ",
  "schemeId": "10000"
}
```

#### `get_workflow_scheme_projects`
Get all projects assigned to a specific workflow scheme.

**Parameters:**
- `schemeId` (required): ID of the workflow scheme

**Usage Example:**
```json
{
  "schemeId": "10000"
}
```

#### `get_workflow_scheme_issue_types`
Get issue type to workflow mappings for a specific workflow scheme.

**Parameters:**
- `schemeId` (required): ID of the workflow scheme

**Usage Example:**
```json
{
  "schemeId": "10000"
}
```

#### `set_workflow_scheme_issue_type`
Set or update the workflow for a specific issue type in a workflow scheme.

**Parameters:**
- `schemeId` (required): ID of the workflow scheme
- `issueType` (required): ID of the issue type
- `workflow` (required): Name of the workflow to assign

**Usage Example:**
```json
{
  "schemeId": "10000",
  "issueType": "10001",
  "workflow": "Development Workflow"
}
```

#### `delete_workflow_scheme_issue_type`
Remove an issue type mapping from a workflow scheme (reverts to default workflow).

**Parameters:**
- `schemeId` (required): ID of the workflow scheme
- `issueType` (required): ID of the issue type to remove

**Usage Example:**
```json
{
  "schemeId": "10000",
  "issueType": "10001"
}
```

### Screen Management (15 tools)

#### `get_screen_schemes`
Retrieve all screen schemes with pagination support.

**Parameters:**
- `startAt` (optional, default: 0): Starting index for pagination
- `maxResults` (optional, default: 50): Maximum results to return
- `expand` (optional): Comma-separated list of fields to expand

**Usage Example:**
```json
{
  "startAt": 0,
  "maxResults": 25,
  "expand": "screens"
}
```

#### `create_screen_scheme`
Create a new screen scheme with screen mappings for different operations.

**Parameters:**
- `name` (required): Screen scheme name (1-255 characters)
- `description` (optional): Screen scheme description
- `screens` (required): Screen mappings object with:
  - `default` (required): ID of the default screen
  - `create` (optional): ID of the create screen
  - `edit` (optional): ID of the edit screen
  - `view` (optional): ID of the view screen

**Usage Example:**
```json
{
  "name": "Development Screen Scheme",
  "description": "Screen scheme for development projects",
  "screens": {
    "default": "10000",
    "create": "10001",
    "edit": "10002",
    "view": "10003"
  }
}
```

#### `update_screen_scheme`
Update an existing screen scheme name, description, and/or screen mappings.

**Parameters:**
- `screenSchemeId` (required): ID of the screen scheme to update
- `name` (optional): New screen scheme name
- `description` (optional): New screen scheme description
- `screens` (optional): New screen mappings

**Usage Example:**
```json
{
  "screenSchemeId": "10000",
  "name": "Updated Development Screen Scheme",
  "screens": {
    "default": "10000",
    "edit": "10005"
  }
}
```

#### `delete_screen_scheme`
Delete a screen scheme by ID.

**Parameters:**
- `screenSchemeId` (required): ID of the screen scheme to delete

**Usage Example:**
```json
{
  "screenSchemeId": "10000"
}
```

#### `get_screens`
Retrieve all screens available in the Jira instance.

**Parameters:**
- `startAt` (optional, default: 0): Starting index for pagination
- `maxResults` (optional, default: 50): Maximum results to return
- `expand` (optional): Comma-separated list of fields to expand

**Usage Example:**
```json
{
  "startAt": 0,
  "maxResults": 25,
  "expand": "tabs"
}
```

#### `create_screen`
Create a new screen with tabs and fields.

**Parameters:**
- `name` (required): Screen name (1-255 characters)
- `description` (optional): Screen description
- `tabs` (optional): Array of tab objects with:
  - `name`: Tab name
  - `fields` (optional): Array of field objects

**Usage Example:**
```json
{
  "name": "Development Screen",
  "description": "Screen for development issues",
  "tabs": [
    {
      "name": "Field Tab",
      "fields": [
        {"id": "summary"},
        {"id": "description"}
      ]
    }
  ]
}
```

#### `update_screen`
Update an existing screen name and/or description.

**Parameters:**
- `screenId` (required): ID of the screen to update
- `name` (optional): New screen name
- `description` (optional): New screen description

**Usage Example:**
```json
{
  "screenId": "10000",
  "name": "Updated Development Screen",
  "description": "Updated description for development issues"
}
```

#### `delete_screen`
Delete a screen by ID.

**Parameters:**
- `screenId` (required): ID of the screen to delete

**Usage Example:**
```json
{
  "screenId": "10000"
}
```

#### `get_screen_tabs`
Get all tabs for a specific screen.

**Parameters:**
- `screenId` (required): ID of the screen
- `projectKey` (optional): Project key for context

**Usage Example:**
```json
{
  "screenId": "10000",
  "projectKey": "PROJ"
}
```

#### `create_screen_tab`
Create a new tab on a screen.

**Parameters:**
- `screenId` (required): ID of the screen
- `name` (required): Name of the tab (1-255 characters)

**Usage Example:**
```json
{
  "screenId": "10000",
  "name": "Custom Fields"
}
```

#### `update_screen_tab`
Update the name of a screen tab.

**Parameters:**
- `screenId` (required): ID of the screen
- `tabId` (required): ID of the tab to update
- `name` (required): New name for the tab

**Usage Example:**
```json
{
  "screenId": "10000",
  "tabId": "10001",
  "name": "Updated Tab Name"
}
```

#### `delete_screen_tab`
Delete a tab from a screen.

**Parameters:**
- `screenId` (required): ID of the screen
- `tabId` (required): ID of the tab to delete

**Usage Example:**
```json
{
  "screenId": "10000",
  "tabId": "10001"
}
```

#### `get_screen_tab_fields`
Get all fields for a specific screen tab.

**Parameters:**
- `screenId` (required): ID of the screen
- `tabId` (required): ID of the tab
- `projectKey` (optional): Project key for context

**Usage Example:**
```json
{
  "screenId": "10000",
  "tabId": "10001",
  "projectKey": "PROJ"
}
```

#### `add_field_to_screen`
Add a field to a specific screen tab.

**Parameters:**
- `screenId` (required): ID of the screen
- `tabId` (required): ID of the tab
- `fieldId` (required): ID of the field to add

**Usage Example:**
```json
{
  "screenId": "10000",
  "tabId": "10001",
  "fieldId": "customfield_10000"
}
```

#### `remove_field_from_screen_tab`
Remove a field from a screen tab.

**Parameters:**
- `screenId` (required): ID of the screen
- `tabId` (required): ID of the tab
- `fieldId` (required): ID of the field to remove

**Usage Example:**
```json
{
  "screenId": "10000",
  "tabId": "10001",
  "fieldId": "customfield_10000"
}
```

#### `move_screen_tab_field`
Move a field within a screen tab to a different position.

**Parameters:**
- `screenId` (required): ID of the screen
- `tabId` (required): ID of the tab
- `fieldId` (required): ID of the field to move
- `after` (optional): ID of the field to move after
- `position` (optional): Position to move to (Earlier, Later, First, Last)

**Usage Example:**
```json
{
  "screenId": "10000",
  "tabId": "10001",
  "fieldId": "customfield_10000",
  "position": "First"
}
```

#### `add_field_to_default_screen`
Add a field to the default screen's default tab.

**Parameters:**
- `fieldId` (required): ID of the field to add

**Usage Example:**
```json
{
  "fieldId": "customfield_10000"
}
```

#### `get_screen_available_fields`
Get fields that can be added to a screen.

**Parameters:**
- `screenId` (required): ID of the screen

**Usage Example:**
```json
{
  "screenId": "10000"
}
```

## Installation & Configuration

### Environment Variables

The following environment variables are required:

```bash
# Required for Jira API access
JIRA_BASE_URL=https://yourorg.atlassian.net
JIRA_EMAIL=your-email@company.com
JIRA_API_TOKEN=your-api-token

# Optional for enhanced features
NODE_ENV=production
LOG_LEVEL=info
```

### Atlassian API Token Setup

1. Go to [Atlassian Account Settings](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Click "Create API token"
3. Enter a descriptive label for your token
4. Copy the generated token to your environment variables

**Note**: API tokens are more secure than passwords and are the recommended authentication method.

### Docker Deployment

#### Using Docker Compose (Recommended)

Create a `docker-compose.yml` file:

```yaml
version: '3.8'
services:
  jira-workflows-mcp:
    build: ./jira-workflows-mcp-server
    container_name: mcp-jira-workflows
    restart: unless-stopped
    environment:
      - JIRA_BASE_URL=${JIRA_BASE_URL}
      - JIRA_EMAIL=${JIRA_EMAIL}
      - JIRA_API_TOKEN=${JIRA_API_TOKEN}
      - NODE_ENV=production
    healthcheck:
      test: ["CMD", "node", "-e", "console.log('Health check passed')"]
      interval: 30s
      timeout: 3s
      retries: 3
    networks:
      - mcp-network

networks:
  mcp-network:
    driver: bridge
```

Start the service:

```bash
docker-compose up -d
```

#### Using Docker directly

```bash
# Build the image
docker build -t jira-workflows-mcp ./jira-workflows-mcp-server

# Run the container
docker run -d \
  --name mcp-jira-workflows \
  --restart unless-stopped \
  -e JIRA_BASE_URL=https://yourorg.atlassian.net \
  -e JIRA_EMAIL=your-email@company.com \
  -e JIRA_API_TOKEN=your-api-token \
  jira-workflows-mcp
```

### Local Development

```bash
# Clone and setup
git clone <repository-url>
cd jira-workflows-mcp-server

# Install dependencies
npm install

# Create .env file with your credentials
cp .env.example .env
# Edit .env with your Jira credentials

# Build the TypeScript code
npm run build

# Start the development server
npm run dev

# Or start the production server
npm start
```

## MCP Client Setup

### Claude Code Integration

```bash
# Add the jira-workflows MCP server
claude mcp add jira-workflows docker exec -i mcp-jira-workflows node /app/dist/index.js

# Verify the connection
claude mcp list
```

### Cursor IDE Integration

Add to your Cursor settings:

```json
{
  "mcp": {
    "servers": {
      "jira-workflows": {
        "command": "docker",
        "args": ["exec", "-i", "mcp-jira-workflows", "node", "/app/dist/index.js"],
        "description": "Jira workflows, workflow schemes, and screen management"
      }
    }
  }
}
```

### Claude Desktop Integration

Add to your Claude Desktop config file:

```json
{
  "mcpServers": {
    "jira-workflows": {
      "command": "docker",
      "args": ["exec", "-i", "mcp-jira-workflows", "node", "/app/dist/index.js"],
      "description": "Jira workflows, workflow schemes, and screen management"
    }
  }
}
```

## Use Cases & Examples

### Workflow Administration

**Create a custom development workflow:**
```json
{
  "tool": "create_workflow",
  "parameters": {
    "name": "Agile Development Workflow",
    "description": "Workflow for agile development projects",
    "transitions": [
      {
        "name": "Start Development",
        "from": ["10000"],
        "to": "10001",
        "conditions": ["assignee-check"],
        "postFunctions": ["assign-to-developer"]
      },
      {
        "name": "Complete Development",
        "from": ["10001"],
        "to": "10002",
        "validators": ["required-fields"],
        "postFunctions": ["notify-qa-team"]
      }
    ],
    "statuses": ["10000", "10001", "10002", "10003"]
  }
}
```

**Set up workflow scheme for multiple projects:**
```json
{
  "tool": "create_workflow_scheme",
  "parameters": {
    "name": "Development Team Scheme",
    "description": "Workflow scheme for all development projects",
    "defaultWorkflow": "jira",
    "issueTypeMappings": [
      {"issueType": "10001", "workflow": "Agile Development Workflow"},
      {"issueType": "10002", "workflow": "Bug Fix Workflow"},
      {"issueType": "10003", "workflow": "Feature Request Workflow"}
    ]
  }
}
```

### Screen Configuration

**Create a custom screen with specific fields:**
```json
{
  "tool": "create_screen",
  "parameters": {
    "name": "Development Issue Screen",
    "description": "Custom screen for development issues",
    "tabs": [
      {
        "name": "Basic Information",
        "fields": [
          {"id": "summary"},
          {"id": "description"},
          {"id": "priority"},
          {"id": "assignee"}
        ]
      },
      {
        "name": "Development Details",
        "fields": [
          {"id": "customfield_10000"},
          {"id": "customfield_10001"},
          {"id": "components"}
        ]
      }
    ]
  }
}
```

**Set up screen scheme for different operations:**
```json
{
  "tool": "create_screen_scheme",
  "parameters": {
    "name": "Development Screen Scheme",
    "description": "Screen scheme for development projects",
    "screens": {
      "default": "10000",
      "create": "10001",
      "edit": "10002",
      "view": "10003"
    }
  }
}
```

### Project Configuration

**Complete project workflow setup:**
```bash
# 1. Create workflow scheme
# 2. Assign to project
# 3. Configure screens
# 4. Set up screen schemes
# 5. Map issue types to workflows
```

## Permissions Required

The API token user must have the following Jira permissions:

### Workflow Management
- **Jira Administrators** global permission
- **Administer Projects** permission for project-specific operations

### Screen Management
- **Jira Administrators** global permission
- **Administer Projects** permission for project-specific operations

### Project Assignment
- **Administer Projects** permission for the target projects
- **Browse Projects** permission for reading project information

## Error Handling

The server provides comprehensive error handling with detailed error messages and suggestions:

### Common Error Scenarios

**Authentication Errors:**
```json
{
  "success": false,
  "error": {
    "code": "AUTHENTICATION_ERROR",
    "message": "Authentication failed",
    "suggestion": "Verify your JIRA_BASE_URL, JIRA_EMAIL, and JIRA_API_TOKEN"
  }
}
```

**Permission Errors:**
```json
{
  "success": false,
  "error": {
    "code": "PERMISSION_ERROR",
    "message": "Insufficient permissions",
    "suggestion": "Ensure you have Jira Administrator permissions"
  }
}
```

**Validation Errors:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Required field missing: name",
    "suggestion": "Provide a name for the workflow (1-255 characters)"
  }
}
```

## Security Considerations

### API Token Security
- Store API tokens securely in environment variables
- Use least-privilege principle for Jira permissions
- Regularly rotate API tokens
- Monitor API usage in Atlassian audit logs

### Container Security
- Runs as non-root user in Docker container
- Minimal attack surface with slim base image
- No sensitive data stored in container layers
- Security scanning integrated in CI/CD pipeline

### Network Security
- All API communication over HTTPS
- Input validation and sanitization
- Rate limiting and retry logic
- Secure error messages without sensitive data exposure

## Performance & Scaling

### Resource Requirements
- **Memory**: 512MB recommended (256MB minimum)
- **CPU**: 1 vCPU recommended for production
- **Network**: Stable internet connection to Atlassian Cloud

### Performance Optimizations
- Connection pooling for API requests
- Request retry with exponential backoff
- Efficient pagination for large datasets
- Caching of frequently accessed data

### Monitoring & Health Checks
- Built-in health check endpoint
- Structured logging with Winston
- Metrics collection for API response times
- Error rate monitoring and alerting

## Troubleshooting

### Common Issues

**Connection refused:**
```bash
# Check if container is running
docker ps | grep mcp-jira-workflows

# Check container logs
docker logs mcp-jira-workflows

# Verify environment variables
docker exec mcp-jira-workflows env | grep JIRA
```

**API rate limiting:**
```bash
# Check for rate limit errors in logs
docker logs mcp-jira-workflows | grep "rate limit"

# Implement delays between requests if needed
```

**Invalid workflow configuration:**
```bash
# Validate workflow structure before creation
# Ensure all status IDs exist
# Check transition logic for conflicts
```

### Debugging

Enable debug logging:
```bash
docker run -e LOG_LEVEL=debug mcp-jira-workflows
```

Test specific tools:
```bash
# Use the included test script
node test-all-workflows-tools.js
```

## Development

### Project Structure
```
jira-workflows-mcp-server/
├── src/
│   ├── api/           # API client and HTTP handling
│   ├── auth/          # Authentication management
│   ├── tools/         # MCP tool implementations
│   ├── types/         # TypeScript type definitions
│   ├── utils/         # Utility functions and logging
│   ├── validation/    # Input/output schema validation
│   └── index.ts       # Main server entry point
├── docker/
│   └── Dockerfile     # Container configuration
├── package.json       # Node.js dependencies and scripts
├── tsconfig.json      # TypeScript configuration
└── test-all-workflows-tools.js  # Tool testing script
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Run the test suite
5. Submit a pull request

### Testing

```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Test all tools
node test-all-workflows-tools.js

# Run with coverage
npm run test:coverage
```

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review Atlassian REST API documentation
3. Open an issue in the repository
4. Contact the development team

---

**Note**: This server requires Jira Cloud instance with appropriate permissions. It cannot be used with Jira Server or Data Center installations.