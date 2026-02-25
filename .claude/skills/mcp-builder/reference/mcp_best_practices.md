# MCP Server Best Practices

## Quick Reference

### Server Naming
- **Python**: `{service}_mcp` (e.g., `slack_mcp`)
- **Node/TypeScript**: `{service}-mcp-server` (e.g., `slack-mcp-server`)

### Tool Naming
- Use snake_case with service prefix
- Format: `{service}_{action}_{resource}`
- Example: `slack_send_message`, `github_create_issue`

### Response Formats
- Support both JSON and Markdown formats
- JSON for programmatic processing
- Markdown for human readability

### Pagination
- Always respect `limit` parameter
- Return `has_more`, `next_offset`, `total_count`
- Default to 20-50 items

### Transport
- **Streamable HTTP**: For remote servers, multi-client scenarios
- **stdio**: For local integrations, command-line tools
- Avoid SSE (deprecated in favor of streamable HTTP)

---

## Server Design Philosophy

MCP servers should be **focused and single-purpose**:

- **Act as servers only**: Respond to MCP client requests (Claude Desktop, Claude Code, etc.)
- **Integrate directly with external APIs**: Make HTTP/GraphQL calls to the service you're wrapping
- **Implement domain-specific business logic**: Handle pagination, filtering, data transformation
- **No MCP-to-MCP communication**: Servers should not call other MCP servers

### Architecture Diagram

```
Claude Desktop/Code (MCP Host)
        ↓ [MCP Protocol - JSON-RPC over stdio/HTTP]
    MCP Server
        ↓ [Direct API Calls - REST/GraphQL]
    External APIs (Jira, GitHub, Slack, etc.)
```

### Single Responsibility

Each MCP server should wrap **one external service or API**. If you need to integrate multiple services:

- Create separate MCP servers for each service
- Let the MCP host (Claude) orchestrate between them
- Avoid creating "super servers" that combine unrelated functionality

This keeps servers maintainable, testable, and allows users to enable only the integrations they need.

---

## Server Naming Conventions

Follow these standardized naming patterns:

**Python**: Use format `{service}_mcp` (lowercase with underscores)
- Examples: `slack_mcp`, `github_mcp`, `jira_mcp`

**Node/TypeScript**: Use format `{service}-mcp-server` (lowercase with hyphens)
- Examples: `slack-mcp-server`, `github-mcp-server`, `jira-mcp-server`

The name should be general, descriptive of the service being integrated, easy to infer from the task description, and without version numbers.

---

## Tool Naming and Design

### Tool Naming

1. **Use snake_case**: `search_users`, `create_project`, `get_channel_info`
2. **Include service prefix**: Anticipate that your MCP server may be used alongside other MCP servers
   - Use `slack_send_message` instead of just `send_message`
   - Use `github_create_issue` instead of just `create_issue`
3. **Be action-oriented**: Start with verbs (get, list, search, create, etc.)
4. **Be specific**: Avoid generic names that could conflict with other servers

### Tool Design

- Tool descriptions must narrowly and unambiguously describe functionality
- Descriptions must precisely match actual functionality
- Provide tool annotations (readOnlyHint, destructiveHint, idempotentHint, openWorldHint)
- Keep tool operations focused and atomic

---

## Response Formats

All tools that return data should support multiple formats:

### JSON Format (`response_format="json"`)
- Machine-readable structured data
- Include all available fields and metadata
- Consistent field names and types
- Use for programmatic processing

### Markdown Format (`response_format="markdown"`, typically default)
- Human-readable formatted text
- Use headers, lists, and formatting for clarity
- Convert timestamps to human-readable format
- Show display names with IDs in parentheses
- Omit verbose metadata

---

## Pagination

For tools that list resources:

- **Always respect the `limit` parameter**
- **Implement pagination**: Use `offset` or cursor-based pagination
- **Return pagination metadata**: Include `has_more`, `next_offset`/`next_cursor`, `total_count`
- **Never load all results into memory**: Especially important for large datasets
- **Default to reasonable limits**: 20-50 items is typical

