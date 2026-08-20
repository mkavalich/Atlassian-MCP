# Optimization Guide: Deferred Loading & Tool Use Examples

This guide covers two Anthropic API features that reduce token usage and improve tool calling accuracy when integrating with our 280-tool MCP ecosystem.

---

## Overview

| Feature | Problem | Solution | Impact |
|---------|---------|----------|--------|
| **Deferred Loading** (opt-in) | 280 tools = ~68.8K tokens across 8 listings (measured) | Load tool schemas on-demand via `load_tool_schema` | 47.3% measured (269 KB -> 142 KB) |
| **Tool Use Examples** | Complex tools (custom fields, JQL, nested objects) have ~72% accuracy | Structured `input_examples` on tool definitions | ~90% accuracy |

> **Important:** `defer_loading` and `input_examples` are mutually exclusive in the Anthropic API. See [Compatibility](#compatibility) for the recommended hybrid strategy.

---

## Deferred Loading

### How It Works

When `defer_loading: true` is set on an MCP toolset, Anthropic omits tool schemas from the initial context. The model discovers tools at runtime via anchor tools (`search_tools`, `load_tool_schema`).

### Configuration

```python
from anthropic import Anthropic

client = Anthropic()

response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=4096,
    mcp_servers=[
        {
            "type": "url",
            "url": "http://localhost:3001/sse",
            "name": "jira-projects",
            "tool_configuration": {
                "defer_loading": True
            }
        },
        {
            "type": "url",
            "url": "http://localhost:3002/sse",
            "name": "jira-workflows",
            "tool_configuration": {
                "defer_loading": True
            }
        }
    ],
    messages=[{"role": "user", "content": "Create a bug in project PROJ"}]
)
```

### Runtime Discovery Flow

With deferred loading enabled, the model follows this pattern:

1. **`search_tools`** — Discovers tool names by category (e.g., `category: "issues"`)
2. **`load_tool_schema`** — Loads the full schema for a specific tool (e.g., `toolName: "create_issue"`)
3. **Tool call** — Calls the tool with correct parameters

Each server has both `search_tools` and `load_tool_schema` registered automatically.

### Token Savings

| Scenario | Without Deferred | With Deferred | Savings |
|----------|-----------------|---------------|---------|
| Single server (60 tools) | ~12K tokens | ~3K tokens | 75% |
| All 8 servers (280 tools) | ~50K tokens | ~12K tokens | 76% |
| Single task (uses 3 tools) | ~50K tokens | ~5K tokens | 90% |

### Anchor Tools Reference

Every server exposes these two tools even with deferred loading:

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `search_tools` | Find tools by category or type | `category`, `type` |
| `load_tool_schema` | Get full schema for a tool | `toolName`, `format` |

---

## Tool Use Examples (input_examples)

### How It Works

`input_examples` are structured example invocations attached to tool definitions. When passed to the Anthropic Messages API, they improve the model's accuracy on complex parameter patterns.

### Retrieving Examples

**Option A: Via `load_tool_schema`**

```python
# The model calls this at runtime
load_tool_schema(toolName="create_issue", format="json")

# Response includes:
# {
#   "tool": {
#     "name": "create_issue",
#     "description": "...",
#     "inputSchema": { ... },
#     "examples": [
#       {
#         "name": "Create a bug with priority and labels",
#         "input": {
#           "projectKey": "PROJ",
#           "issueType": "Bug",
#           "summary": "Login page returns 500 error",
#           "priority": "High",
#           "labels": ["mobile", "login"]
#         }
#       }
#     ]
#   }
# }
```

**Option B: Via `schemas/tools.json`**

The generated `schemas/tools.json` file includes examples for all tools that have them:

```python
import json

with open("schemas/tools.json") as f:
    catalog = json.load(f)

# Get examples for a specific tool
tool_data = catalog["servers"]["jira-projects"]["tools"]["create_issue"]
examples = tool_data.get("examples", [])
```

### Passing Examples to the Anthropic API

```python
from anthropic import Anthropic

client = Anthropic()

# Load examples from catalog or load_tool_schema
create_issue_examples = [
    {
        "name": "Create a bug with priority and labels",
        "input": {
            "projectKey": "PROJ",
            "issueType": "Bug",
            "summary": "Login page returns 500 error on mobile Safari",
            "priority": "High",
            "labels": ["mobile", "login"],
            "dueDate": "2026-03-15"
        }
    },
    {
        "name": "Create a story with custom fields",
        "input": {
            "projectKey": "PROJ",
            "issueType": "Story",
            "summary": "Add dark mode toggle to settings page",
            "customFields": {
                "customfield_10001": {"value": "Frontend"},
                "customfield_10005": 3
            }
        }
    }
]

response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=4096,
    tools=[
        {
            "name": "create_issue",
            "description": "Create a new issue in a Jira project...",
            "input_schema": { ... },
            "input_examples": create_issue_examples
        }
    ],
    messages=[{"role": "user", "content": "Create a high priority bug for the login crash"}]
)
```

### Tools with Examples

| Server | Tool | Examples | Key Patterns Demonstrated |
|--------|------|----------|--------------------------|
| jira-projects | `create_issue` | 3 | Custom fields (select, multi-select, user picker), subtasks, dates |
| jira-projects | `update_issue` | 2 | Custom field updates, label replacement |
| jira-projects | `bulk_create_issues` | 1 | Mixed issue types in a batch |
| jira-projects | `transition_issue` | 2 | Resolution field, transition by name |
| jira-projects | `add_comment` | 2 | Role-restricted visibility |
| jira-projects | `search_jql` | 3 | Complex JQL with functions, field selection |
| jira-projects | `create_sprint` | 2 | Date formats, unscheduled sprints |
| jira-projects | `create_issue_type_scheme` | 1 | Issue type ID arrays |
| jira-workflows | `create_workflow` | 2 | Status categories, initial transitions |
| jira-workflows | `setup_workflow_guided` | 2 | Template types, custom statuses |
| jira-workflows | `create_automation_rule` | 3 | Trigger/component/condition nesting, smart values |
| jira-workflows | `update_automation_rule` | 2 | Partial updates, trigger replacement |
| confluence | `create_page` | 3 | Storage format XHTML, child pages, drafts |
| confluence | `update_page` | 2 | Version conflict prevention |
| jira-fields-permissions | `create_permission_grant` | 3 | Holder types (role, group, user) |

---

## Compatibility

### Mutual Exclusivity

The Anthropic API does not support both `defer_loading` and `input_examples` on the same tool simultaneously. When `defer_loading` is enabled, tool schemas (including examples) are not sent in the initial context.

### Recommended Hybrid Strategy

For maximum benefit, use a two-tier approach:

1. **Enable `defer_loading`** on all MCP toolsets to reduce initial context
2. **Embed examples in `load_tool_schema` responses** — when the model loads a tool schema on-demand, it receives the examples as part of the response

This is already how our servers work. The `load_tool_schema` tool returns examples in the `tool.examples` field when using the `json` format (default).

### Alternative: Direct API Integration

If you're building a custom API integration (not using MCP toolsets), you can pass `input_examples` directly:

```python
# Without deferred loading - pass examples directly on tools
response = client.messages.create(
    model="claude-sonnet-4-6",
    tools=[
        {
            "name": "create_issue",
            "description": "...",
            "input_schema": { ... },
            "input_examples": examples_from_catalog
        }
    ],
    messages=[...]
)
```

---

## Adding Examples to New Tools

To add examples for a tool:

1. Edit the appropriate `servers/<server>/src/validation/tool-examples.ts`
2. Add entries to the `toolExamples` record:

```typescript
export const toolExamples: Record<string, ToolInputExample[]> = {
  my_new_tool: [
    {
      name: 'Descriptive name of what this example does',
      input: {
        // Complete valid input object
        requiredField: 'value',
        optionalField: 42,
      },
    },
  ],
};
```

3. Wire into the tool registration file:

```typescript
import { toolExamples } from '../validation/tool-examples.js';

server.registerTool('my_new_tool', {
  // ... existing config ...
  examples: toolExamples['my_new_tool'],
}, handler);
```

4. Rebuild: `npm run build`
5. Regenerate catalog: `npm run generate:tool-catalog`

### Guidelines

- **1-3 examples per tool** — covers minimal, common, and complex scenarios
- **Use realistic values** — real project keys, JQL syntax, date formats
- **Demonstrate tricky parameters** — custom field formats, nested objects, arrays
- **Each example must be a complete, valid input** — the model uses these as templates
