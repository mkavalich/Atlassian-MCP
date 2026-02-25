# Integration Guide

This document explains how to integrate the Jira Admin MCP Server with your existing MCP infrastructure.

## Quick Start

### 1. Install Dependencies

```bash
cd jira-admin-mcp-server
npm install
npm run build
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your Jira credentials
```

### 3. Test the Server

```bash
npm run dev
```

## Integration with Docker Compose

### Option 1: Add to Existing docker-compose.yaml

Add this service to your existing `docker-compose.yaml`:

```yaml
services:
  # ... existing services ...
  
  jira-admin-mcp:
    build:
      context: ./jira-admin-mcp-server
      dockerfile: docker/Dockerfile
    environment:
      - JIRA_BASE_URL=${JIRA_BASE_URL}
      - JIRA_EMAIL=${JIRA_EMAIL}
      - JIRA_API_TOKEN=${JIRA_API_TOKEN}
      - LOG_LEVEL=info
    restart: unless-stopped
    networks:
      - mcp-network
    healthcheck:
      test: ["CMD", "node", "-e", "console.log('Health check')"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### Option 2: Standalone Deployment

```yaml
version: '3.8'

services:
  jira-admin-mcp:
    build:
      context: .
      dockerfile: docker/Dockerfile
    environment:
      - JIRA_BASE_URL=${JIRA_BASE_URL}
      - JIRA_EMAIL=${JIRA_EMAIL}
      - JIRA_API_TOKEN=${JIRA_API_TOKEN}
    restart: unless-stopped
    networks:
      - jira-mcp-network

networks:
  jira-mcp-network:
    driver: bridge
```

## Claude Code Configuration

Add to your Claude Code MCP configuration:

```bash
claude mcp add jira-admin docker exec -i jira-admin-mcp jira-admin-mcp-server
```

Or if running locally:

```bash
claude mcp add jira-admin npx jira-admin-mcp-server
```

## Claude Desktop Configuration

Add to your `claude-desktop-config.json`:

```json
{
  "mcpServers": {
    "jira-admin": {
      "command": "docker",
      "args": ["exec", "-i", "jira-admin-mcp", "jira-admin-mcp-server"],
      "env": {
        "JIRA_BASE_URL": "https://your-domain.atlassian.net",
        "JIRA_EMAIL": "your-email@example.com",
        "JIRA_API_TOKEN": "your-api-token"
      }
    }
  }
}
```

## Cursor IDE Configuration

Add to your `cursor-mcp-config.json`:

```json
{
  "jira-admin": {
    "command": "docker",
    "args": ["exec", "-i", "jira-admin-mcp", "jira-admin-mcp-server"],
    "env": {
      "JIRA_BASE_URL": "https://your-domain.atlassian.net",
      "JIRA_EMAIL": "your-email@example.com",
      "JIRA_API_TOKEN": "your-api-token"
    }
  }
}
```

## Environment Variables

Update your `.env` file in the main directory:

```bash
# Add Jira configuration
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-api-token
```

## Security Considerations

1. **API Token Security**: 
   - Generate tokens at [Atlassian API Tokens](https://id.atlassian.com/manage/api-tokens)
   - Use descriptive names for tokens
   - Rotate tokens regularly

2. **Permission Scoping**:
   - Only grant necessary Jira permissions
   - Use project-specific API tokens when possible
   - Monitor token usage through Jira audit logs

3. **Network Security**:
   - Use Docker networks for container isolation
   - Consider VPN for production deployments
   - Monitor API usage and rate limits

## Governance Features

### Naming Conventions

Set a project prefix to enforce naming standards:

```bash
export JIRA_PROJECT_PREFIX="CORP-"
```

This ensures all project keys start with "CORP-".

### Audit Logging

All administrative actions are logged with structured information:

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "action": "create_project",
  "project": "CORP-TEST",
  "user": "admin@company.com",
  "details": {...}
}
```

### Change Documentation

Administrative changes can be logged for documentation:

```bash
export JIRA_CHANGE_LOG_WEBHOOK="https://your-docs-system.com/webhook"
```

## Available Tools Summary

### Project Management
- `create_project` - Create new projects
- `get_project` - Retrieve project details
- `update_project` - Modify project settings  
- `delete_project` - Remove projects safely
- `get_project_types` - List available project types

### Workflow Management
- `get_workflows` - List workflows
- `create_workflow` - Create complex workflows
- `get_workflow_schemes` - Retrieve workflow schemes

### Permission Management
- `get_permission_schemes` - List permission schemes
- `create_permission_scheme` - Create new schemes
- `assign_permission_scheme_to_project` - Assign schemes

### Field Management
- `get_fields` - List all fields
- `create_custom_field` - Create custom fields
- `update_custom_field` - Modify field settings
- `delete_custom_field` - Remove custom fields

### System Tools
- `search_jql` - Advanced issue searching
- `get_audit_records` - Retrieve audit logs
- `get_instance_info` - System information
- `get_system_limits` - Usage statistics

## Troubleshooting

### Common Issues

1. **Container Won't Start**
   ```bash
   docker logs jira-admin-mcp
   ```

2. **Authentication Errors**
   - Verify API token is valid
   - Check base URL format
   - Ensure email matches token owner

3. **Permission Errors**
   - Verify Jira Administrator permissions
   - Check project-level permissions

4. **Rate Limiting**
   - Monitor rate limit headers
   - Implement request batching
   - Use expansion parameters

### Health Checks

Monitor server health:

```bash
# Check container status
docker exec jira-admin-mcp node -e "console.log('Server is running')"

# Check Jira connectivity
curl -H "Authorization: Basic $(echo -n 'email:token' | base64)" \
  https://your-domain.atlassian.net/rest/api/3/serverInfo
```

## Performance Optimization

1. **Request Batching**: Use bulk operations when available
2. **Expansion Parameters**: Reduce API calls with `?expand=`
3. **Caching**: Implement local caching for frequently accessed data
4. **Connection Pooling**: Configure axios for connection reuse

## Monitoring

### Metrics to Track

- API request count and latency
- Rate limit usage
- Error rates by tool
- Authentication failures
- Administrative action frequency

### Log Analysis

Use structured logging output for monitoring:

```bash
docker logs jira-admin-mcp | grep ERROR
docker logs jira-admin-mcp | grep AUDIT
```

## Backup and Recovery

1. **Configuration Backup**: Export Jira configurations regularly
2. **API Token Rotation**: Implement automated token rotation
3. **Disaster Recovery**: Document restoration procedures
4. **Testing**: Regular testing of backup procedures

This integration provides a comprehensive Jira administration interface for AI agents while maintaining security and governance controls.