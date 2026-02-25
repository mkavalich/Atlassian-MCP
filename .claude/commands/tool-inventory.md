---
allowed-tools: Bash(claude mcp:*), Write, Read, Glob, ListMcpResourcesTool
argument-hint: [update-mode]
description: Generate comprehensive MCP tool inventory and update available-tools.md
---

# MCP Tool Inventory Generator

Create a comprehensive inventory of all available MCP servers and their tools, then update or create `available-tools.md` with accurate counts and categorization.

## Context Gathering

First, gather comprehensive information about the MCP ecosystem:

### Active MCP Servers
!`claude mcp list`

### Available Function Tools
Use the ListMcpResourcesTool and examine all available function definitions to get accurate tool counts.

### Current Documentation Status
Check if `available-tools.md` exists: @available-tools.md

## Your Tasks

### 1. **Discover and Catalog All MCP Tools**
- **Systematic Enumeration**: Count all available tools from each active MCP server
- **Accurate Categorization**: Group tools by server and functional domain
- **Tool Capability Analysis**: Understand what each tool category provides

### 2. **Calculate Accurate Totals**
Based on research, the expected tool distribution should be:
- **Jira Suite** (6 servers): ~157 tools (largest ecosystem)
- **Core Development Tools** (8 servers): ~64 tools
- **Total Expected**: ~220+ tools across 14 active servers

### 3. **Generate/Update available-tools.md**

Create a comprehensive documentation file with:

#### **File Header**
```markdown
# Available MCP Tools & Servers

This document catalogs all available MCP (Model Context Protocol) servers and their tools in the current environment. Use this reference to avoid reinventing existing functionality when creating new subagents.

**📊 Current Scale**: **~[ACTUAL_TOTAL]+ specialized tools** across **[SERVER_COUNT] active MCP servers**
```

#### **Server Status Section**
- List all connected servers with tool counts
- Separate core development tools from Jira suite
- Show connection status for each server

#### **Detailed Tool Catalogs**
For each server category:
- **Purpose statement**
- **Available tools list** with descriptions
- **Best use cases** for subagent creation
- **Integration patterns**

#### **Tool Selection Guidelines**
- **By Agent Type**: Security, Research, Frontend, Backend, Testing, PM
- **Tool Limit Optimization**: Research-backed recommendations
- **Performance Considerations**: High-performance vs resource-intensive tools
- **Team Formation Triggers**: When to decompose into multiple agents

#### **Ecosystem Summary Table**
| **Category** | **Servers** | **Tools** | **Primary Use Cases** |
|--------------|-------------|-----------|----------------------|
| **🎫 Jira** | [COUNT] | ~[COUNT] | Project management, workflows, admin |
| [Additional categories...] | | | |

### 4. **Ensure Accuracy**
- **Verify all tool counts** against actual available functions
- **Cross-reference server connectivity** with `claude mcp list` output
- **Update any references** in related documentation if needed

### 5. **Optimization for Subagent Creation**
Include specific guidance for:
- **Optimal tool combinations** by agent type
- **Team formation strategies** for tool-heavy requirements
- **Integration patterns** for cross-server workflows
- **Security considerations** for tool access

## Expected Output

The command should:
1. **Generate accurate tool inventory** with precise counts
2. **Create/update available-tools.md** with comprehensive documentation  
3. **Provide summary statistics** of the discovery process
4. **Flag any discrepancies** between expected and actual tool counts

## Success Criteria

- ✅ All active MCP servers cataloged
- ✅ Accurate tool counts for each server
- ✅ Comprehensive available-tools.md created/updated
- ✅ Tool selection guidelines included
- ✅ Integration patterns documented
- ✅ Ready for subagent creation reference

Use this inventory to ensure SubAgent Builder and other agents can make informed tool selection decisions without reinventing existing functionality.