# Jira Projects MCP Server

A specialized Model Context Protocol (MCP) server for Jira project management and configuration. This server provides comprehensive tools for managing Jira projects, issue types, dashboards, and generating reports through the Atlassian API.

## Overview

The Jira Projects MCP Server is designed to provide focused project management capabilities within Jira, offering 17 powerful tools organized into four main categories:

- **Project Management**: Complete project lifecycle management
- **Issue Type Management**: Issue type and scheme configuration
- **Dashboard Management**: Dashboard creation and administration
- **Reporting & Analytics**: JQL searches and project reporting

## Available Tools

### Project Management Tools (5 tools)

#### `create_project`
Create a new company-managed project (Scrum, Kanban, or Service Desk).

**Parameters:**
- `name` (required): The name of the project (1-255 characters)
- `key` (required): The project key (2-10 uppercase letters/numbers, must start with a letter)
- `projectTypeKey` (required): The type of project (`business`, `software`, or `service_desk`)
- `leadAccountId` (required): The account ID of the project lead
- `description` (optional): The description of the project
- `assigneeType` (optional): Default assignee (`PROJECT_LEAD` or `UNASSIGNED`)
- `url` (optional): A URL for the project
- `avatarId` (optional): The ID of the project avatar
- `projectTemplateKey` (optional): The template key for project creation
- `categoryId` (optional): The ID of the project category
- `notificationScheme` (optional): The ID of the notification scheme
- `permissionScheme` (optional): The ID of the permission scheme
- `issueSecurityScheme` (optional): The ID of the issue security scheme

**Example:**
```json
{
  "name": "Development Project",
  "key": "DEV",
  "projectTypeKey": "software",
  "leadAccountId": "5b10a2844c20165700ede21g",
  "description": "Main development project for new features"
}
```

#### `get_project`
Get details for a specific project by ID or key.

**Parameters:**
- `projectIdOrKey` (required): The project ID or key
- `expand` (optional): Comma-separated list of fields to expand

**Example:**
```json
{
  "projectIdOrKey": "DEV",
  "expand": "description,lead,issueTypes"
}
```

#### `update_project`
Update an existing project's details, configuration, and schemes.

**Parameters:**
- `projectIdOrKey` (required): The project ID or key
- `name` (optional): The new name of the project
- `key` (optional): The new project key
- `description` (optional): The new description
- `leadAccountId` (optional): The new project lead account ID
- `assigneeType` (optional): The new default assignee type
- `url` (optional): The new project URL
- `avatarId` (optional): The new avatar ID
- `categoryId` (optional): The project category ID
- `notificationScheme` (optional): The notification scheme ID
- `permissionScheme` (optional): The permission scheme ID
- `issueSecurityScheme` (optional): The issue security scheme ID

#### `delete_project`
Delete a project permanently (use with caution).

**Parameters:**
- `projectIdOrKey` (required): The project ID or key
- `enableUndo` (optional): Whether to enable undo for this deletion (default: false)

#### `search_projects`
Search and filter projects with flexible criteria and pagination.

**Parameters:**
- `query` (optional): Filter projects by name or key
- `typeKey` (optional): Filter projects by project type key
- `categoryId` (optional): Filter projects by project category ID
- `action` (optional): Filter projects by actions (`view`, `browse`, or `edit`)
- `expand` (optional): Comma-separated list of fields to expand
- `orderBy` (optional): Sort field (`category`, `issueCount`, `key`, `lastIssueUpdatedTime`, `name`, `owner`, `archivedDate`, `deletedDate`)
- `startAt` (optional): Starting index for results (default: 0)
- `maxResults` (optional): Maximum number of results (1-100, default: 50)

### Issue Type Management Tools (8 tools)

#### `get_issue_types`
Retrieve all issue types in Jira.

**Parameters:**
- `expand` (optional): Comma-separated list of fields to expand

#### `create_issue_type`
Create a new issue type.

