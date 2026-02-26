# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.x.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

### How to Report

1. **GitHub Private Reporting** (Preferred): Use [GitHub's private vulnerability reporting](https://github.com/mkavalich/Atlassian-MCP/security/advisories/new)
2. **Email**: Contact the maintainers at the email listed in the repository
3. **Do NOT** open a public GitHub issue for security vulnerabilities

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact assessment
- Any suggested fixes (optional)

### Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 7 days
- **Fix Timeline**: Depends on severity (critical: ASAP, high: 30 days, medium: 90 days)

### Scope

**In Scope:**
- Authentication/authorization bypasses
- Data exposure through MCP tools
- Injection vulnerabilities in tool inputs
- Credential leakage
- Unsafe defaults

**Out of Scope:**
- Issues in Atlassian's APIs (report to Atlassian directly)
- Vulnerabilities requiring physical access
- Social engineering attacks
- Denial of service (unless easily exploitable)

## MCP Security Architecture

### Tool Safety Annotations

All tools include MCP-spec safety annotations to help AI assistants make informed decisions:

| Annotation | Purpose |
|------------|---------|
| `readOnlyHint` | Tool only reads data, no modifications |
| `destructiveHint` | Tool can permanently delete or modify data |
| `idempotentHint` | Safe to retry without side effects |
| `openWorldHint` | Tool may interact with external systems |

These annotations enable AI assistants to request confirmation before destructive operations.

### Discovery-First Pattern

Tools follow a discovery-first pattern that reduces accidental modifications:
1. Discovery tools (`search_*`) find entity IDs
2. Read tools (`get_*`) retrieve details
3. Write tools (`create_*`, `update_*`, `delete_*`) require explicit IDs

This prevents blind modifications to unknown resources.

### Input Validation

- All tool inputs validated with Zod schemas using `.strict()` mode
- Unknown properties rejected (prevents injection of unexpected fields)
- Type coercion disabled where security-relevant

## Runtime Security Controls

Every server implements four defense layers. These are mandatory for all servers — see the [Development Guide](docs/development-guide.md#security-patterns) for implementation details.

### Path Sanitization

The API client's `sanitizePath()` method runs on every outbound request to prevent path traversal attacks:

- Rejects `..` and `.` path segments (throws immediately)
- Allows only safe characters (`[\w\-.:@~+]`) through unmodified
- Encodes all other characters with `encodeURIComponent()`

**Location:** `src/api/client.ts` in every server.

### Error Sanitization

Error messages are sanitized before reaching MCP clients to prevent information disclosure:

- **Stack traces** stripped (lines matching `at ...`)
- **File paths** replaced with `[path]` (both Windows `C:\...` and Unix `/...`)
- **Sensitive keys** removed from error details (`password`, `token`, `secret`, `apiKey`, `authorization`, `cookie`, `session`)
- **Internal error properties** excluded (`stack`, `originalError`)
- **Length capped** at 500 characters

**Location:** `src/utils/errors.ts` in every server. Both `sanitizeErrorMessage()` and `sanitizeErrorDetails()` are called from the error class constructors, so sanitization cannot be bypassed.

### User Content Boundaries (Prompt Injection Defense)

User-generated content returned from Atlassian APIs is wrapped with boundary markers before being sent to the MCP client. This delineates untrusted content from system content, preventing prompt injection via issue descriptions, comments, page bodies, etc.

- Fields wrapped: `description`, `summary`, `body`, `renderedBody`, `comment`, `content`
- Content exceeding 10,000 characters is truncated with `...[TRUNCATED]`
- Content is **not modified** — only boundary markers are added around it

```
===USER_CONTENT_START===
<untrusted content here>
===USER_CONTENT_END===
```

**Location:** `src/utils/sanitize.ts` in every server. Utility functions `wrapUserContent()`, `sanitizeUserFields()`, `sanitizeComment()`, and `sanitizeIssueFields()` are called from tool handlers before returning data.

### Rate Limit Tracking

Each API client tracks Atlassian rate limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`) in a bounded LRU cache (max 100 entries, 5-minute TTL). This prevents unbounded memory growth and enables `waitForRateLimit()` to pause before hitting limits.

### Connection Security

- All outbound connections use HTTPS to Atlassian Cloud endpoints
- Connection pooling via `https.Agent` with `keepAlive: true` and `maxSockets: 10`
- Automatic retry with exponential backoff on network errors and 5xx responses (except 503 rate limits)
- Request timeout defaults to 30 seconds (configurable via `REQUEST_TIMEOUT` env var)
- **mTLS is not supported** — Atlassian Cloud uses API token authentication over standard TLS. Client certificate authentication would only be relevant for self-hosted Data Center instances behind a reverse proxy.

## Security Best Practices

### API Token Handling

- Never commit `.env` files containing real credentials
- Use `.env.example` as a template (contains no secrets)
- Rotate API tokens regularly
- Use minimum required permissions for API tokens
- Store production credentials in secure vaults, not environment files

### Atlassian API Tokens

Generate tokens with minimal permissions:

| Server | Minimum Permissions Needed |
|--------|---------------------------|
| `jira-projects` | Browse projects, Create/Edit issues |
| `jira-workflows` | Administer Jira (for workflow management) |
| `jira-organization` | Organization admin access |
| `confluence` | View/Add pages in relevant spaces |

### Docker Security

- Containers run as non-root user (already configured)
- Keep base images updated (`node:20-slim`)
- Don't expose unnecessary ports
- Use Docker secrets for sensitive data in production
- Resource limits prevent runaway processes

### Network Security

- MCP servers are designed for **local/trusted network use only**
- Do NOT expose MCP HTTP endpoints to the public internet
- No built-in authentication on MCP HTTP transport
- Use a reverse proxy with authentication for remote access
- Enable HTTPS in production environments

## Known Security Considerations

| Area | Consideration | Mitigation |
|------|---------------|------------|
| API Tokens | Stored in environment variables | Use vault in production |
| HTTP Transport | No built-in auth on MCP endpoints | Local use only, or add auth proxy |
| Logging | Request metadata logged | PII excluded, review before sharing |
| Tool Scope | Some tools can delete data | `destructiveHint` annotations warn AI |
| Atlassian Permissions | Tools inherit API user's permissions | Use least-privilege tokens |
| OAuth Token Refresh | Not implemented - tokens may expire | See OAuth Limitations section below |

## Known Limitations

### OAuth Token Refresh (SEC-M3)

**Status:** Not Implemented

**Description:** The MCP servers currently use Basic Authentication with API tokens rather than OAuth 2.0 with refresh tokens. While OAuth 2.0 is supported by Atlassian APIs, automatic token refresh is not implemented in these servers.

**Impact:**
- If using short-lived OAuth tokens, sessions may expire unexpectedly
- Long-running operations could fail mid-execution if tokens expire
- No automatic re-authentication when tokens expire

**Current Workaround:**
- Use Atlassian API tokens (recommended) - these do not expire automatically
- API tokens provide a stable authentication method without refresh complexity
- For OAuth deployments, implement external token refresh or use longer-lived tokens

**Why Not Implemented:**
- API token authentication meets most use cases
- OAuth refresh adds complexity for minimal benefit in MCP context
- MCP sessions are typically short-lived (interactive use)

**Future Consideration:**
- May be implemented if demand for OAuth-only deployments increases
- Would require storing refresh tokens securely and handling token rotation

## Security Updates

- Security updates released as patch versions
- Critical fixes released within 48 hours of confirmed vulnerability
- Monitor [GitHub Releases](https://github.com/mkavalich/Atlassian-MCP/releases) for security announcements
- Subscribe to repository notifications for security advisories
