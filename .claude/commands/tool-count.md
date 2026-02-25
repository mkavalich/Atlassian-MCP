---
allowed-tools: Bash(claude mcp:*)
description: Quick count of available MCP tools by server
---

# Quick MCP Tool Count

Get a rapid overview of available MCP servers and tool counts.

## Server Status
!`claude mcp list`

## Your Task

Provide a concise summary showing:

1. **Total Active Servers**: Count from the server list
2. **Quick Tool Estimates** by major categories:
   - **Jira Suite** (6 servers): Estimated ~157 tools
   - **Core Development Tools** (remaining servers): Estimated ~64 tools
3. **Total Estimated Tools**: ~220+ tools

Format as a quick reference table:

| **Server Category** | **Server Count** | **Estimated Tools** |
|-------------------|------------------|------------------|
| Jira | 6 | ~157 |
| Core Development | [COUNT] | ~64 |
| **TOTAL** | **[TOTAL]** | **~221** |

Use this for quick reference without generating the full documentation.