**Parameters:**
- `name` (required): The name of the issue type (1-255 characters)
- `description` (optional): The description of the issue type
- `type` (optional): The type of issue type (`subtask` or `standard`, default: `standard`)
- `avatarId` (optional): The ID of the avatar for the issue type

#### `update_issue_type`
Update an existing issue type.

**Parameters:**
- `issueTypeId` (required): The ID of the issue type to update
- `name` (optional): The new name of the issue type
- `description` (optional): The new description
- `avatarId` (optional): The new avatar ID

#### `delete_issue_type`
Delete an issue type (with optional alternative for existing issues).

**Parameters:**
- `issueTypeId` (required): The ID of the issue type to delete
- `alternativeIssueTypeId` (optional): The ID of the issue type to replace issues with

#### `get_issue_type_schemes`
Retrieve all issue type schemes with pagination.

**Parameters:**
- `startAt` (optional): Starting index for results (default: 0)
- `maxResults` (optional): Maximum number of results (max: 100, default: 50)
- `expand` (optional): Comma-separated list of fields to expand

#### `create_issue_type_scheme`
Create a new issue type scheme.

**Parameters:**
- `name` (required): The name of the issue type scheme (1-255 characters)
- `description` (optional): The description of the issue type scheme
- `issueTypeIds` (required): Array of issue type IDs to include in the scheme
- `defaultIssueTypeId` (required): The ID of the default issue type for this scheme

#### `update_issue_type_scheme`
Update an existing issue type scheme.

**Parameters:**
- `schemeId` (required): The ID of the issue type scheme to update
- `name` (optional): The new name of the issue type scheme
- `description` (optional): The new description

#### `delete_issue_type_scheme`
Delete an issue type scheme.

**Parameters:**
- `schemeId` (required): The ID of the issue type scheme to delete

### Dashboard Management Tools (5 tools)

#### `get_dashboards`
Retrieve all dashboards with pagination and filtering support.

**Parameters:**
- `startAt` (optional): Starting index for results (default: 0)
- `maxResults` (optional): Maximum number of results (max: 100, default: 50)
- `filter` (optional): Filter dashboards by type (`favourite`, `my`, or `all`, default: `all`)

#### `create_dashboard`
Create a new dashboard with share permissions.

**Parameters:**
- `name` (required): The name of the dashboard (1-255 characters)
- `description` (optional): The description of the dashboard
- `sharePermissions` (optional): Array of share permission objects with:
  - `type`: Permission type (`global`, `project`, `group`, `authenticated`, or `user`)
  - `project` (optional): Project details for project permissions
  - `group` (optional): Group details for group permissions
  - `user` (optional): User details for user permissions

#### `get_dashboard`
Get details for a specific dashboard.

**Parameters:**
- `dashboardId` (required): The ID of the dashboard

#### `update_dashboard`
Update dashboard details and share permissions.

**Parameters:**
- `dashboardId` (required): The ID of the dashboard to update
- `name` (optional): The new name of the dashboard
- `description` (optional): The new description
- `sharePermissions` (optional): New share permissions array

#### `delete_dashboard`
Delete a dashboard permanently.

**Parameters:**
- `dashboardId` (required): The ID of the dashboard to delete

### Reporting & Analytics Tools (2 tools)

#### `search_jql`
Execute JQL queries to search for issues and generate reports.

**Parameters:**
- `jql` (required): The JQL query string
- `startAt` (optional): Starting index for results (default: 0)
- `maxResults` (optional): Maximum number of results (max: 100, default: 50)
- `fields` (optional): Array of field names to return for each issue
- `expand` (optional): Comma-separated list of fields to expand
- `validateQuery` (optional): Query validation level (`strict`, `warn`, or `none`, default: `strict`)

**Example:**
```json
{
  "jql": "project = DEV AND status = \"In Progress\"",
  "maxResults": 25,
  "fields": ["summary", "status", "assignee", "priority"]
}
```