Example pagination response:
```json
{
  "total": 150,
  "count": 20,
  "offset": 0,
  "items": [...],
  "has_more": true,
  "next_offset": 20
}
```

---

## Transport Options

### Streamable HTTP

**Best for**: Remote servers, web services, multi-client scenarios

**Characteristics**:
- Bidirectional communication over HTTP
- Supports multiple simultaneous clients
- Can be deployed as a web service
- Enables server-to-client notifications

**Use when**:
- Serving multiple clients simultaneously
- Deploying as a cloud service
- Integration with web applications

### stdio

**Best for**: Local integrations, command-line tools

**Characteristics**:
- Standard input/output stream communication
- Simple setup, no network configuration needed
- Runs as a subprocess of the client

**Use when**:
- Building tools for local development environments
- Integrating with desktop applications
- Single-user, single-session scenarios

**Note**: stdio servers should NOT log to stdout (use stderr for logging)

### Transport Selection

| Criterion | stdio | Streamable HTTP |
|-----------|-------|-----------------|
| **Deployment** | Local | Remote |
| **Clients** | Single | Multiple |
| **Complexity** | Low | Medium |
| **Real-time** | No | Yes |

---

## Security Best Practices

### Authentication and Authorization

**OAuth 2.1**:
- Use secure OAuth 2.1 with certificates from recognized authorities
- Validate access tokens before processing requests
- Only accept tokens specifically intended for your server

**API Keys**:
- Store API keys in environment variables, never in code
- Validate keys on server startup
- Provide clear error messages when authentication fails

### Input Validation

- Sanitize file paths to prevent directory traversal
- Validate URLs and external identifiers
- Check parameter sizes and ranges
- Prevent command injection in system calls
- Use schema validation (Pydantic/Zod) for all inputs

### Error Handling

- Don't expose internal errors to clients
- Log security-relevant errors server-side
- Provide helpful but not revealing error messages
- Clean up resources after errors

### DNS Rebinding Protection

For streamable HTTP servers running locally:
- Enable DNS rebinding protection
- Validate the `Origin` header on all incoming connections
- Bind to `127.0.0.1` rather than `0.0.0.0`

---

## Tool Annotations

Provide annotations to help clients understand tool behavior:

| Annotation | Type | Default | Description |
|-----------|------|---------|-------------|
| `readOnlyHint` | boolean | false | Tool does not modify its environment |
| `destructiveHint` | boolean | true | Tool may perform destructive updates |
| `idempotentHint` | boolean | false | Repeated calls with same args have no additional effect |
| `openWorldHint` | boolean | true | Tool interacts with external entities |

**Important**: Annotations are hints, not security guarantees. Clients should not make security-critical decisions based solely on annotations.

---

## Error Handling

- Use standard JSON-RPC error codes
- Report tool errors within result objects (not protocol-level errors)
- Provide helpful, specific error messages with suggested next steps
- Don't expose internal implementation details
- Clean up resources properly on errors

Example error handling:
```typescript
try {
  const result = performOperation();
  return { content: [{ type: "text", text: result }] };
} catch (error) {
  return {
    isError: true,
    content: [{
      type: "text",
      text: `Error: ${error.message}. Try using filter='active_only' to reduce results.`
    }]
  };
}
```

---

## Testing Requirements

Comprehensive testing should cover:

- **Functional testing**: Verify correct execution with valid/invalid inputs
- **Integration testing**: Test interaction with external systems
- **Security testing**: Validate auth, input sanitization, rate limiting
- **Performance testing**: Check behavior under load, timeouts
- **Error handling**: Ensure proper error reporting and cleanup

---

## Manual Protocol Testing

Before deploying any MCP server, verify it responds correctly to the MCP protocol using these JSON-RPC commands.

### Protocol Handshake Test

Test that the server initializes correctly:

```bash
# For Docker-based servers
echo '{"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}},"jsonrpc":"2.0","id":0}' | docker exec -i <container-name> node dist/index.js

# For local Node servers
echo '{"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}},"jsonrpc":"2.0","id":0}' | node dist/index.js

# For local Python servers
echo '{"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}},"jsonrpc":"2.0","id":0}' | python -m server.main
```

