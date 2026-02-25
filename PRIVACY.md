# Privacy Policy

**Atlassian MCP Servers**
Last Updated: February 2026

## Overview

The Atlassian MCP Servers are open-source tools that enable AI assistants to interact with Atlassian Cloud products (Jira, Confluence) through the Model Context Protocol (MCP).

## Data Collection

### What We Don't Collect
- **No Personal Information**: These servers do not collect, store, or transmit any personal information
- **No Analytics**: No usage analytics, telemetry, or tracking
- **No Data Persistence**: Servers are stateless and do not persist any data between requests

### What Flows Through the Servers
- **API Requests**: Requests from MCP clients are forwarded to Atlassian Cloud APIs
- **API Responses**: Responses from Atlassian are returned to the MCP client
- **Credentials**: Your Atlassian API token is used only for authenticating with Atlassian APIs

## Data Flow

```
MCP Client (e.g., Claude) → MCP Server → Atlassian Cloud APIs
                         ↵ ← ← ← ← ← ← ←
```

The MCP server acts as a pass-through:
1. Receives tool invocation from MCP client
2. Translates to Atlassian API call
3. Returns API response to client

## Credentials Security

- API tokens are provided via environment variables
- Tokens are never logged or persisted
- Use dedicated API tokens with minimal required permissions
- Rotate tokens regularly per your organization's security policy

## Logging

Default logging includes:
- Server startup/shutdown events
- Error messages (without sensitive data)
- Request metadata (tool name, timing)

Logging does NOT include:
- API tokens or credentials
- Personal identifiable information
- Request/response bodies
- User content from Atlassian

## Self-Hosted Deployment

When you deploy these servers:
- You control all data flow
- Data stays within your infrastructure
- No data is sent to third parties (other than Atlassian Cloud)
- You are responsible for securing your deployment

## Atlassian Data

Data accessed through these servers is governed by:
- Your Atlassian Cloud terms of service
- Your organization's Atlassian data policies
- Atlassian's privacy policy: https://www.atlassian.com/legal/privacy-policy

## Changes to This Policy

Updates to this policy will be reflected in this file.

## Contact

For privacy concerns related to these MCP servers:
- Open an issue: [GitHub Issues](https://github.com/mkavalich/Atlassian-MCP/issues)
- For Atlassian Cloud privacy: Contact Atlassian directly