#### `generate_project_report`
Generate a comprehensive project report including issues, progress, and statistics.

**Parameters:**
- `projectKey` (required): The project key to generate a report for
- `includeIssues` (optional): Whether to include issue details (default: true)
- `includeProgress` (optional): Whether to include progress statistics (default: true)
- `dateRange` (optional): Date range for filtering (e.g., "30d", "7d", default: "30d")

**Example:**
```json
{
  "projectKey": "DEV",
  "includeIssues": true,
  "includeProgress": true,
  "dateRange": "30d"
}
```

## Installation & Configuration

### Environment Variables

The following environment variables are required:

- `JIRA_BASE_URL`: Your Atlassian instance URL (e.g., `https://yourorg.atlassian.net`)
- `JIRA_EMAIL`: Your Atlassian account email
- `JIRA_API_TOKEN`: Your Atlassian API token (not your password)

Optional variables:
- `JIRA_PROJECT_PREFIX`: Enforced prefix for project keys (governance feature)

### Docker Setup

#### Using Docker Compose (Recommended)

1. **Add to your `docker-compose.yaml`:**
```yaml
services:
  jira-projects:
    build:
      context: ./jira-projects-mcp-server
      dockerfile: docker/Dockerfile
    container_name: mcp-jira-projects
    restart: unless-stopped
    environment:
      - JIRA_BASE_URL=${JIRA_BASE_URL}
      - JIRA_EMAIL=${JIRA_EMAIL}
      - JIRA_API_TOKEN=${JIRA_API_TOKEN}
    networks:
      - mcp-network
```

2. **Start the service:**
```bash
docker-compose up -d jira-projects
```

#### Using Docker directly

1. **Build the image:**
```bash
docker build -t jira-projects-mcp-server -f docker/Dockerfile .
```

2. **Run the container:**
```bash
docker run -d \
  --name mcp-jira-projects \
  --restart unless-stopped \
  -e JIRA_BASE_URL=https://yourorg.atlassian.net \
  -e JIRA_EMAIL=your-email@company.com \
  -e JIRA_API_TOKEN=your-api-token \
  jira-projects-mcp-server
```

### Local Development Setup

1. **Install dependencies:**
```bash
npm install
```

2. **Configure environment:**
```bash
cp .env.sample .env
# Edit .env with your Jira credentials
```

3. **Build and run:**
```bash
npm run build
npm start
```

## MCP Client Configuration

### Claude Code

Add the server to your Claude Code configuration:

