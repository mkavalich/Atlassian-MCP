# Anthropic MCP Directory Compliance Guide

## Overview

The Anthropic MCP Directory (Connectors Directory) is a curated list of MCP servers that meet Anthropic's quality, security, and compatibility standards. Directory-listed servers receive visibility in Claude's ecosystem across all platforms (web, desktop, mobile, API).

This guide covers the **requirements for directory listing** as documented in Anthropic's official sources. All requirements are cited to their source documents.

**Official Sources:**
- [Remote MCP Server Submission Guide](https://support.claude.com/en/articles/12922490-remote-mcp-server-submission-guide)
- [Anthropic Software Directory Policy](https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy)
- [MCP Directory Submission Form](https://docs.google.com/forms/d/e/1FAIpQLSeafJF2NDI7oYx1r8o0ycivCSVLNq92Mpc1FPxMKSw1CzDkqA/viewform)

---

## Mandatory Requirements

These requirements are explicitly stated as **mandatory for directory approval**. Missing any will result in rejection or revision requests.

| Requirement | Specification | Source |
|-------------|---------------|--------|
| **Tool Annotations** | All tools must have `readOnlyHint`, `destructiveHint`, and `title` | Policy §5E |
| **Tool Names** | ≤64 characters each | Policy §5C |
| **Token Efficiency** | Max 25,000 tokens per tool result; be "frugal with tokens" | Submission Guide; Policy §5B |
| **Transport** | Should support Streamable HTTP (SSE may be deprecated) | Policy §5F |
| **Authentication** | OAuth 2.0 with certificates from recognized authorities (if auth required) | Policy §5D |
| **HTTPS** | Valid TLS certificates required | Submission Guide |
| **Production Status** | Must be GA (not beta/alpha/development) | Submission Guide |
| **Documentation** | Comprehensive docs with minimum 3 usage examples | Submission Guide |
| **Privacy Policy** | Published and accessible at stable HTTPS URL | Submission Guide |
| **Support Channel** | Dedicated support (email or web) | Submission Guide |
| **Test Account** | Provisioned account with sample data (if auth required) | Submission Guide |

---

## Tool Annotations (REQUIRED)

> "MCP servers must provide all applicable annotations for their tools, in particular *readOnlyHint*, *destructiveHint*, and *title*."
> — [Anthropic Software Directory Policy, Section 5E](https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy)

### Required Annotations

Every tool MUST have these annotations:

```typescript
server.registerTool(
  "get_project",
  {
    title: "Get Project",                 // REQUIRED: Human-readable name for UI
    description: "Retrieves project...",  // REQUIRED: What the tool does
    inputSchema: GetProjectSchema,
    annotations: {
      readOnlyHint: true,                 // REQUIRED: true if no side effects
      destructiveHint: false              // REQUIRED: true if modifies/deletes data
    }
  },
  handler
);
```

### Annotation Decision Guide

From [Submission Guide](https://support.claude.com/en/articles/12922490-remote-mcp-server-submission-guide):

| Tool Behavior | readOnlyHint | destructiveHint | Examples |
|---------------|--------------|-----------------|----------|
| Only reads data | `true` | `false` | search, get, list, fetch |
| Writes/modifies data | `false` | `true` | create, update, delete, send |
| Creates temp files | — | `true` | Even temporary writes count |
| Sends external requests | — | `true` | Emails, notifications, webhooks |
| Caches internally only | `true` | — | Internal optimization OK |

### Annotation Helper Utility

```typescript
// packages/shared/src/annotations.ts
export const ReadOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false
};

export const WriteAnnotations = {
  readOnlyHint: false,
  destructiveHint: true
};

// Usage
server.registerTool("get_project", {
  title: "Get Project",
  annotations: ReadOnlyAnnotations,
  // ...
}, handler);
```

---

## Tool Name Length (REQUIRED)

> "MCP tool names must not exceed 64 characters."
> — [Anthropic Software Directory Policy, Section 5C](https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy)

### Validation Script

```typescript
// scripts/validate-tool-names.ts
const tools = server.getRegisteredTools();
const violations = tools.filter(t => t.name.length > 64);

if (violations.length > 0) {
  console.error("ERROR: Tool names exceeding 64 characters:");
  violations.forEach(t => console.error(`  - ${t.name} (${t.name.length} chars)`));
  process.exit(1);
}
console.log(`✓ All ${tools.length} tool names are within 64 character limit`);
```

---

## Token Efficiency (REQUIRED)

> "MCP servers must be frugal with their use of tokens. The amount of tokens a given tool call uses should be roughly commensurate with the complexity or impact of the task. When possible, users should be given options to exclude unnecessary text in the response."
> — [Anthropic Software Directory Policy, Section 5B](https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy)

> "Token-efficient responses (max 25,000 tokens per tool result)"
> — [Remote MCP Server Submission Guide](https://support.claude.com/en/articles/12922490-remote-mcp-server-submission-guide)

### Key Principles

1. **Proportionality** — Response size should match task complexity
2. **User control** — Provide options to exclude unnecessary text (e.g., `fields` parameter)
3. **Hard limit** — No single tool result should exceed 25,000 tokens

### Implementing User Control (Recommended)

The policy recommends giving users "options to exclude unnecessary text." Implementation patterns:

**Pagination for lists:**

```typescript
const ListSchema = z.object({
  maxResults: z.number().int().min(1).max(100).default(20)
    .describe("Maximum results to return (default: 20, max: 100)"),
  startAt: z.number().int().min(0).default(0)
    .describe("Index of first result for pagination")
});
```

**Field selection for details:**

```typescript
const GetSchema = z.object({
  id: z.string().describe("Entity ID"),
  fields: z.enum(["summary", "full"]).default("summary")
    .describe("Response detail: 'summary' for key fields, 'full' for all fields")
});
```

**Progressive disclosure with search_tools:**

```typescript
server.registerTool(
  "search_tools",
  {
    title: "Search Available Tools",
    description: "Discover tools by category. Use before calling specific tools.",
    inputSchema: z.object({
      category: z.enum(["all", "projects", "issues", "users"]).default("all")
    }),
    annotations: { readOnlyHint: true, destructiveHint: false }
  },
  async ({ category }) => {
    const tools = getToolsByCategory(category);
    return {
      content: [{
        type: "text",
        text: tools.map(t => `- **${t.name}**: ${t.shortDescription}`).join("\n")
      }]
    };
  }
);
```

---

## Transport Requirements

> "Remote MCP servers should support the Streamable HTTP transport. Servers may support SSE for the time being, but in the future it will be deprecated."
> — [Anthropic Software Directory Policy, Section 5F](https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy)

### Streamable HTTP Implementation

```typescript
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";

const app = express();
app.use(express.json());

app.post('/mcp', async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });
  res.on('close', () => transport.close());
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.listen(3000);
```

### Dual Transport Support (Recommended)

Support both stdio (local development) and HTTP (production):

```typescript
export async function startServer(server: McpServer, port: number = 3000) {
  const transportType = process.env.TRANSPORT || "stdio";
  
  if (transportType === "http") {
    await createHttpTransport(server, port);
  } else {
    const transport = new StdioServerTransport();
    await server.connect(transport);
  }
}
```

---

## Authentication Requirements

> "Remote MCP servers that connect to a remote service and require authentication must use secure OAuth 2.0 with certificates from recognized authorities."
> — [Anthropic Software Directory Policy, Section 5D](https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy)

### OAuth 2.0 Requirements

From [Submission Guide](https://support.claude.com/en/articles/12922490-remote-mcp-server-submission-guide):

- Must use OAuth 2.0 authorization code flow
- Certificates from recognized authorities
- Must allowlist callback URLs:
  - `http://localhost:6274/oauth/callback` (local clients)
  - `http://localhost:6274/oauth/callback/debug`
  - `https://claude.ai/api/mcp/auth_callback`
  - `https://claude.com/api/mcp/auth_callback`

### OAuth Implementation

```typescript
// Authorization request
const authUrl = new URL("https://auth.example.com/authorize");
authUrl.searchParams.set("client_id", CLIENT_ID);
authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", "read write");
authUrl.searchParams.set("state", generateState());

// Token exchange
async function exchangeCodeForToken(code: string) {
  const response = await fetch("https://auth.example.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      code
    })
  });
  return response.json();
}
```

### Firewall Requirements

> "For servers behind firewalls, allowlist IP addresses from https://docs.claude.com/en/api/ip-addresses"
> — [Remote MCP Server Submission Guide](https://support.claude.com/en/articles/12922490-remote-mcp-server-submission-guide)

---

## Error Handling (REQUIRED)

> "MCP servers must gracefully handle errors and provide helpful feedback rather than generic error messages."
> — [Anthropic Software Directory Policy, Section 5A](https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy)

### Implementation

```typescript
try {
  const result = await api.getProject(projectId);
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
} catch (error) {
  if (error.status === 404) {
    return {
      content: [{
        type: "text",
        text: `Project "${projectId}" not found. Use search_projects to find valid project keys.`
      }],
      isError: true
    };
  }
  // Helpful, not generic
  return {
    content: [{
      type: "text", 
      text: `Failed to retrieve project: ${error.message}. Check that the project key is correct and you have access.`
    }],
    isError: true
  };
}
```

---

## Documentation Requirements

From [Submission Guide](https://support.claude.com/en/articles/12922490-remote-mcp-server-submission-guide):

### Required Sections

1. **Server Description** — Clear explanation of what your server does
2. **Features** — Key capabilities and use cases
3. **Setup Instructions** — How users connect and configure
4. **Authentication** — OAuth setup and requirements (if applicable)
5. **Usage Examples** — Minimum 3 working examples with prompts (REQUIRED)
6. **Privacy Policy** — Link to full privacy policy
7. **Support** — How users can get help or report issues

### Example Format (Required)

Minimum 3 examples demonstrating core functionality:

```markdown
## Examples

### Example 1: Search for documents
**User prompt:** "Find recent project reports in my workspace"
**What happens:**
- Server searches your workspace
- Returns matching documents with metadata
- Provides quick access links

### Example 2: Create new content
**User prompt:** "Create a new task list for the marketing campaign"
**What happens:**
- Server creates new task list
- Adds initial structure based on context
- Returns link to newly created list

### Example 3: Update existing data
**User prompt:** "Update the project status to 'In Progress'"
**What happens:**
- Server locates the project
- Updates status field
- Confirms changes made
```

---

## Pre-Submission Checklist

From [Remote MCP Server Submission Guide](https://support.claude.com/en/articles/12922490-remote-mcp-server-submission-guide):

### Mandatory Requirements
- [ ] All tools have `readOnlyHint` OR `destructiveHint` annotations
- [ ] All tools have `title` annotation
- [ ] All tool names ≤64 characters
- [ ] OAuth 2.0 implemented correctly (if authentication required)
- [ ] Server accessible via HTTPS with valid certificates
- [ ] Claude IP addresses allowlisted (if server behind firewall)
- [ ] Comprehensive documentation published and accessible
- [ ] Privacy policy published at stable HTTPS URL
- [ ] Dedicated support channels (email or web)
- [ ] Test account prepared with sample data (if authentication required)
- [ ] Server is production-ready (GA status, not beta)
- [ ] Minimum 3 usage examples documented
- [ ] Error handling implemented with helpful messages

### Testing
- [ ] Works correctly from Claude.ai
- [ ] Works correctly from Claude Desktop
- [ ] Works correctly from Claude Code (if no IP restrictions)
- [ ] OAuth flow completes successfully
- [ ] All tools function as documented
- [ ] Error messages are helpful and user-friendly

---

## Submission Process

1. **Complete checklist** — Verify all mandatory requirements above
2. **Test thoroughly** — Validate with Claude.ai, Desktop, and Code
3. **Prepare documentation** — Ensure README has all required sections and 3+ examples
4. **Submit form** — [MCP Directory Server Review Form](https://docs.google.com/forms/d/e/1FAIpQLSeafJF2NDI7oYx1r8o0ycivCSVLNq92Mpc1FPxMKSw1CzDkqA/viewform)

> "While we strive to review every submission as quickly as we can, due to the amount of interest we cannot promise that we will accept your submission or respond to it individually."
> — [Remote MCP Server Submission Guide](https://support.claude.com/en/articles/12922490-remote-mcp-server-submission-guide)

---

## Common Rejection Reasons

From [Submission Guide](https://support.claude.com/en/articles/12922490-remote-mcp-server-submission-guide):

1. **Missing tool annotations** — Tools missing required safety annotations
2. **OAuth implementation issues** — OAuth flow fails or has configuration errors
3. **Incomplete documentation** — Missing examples, unclear setup, missing sections
4. **Production readiness concerns** — Server marked as "beta" or shows instability
5. **Privacy policy/support issues** — Missing or inaccessible URLs

---

## Resources

- [Remote MCP Server Submission Guide](https://support.claude.com/en/articles/12922490-remote-mcp-server-submission-guide)
- [Anthropic Software Directory Policy](https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy)
- [MCP Protocol Documentation](https://modelcontextprotocol.io/)
- [MCP Tool Annotations](https://modelcontextprotocol.io/specification/draft/schema#toolannotations)
- [OAuth 2.0 Authorization Framework](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization)
- [Claude IP Addresses](https://docs.claude.com/en/api/ip-addresses)

---

*Last updated: January 2025*
*Sources verified against Anthropic documentation as of this date*