**Expected response**: JSON object with `protocolVersion`, `capabilities`, and `serverInfo`.

### Tools Discovery Test

Verify all tools are registered and discoverable:

```bash
echo '{"method":"tools/list","params":{},"jsonrpc":"2.0","id":1}' | node dist/index.js
```

**Expected response**: JSON object with `tools` array containing all registered tools with their schemas.

### Tool Execution Test

Test individual tool execution:

```bash
echo '{"method":"tools/call","params":{"name":"your_tool_name","arguments":{"param1":"value1"}},"jsonrpc":"2.0","id":2}' | node dist/index.js
```

### CRUD Testing Protocol

For servers with data modification capabilities, test the full lifecycle:

1. **CREATE**: Test with minimal required parameters, then with all optional parameters
2. **READ**: Test with expand parameters, pagination, and filtering
3. **UPDATE**: Verify changes persist and are reflected in subsequent reads
4. **DELETE**: Confirm removal and verify resource is no longer accessible

### Integration Testing Requirement

**Critical**: Always test MCP servers with the actual MCP client (Claude Desktop or Claude Code) before considering the implementation complete. Unit tests and manual JSON-RPC tests are necessary but not sufficient—the server must work in its target execution environment.

---

## Common Pitfalls and Debugging

Real-world lessons learned from MCP server development failures.

### Python Import Issues

**Problem**: Server works when run directly but fails when invoked via `python -m` or from Claude Desktop.

**Root Cause**: Complex relative imports that don't resolve correctly in different execution contexts.

**Solution**:
- Use absolute imports throughout Python MCP servers
- Test the exact invocation command that Claude Desktop/Code will use
- Avoid deeply nested relative imports like `from ...utils import helper`

### SDK API Changes

**Problem**: Server breaks after SDK update with errors like `MCPError is not defined`.

**Root Cause**: MCP SDK APIs change between versions (e.g., `MCPError` → `McpError` in Python FastMCP).

**Solution**:
- Pin SDK versions in package.json or requirements.txt
- Monitor SDK changelogs before upgrading
- Test thoroughly after any dependency update
- Document the SDK version your server is tested against

### Environment-Specific Failures

**Problem**: Server works in development but fails when deployed via Docker or called from Claude Desktop.

**Root Cause**: Different execution environments have different:
- Working directories
- Environment variable availability
- File system access
- Network configurations

**Solution**:
- Test in the target execution environment early and often
- Use absolute paths for file references
- Validate environment variables on server startup with clear error messages
- Log to stderr (not stdout) for stdio transport servers

### stdio Transport Logging

**Problem**: Server output corrupts the MCP protocol stream.

**Root Cause**: Logging to stdout interferes with JSON-RPC communication.

**Solution**:
- Always log to stderr for stdio-based servers
- Use `console.error()` in Node.js or `print(..., file=sys.stderr)` in Python
- Consider structured logging libraries that support stderr output

### Authentication Failures

**Problem**: API calls fail with 401/403 despite correct credentials.

**Common Causes**:
1. Environment variables not passed to Docker container
2. Token format issues (missing "Bearer " prefix, wrong encoding)
3. Expired tokens not being refreshed
4. Scope/permission mismatches

**Solution**:
- Validate credentials on server startup
- Provide clear error messages indicating which credential is missing
- Test authentication separately before testing tool functionality
- Log the authentication method being used (but never log actual credentials)

### Debugging Checklist

When an MCP server isn't working:

1. **Can you run it standalone?** `node dist/index.js` or `python -m server.main`
2. **Does it respond to initialize?** Use the JSON-RPC handshake test above
3. **Are tools listed?** Use the tools/list test above
4. **Are environment variables set?** Check with `echo $VAR_NAME` before launching
5. **Is stdout clean?** Ensure no debug output goes to stdout for stdio servers
6. **Does Claude Desktop see it?** Check Claude Desktop's MCP server status
7. **What do the logs say?** Check stderr output and any log files

---

## Documentation Requirements

- Provide clear documentation of all tools and capabilities
- Include working examples (at least 3 per major feature)
- Document security considerations
- Specify required permissions and access levels
- Document rate limits and performance characteristics