```bash
claude mcp add jira-projects docker exec -i mcp-jira-projects node /app/dist/index.js
```

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "jira-projects": {
      "command": "docker",
      "args": ["exec", "-i", "mcp-jira-projects", "node", "/app/dist/index.js"]
    }
  }
}
```

### Cursor IDE

Add to your Cursor MCP configuration:

```json
{
  "jira-projects": {
    "command": "docker",
    "args": ["exec", "-i", "mcp-jira-projects", "node", "/app/dist/index.js"]
  }
}
```

## Usage Examples

### Project Lifecycle Management

**Create a new software project:**
```json
{
  "tool": "create_project",
  "params": {
    "name": "Mobile App Development",
    "key": "MOBILE",
    "projectTypeKey": "software",
    "leadAccountId": "5b10a2844c20165700ede21g",
    "description": "Mobile application development project"
  }
}
```

**Search for projects:**
```json
{
  "tool": "search_projects",
  "params": {
    "query": "Development",
    "typeKey": "software",
    "orderBy": "name",
    "maxResults": 20
  }
}
```

### Issue Type Configuration

**Create a custom issue type:**
```json
{
  "tool": "create_issue_type",
  "params": {
    "name": "Research Task",
    "description": "Tasks related to research and analysis",
    "type": "standard"
  }
}
```

**Create an issue type scheme:**
```json
{
  "tool": "create_issue_type_scheme",
  "params": {
    "name": "Development Scheme",
    "description": "Issue types for development projects",
    "issueTypeIds": ["10001", "10002", "10003"],
    "defaultIssueTypeId": "10001"
  }
}
```

### Dashboard Management

**Create a project dashboard:**
```json
{
  "tool": "create_dashboard",
  "params": {
    "name": "Project Overview Dashboard",
    "description": "High-level project metrics and status",
    "sharePermissions": [
      {
        "type": "project",
        "project": { "key": "DEV" }
      },
      {
        "type": "group",
        "group": { "name": "jira-developers" }
      }
    ]
  }
}
```

### Reporting and Analytics

**Generate a project report:**
```json
{
  "tool": "generate_project_report",
  "params": {
    "projectKey": "DEV",
    "includeIssues": true,
    "includeProgress": true,
    "dateRange": "30d"
  }
}
```

**Search for overdue issues:**
```json
{
  "tool": "search_jql",
  "params": {
    "jql": "project = DEV AND due < now() AND status != Done",
    "fields": ["summary", "due", "assignee", "status"],
    "maxResults": 50
  }
}
```

## Architecture

### Technology Stack
- **TypeScript**: Type-safe server implementation
- **MCP SDK**: Official Model Context Protocol SDK
- **Zod**: Runtime type validation and schema definition
- **Axios**: HTTP client with retry capabilities
- **Winston**: Structured logging
- **Docker**: Containerized deployment

### Project Structure
```
src/
├── api/           # Jira API client and HTTP handling
├── auth/          # Authentication management
├── tools/         # MCP tool implementations
│   ├── projects.ts      # Project management tools
│   ├── issue-types.ts   # Issue type management tools
│   ├── dashboards.ts    # Dashboard management tools
│   └── reporting.ts     # Reporting and analytics tools
├── types/         # TypeScript type definitions
├── utils/         # Utility functions and error handling
└── validation/    # Input validation schemas
```

### Security Features
- **Input Validation**: All parameters validated using Zod schemas
- **Error Handling**: Comprehensive error handling with secure error messages
- **Authentication**: Secure API token-based authentication
- **Governance**: Project naming convention enforcement
- **Non-root Container**: Runs as non-privileged user in Docker

## Error Handling

All tools return structured error responses with:
- `success`: Boolean indicating operation status
- `error`: Human-readable error message
- `code`: Specific error code for programmatic handling
- `suggestion`: Actionable suggestion for resolving the error

Example error response:
```json
{
  "success": false,
  "error": "Project with key 'INVALID' not found",
  "code": "PROJECT_NOT_FOUND",
  "suggestion": "Check the project key and ensure you have access permissions"
}
```

## Troubleshooting

### Common Issues

**Authentication Errors:**
- Verify `JIRA_BASE_URL` format: `https://yourorg.atlassian.net`
- Ensure `JIRA_API_TOKEN` is valid and not expired
- Check that `JIRA_EMAIL` matches the token owner

**Permission Errors:**
- Verify user has project administration permissions
- Check if user has access to the specific project
- Ensure proper group memberships for administrative tasks

**Connection Issues:**
- Verify network connectivity to Jira instance
- Check Docker container logs: `docker logs mcp-jira-projects`
- Ensure MCP client is properly configured

### Debugging

**Enable verbose logging:**
```bash
# View container logs
docker logs -f mcp-jira-projects

# Check container health
docker exec mcp-jira-projects node -e "console.log('Health check')"
```

**Test API connectivity:**
```bash
docker exec -it mcp-jira-projects curl -H "Authorization: Basic $(echo -n $JIRA_EMAIL:$JIRA_API_TOKEN | base64)" $JIRA_BASE_URL/rest/api/3/project
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes with proper type annotations
4. Add tests for new functionality
5. Run linting: `npm run lint`
6. Run tests: `npm test`
7. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
1. Check the troubleshooting section above
2. Review Atlassian API documentation
3. Open an issue in the project repository
4. Include logs and configuration details (without sensitive information)