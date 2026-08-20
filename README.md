# Atlassian MCP Servers

[![CI](https://github.com/mkavalich/Atlassian-MCP/actions/workflows/ci.yml/badge.svg)](https://github.com/mkavalich/Atlassian-MCP/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![MCP SDK](https://img.shields.io/badge/MCP%20SDK-1.26.0-8A2BE2?style=flat-square)](https://modelcontextprotocol.io/)
[![Servers](https://img.shields.io/badge/servers-8-teal?style=flat-square)](#overview)
[![Tools](https://img.shields.io/badge/tools-280-orange?style=flat-square)](#overview)

Built with ❤️ for the Atlassian community by an overly caffeinated engineer and Claude that doesn't mind navigating Atlassian's GraphQL explorer to work out undocumented JPD mutations at 3am. If you've ever been the one person standing between stakeholder requests and Jira's configuration labyrinth, these tools were made for you.

Open-source [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) servers for Atlassian Cloud. Enables AI assistants like Claude to interact with Jira and Confluence through a standardized tool interface.

## Overview

| Server | Tools | Description |
|--------|-------|-------------|
| **jira-projects** | 60 | Issues, projects, sprints, boards, comments, dashboards, attachments, reporting |
| **jira-workflows** | 42 | Workflows, screens, schemes, automation rules |
| **jira-fields-permissions** | 33 | Custom fields, field configs, permission schemes |
| **jira-service-desk** | 12 | JSM service desks, request types, customer orgs |
| **jira-organization** | 31 | Org management, users, groups, identity providers |
| **jira-system-admin** | 21 | System config, audit logs, webhooks, reporting |
| **jira-product-discovery** | 12 | JPD ideas, insights, scoring |
| **confluence** | 69 | Pages, spaces, comments, attachments, templates, permissions |
| **Total** | **280** | |

> Counts include `search_tools` and `load_tool_schema` utility tools on each server.

## Quick Start

### 1. Prerequisites

- Node.js 18+
- Atlassian Cloud account with [API token](https://id.atlassian.com/manage-profile/security/api-tokens)

### 2. Configure

```bash
cp .env.example .env
```

Required:
```bash
ATLASSIAN_SITE_URL=https://your-domain.atlassian.net
ATLASSIAN_USER_EMAIL=your-email@example.com
ATLASSIAN_API_TOKEN=your-api-token
```

For organization/admin servers, also add:
```bash
ATLASSIAN_ORG_ID=your-organization-id
ATLASSIAN_ORG_ADMIN_TOKEN=your-org-admin-token
```

### 3. Build

```bash
npm install
npm run build:all
```

### 4. Run

**Docker (recommended):**
```bash
docker compose up -d                    # Start all servers
docker compose up -d jira-projects      # Start one server
docker compose ps                       # Check status
```

**Local (stdio for Claude Desktop):**
```bash
cd servers/jira-projects
node dist/index.js
```

### 5. Connect (Claude Desktop)

```json
{
  "mcpServers": {
    "jira-projects": {
      "command": "node",
      "args": ["servers/jira-projects/dist/index.js"],
      "env": {
        "ATLASSIAN_SITE_URL": "https://your-domain.atlassian.net",
        "ATLASSIAN_USER_EMAIL": "your-email@example.com",
        "ATLASSIAN_API_TOKEN": "your-api-token"
      }
    }
  }
}
```

> **Windows users**: Use `cmd /c` wrapper. See [Getting Started](docs/getting-started.md#windows-specific-configuration).

**Docker (stdio via exec):**
```json
{
  "mcpServers": {
    "jira-projects": {
      "command": "docker",
      "args": ["exec", "-i", "-e", "TRANSPORT=stdio", "jira-projects-mcp",
               "sh", "-c", "node /app/servers/jira-projects/dist/index.js"]
    }
  }
}
```

### 6. Verify

```bash
# Docker health check
curl http://localhost:3001/health

# Or use search_tools in Claude to discover available tools
```

## Architecture

```
┌─────────────────────┐
│   Claude Desktop    │
│   Claude Code       │  MCP (stdio or HTTP)
│   Custom Apps       │
└────┬───┬───┬───┬────┘
     │   │   │   │   ...connects to each server independently
     ▼   ▼   ▼   ▼
  jira-  jira-    jira-   jira-    jira-  jira-    jpd  confluence
 projects workflows fields  service  org   system
                   perms   desk          admin
```

Eight specialized servers, each running independently. Clients connect to whichever servers they need — a team using only Jira issues and Confluence pages connects to just `jira-projects` and `confluence`.

## Optimizations

### Response Caching

In-memory LRU cache (500 entries) applied to all GET requests, reducing Atlassian API calls by 20-60%.

| TTL Tier | Duration | Use Case |
|----------|----------|----------|
| `STATIC` | 30 min | Issue types, statuses, field configs |
| `SEMI_STATIC` | 10 min | Project metadata, user info (default) |
| `DYNAMIC` | 2 min | Issue lists, search results |
| `REALTIME` | 30 sec | Notifications, activity feeds |

Write operations (POST/PUT/DELETE) bypass the cache and trigger path-based invalidation.

### Deferred Schema Loading — opt-in

Replaces each tool's `inputSchema` in `tools/list` with an empty object schema, so clients fetch the real one on demand via `load_tool_schema` (registered automatically on every server). Enable with:

```bash
MCP_DEFER_TOOL_SCHEMAS=true
```

**Measured across all 8 servers** (`tools/list` payload, stdio, both settings on the same build):

| | Off (default) | On | Reduction |
|---|---|---|---|
| Total payload | 269 KB | 142 KB | **47.3%** |
| Approx. tokens | ~68,800 | ~36,200 | — |
| Tools carrying a full schema | 266 / 280 | 16 / 280 | — |

Per server the reduction ranges 38–50%; the remainder is tool *descriptions*, which are not touched. Reproduce with `scripts/measure-listing.mjs`.

**Why it is opt-in.** A client that does not know to call `load_tool_schema` sees tools with no parameters and cannot call them correctly. `search_tools` and `load_tool_schema` are never minimised, so a client can always recover what it is missing.

**Argument validation is unaffected.** The minimisation happens on the `tools/list` response, not at registration — the SDK still holds every full schema and still validates every `tools/call`. Stripping at registration would have silently disabled validation server-wide.

### Tool Use Examples

15 high-complexity tools include structured `input_examples` that improve LLM accuracy from ~72% to ~90% on complex parameter patterns (custom fields, JQL syntax, nested automation rules). Examples are available via:

- `load_tool_schema` (runtime) — Returns examples in the `tool.examples` field
- `schemas/tools.json` (build-time) — Complete tool catalog with all examples

See [Optimization Guide](docs/optimization-guide.md) for integration details.

### Response Formatting

Compact output modes reduce token consumption:

- **concise** (default) — TOON/TSV format, minimal whitespace
- **detailed** — Full JSON with metadata
- **markdown** — Human-readable tables

A `responseFormat` parameter is injected into every tool's input schema automatically.

### Security Annotations

All tools are annotated with MCP security hints (`readOnlyHint`, `destructiveHint`) to help clients distinguish safe read operations from destructive ones like deletes.

## MCP Server Details

### jira-projects (60 tools)

| Category | Tools |
|----------|-------|
| Issues | `create_issue`, `get_issue`, `update_issue`, `delete_issue`, `bulk_create_issues`, `assign_issue`, `get_issue_editmeta_fields` |
| Transitions | `get_transitions`, `transition_issue` |
| Comments | `add_comment`, `get_comments`, `update_comment`, `delete_comment` |
| Attachments | `add_attachment`, `get_attachment`, `list_issue_attachments`, `delete_attachment`, `get_attachment_meta` |
| Projects | `search_projects`, `create_project`, `get_project`, `update_project`, `delete_project` |
| Dashboards | `get_dashboards`, `create_dashboard`, `get_dashboard`, `update_dashboard`, `delete_dashboard` |
| Issue Types | `get_issue_types`, `create_issue_type`, `update_issue_type`, `delete_issue_type`, `get_issue_type_schemes`, `create_issue_type_scheme`, `update_issue_type_scheme`, `delete_issue_type_scheme`, `get_issue_type_scheme_mappings`, `add_issue_types_to_scheme`, `assign_issue_type_scheme_to_project`, `get_issue_createmeta_issuetypes`, `get_issue_createmeta_fields` |
| Search & Reporting | `search_jql`, `generate_project_report`, `get_project_analytics` |
| Agile (Sprints & Boards) | `get_boards`, `get_board`, `get_board_configuration`, `get_board_backlog`, `create_board`, `delete_board`, `get_sprints_for_board`, `create_sprint`, `get_sprint`, `update_sprint`, `delete_sprint`, `get_sprint_issues`, `move_issues_to_sprint`, `move_issues_to_backlog` |

### jira-workflows (39 tools)

| Category | Tools |
|----------|-------|
| Workflows | `get_workflows`, `create_workflow`, `delete_workflow`, `get_statuses`, `get_workflow_schemes_basic` |
| Guided Setup | `setup_workflow_guided` |
| Workflow Schemes | `get_workflow_schemes_detailed`, `create_workflow_scheme`, `update_workflow_scheme`, `set_workflow_scheme_issue_type`, `delete_workflow_scheme_issue_type` |
| Screens | `get_screens`, `create_screen`, `update_screen`, `delete_screen`, `get_screen_available_fields`, `add_field_to_screen`, `add_field_to_default_screen` |
| Screen Tabs | `get_screen_tabs`, `create_screen_tab`, `update_screen_tab`, `delete_screen_tab`, `get_screen_tab_fields`, `remove_field_from_screen_tab`, `move_screen_tab_field` |
| Screen Schemes | `get_screen_schemes`, `create_screen_scheme`, `delete_screen_scheme` |
| Automation | `get_automation_rules`, `get_automation_rule_details`, `get_automation_templates`, `get_automation_component_types`, `create_automation_rule`, `update_automation_rule`, `enable_disable_automation_rule` |

### jira-fields-permissions (31 tools)

| Category | Tools |
|----------|-------|
| Fields | `get_fields_paginated`, `create_custom_field`, `update_custom_field`, `delete_custom_field` |
| Field Configs | `get_field_configurations`, `create_field_configuration`, `update_field_configuration`, `get_field_configuration_schemes`, `create_field_configuration_scheme` |
| Field Contexts | `get_custom_field_contexts`, `create_custom_field_context`, `update_custom_field_context`, `delete_custom_field_context`, `get_custom_field_options`, `create_custom_field_options` |
| Notifications | `get_notification_schemes`, `create_notification_scheme`, `get_notification_screens`, `create_notification_screen`, `add_field_to_notification_screen` |
| Permissions | `get_permission_schemes`, `create_permission_scheme`, `update_permission_scheme`, `delete_permission_scheme`, `get_permission_grants`, `create_permission_grant`, `delete_permission_grant`, `get_global_permissions`, `get_my_permissions` |

### jira-service-desk (12 tools)

| Category | Tools |
|----------|-------|
| Service Desks | `get_service_desks`, `get_request_types`, `create_request_type`, `get_request_type_fields`, `configure_request_type_workflow` |
| Customer Orgs | `get_customer_organizations`, `get_organization_customers`, `get_customer_organization_membership`, `get_project_customer_organizations`, `analyze_customer_visibility` |

### jira-organization (31 tools)

All read-only tools for organization-wide management and analytics.

| Category | Tools |
|----------|-------|
| Organization | `get_organizations`, `get_organization_details`, `get_organization_info`, `get_organization_policies`, `get_organization_domains`, `get_organization_workspaces`, `get_organization_events` |
| Users | `get_organization_users`, `search_organization_users`, `get_user_role_assignments`, `get_user_group_memberships`, `analyze_user_access` |
| User Management | `get_user_manage`, `get_user_manage_profile`, `get_user_manage_api_tokens`, `get_org_user_stats`, `get_org_group_stats` |
| Identity Providers | `get_identity_providers`, `get_directory_info`, `get_directory_sync_status`, `get_directory_sync_settings`, `get_directory_users`, `get_user_last_active` |
| Directory Health | `get_scim_directory_groups`, `get_directory_health_status`, `get_provisioning_insights` |
| Analytics | `get_cross_product_user_activity`, `get_enhanced_identity_provider_insights`, `get_advanced_directory_health_monitoring`, `get_user_behavior_pattern_analysis` |

### jira-system-admin (21 tools)

| Category | Tools |
|----------|-------|
| System | `get_instance_info`, `get_system_limits`, `get_audit_records`, `get_jira_license`, `get_system_webhooks` |
| Configuration | `get_application_properties`, `set_application_property`, `get_time_tracking_settings`, `update_time_tracking_settings`, `get_application_roles` |
| Users & Groups | `search_site_users`, `search_groups`, `get_site_user_groups`, `get_bulk_permissions` |
| Filters & Misc | `create_filter`, `get_system_avatars` |
| Reporting | `export_project_data`, `export_user_data`, `generate_system_report`, `generate_usage_analytics`, `generate_health_check_report` |

### jira-product-discovery (12 tools)

| Category | Tools |
|----------|-------|
| Projects | `get_jpd_projects` |
| Ideas | `get_ideas`, `search_ideas`, `get_idea`, `create_idea`, `update_idea`, `delete_idea` |
| Insights | `get_insights`, `get_insight`, `create_insight`, `update_insight`, `delete_insight`, `analyze_idea_insights` |
| Scoring | `get_idea_scoring` |

### confluence (69 tools)

| Category | Tools |
|----------|-------|
| Spaces | `search_spaces`, `get_space`, `create_space`, `update_space`, `delete_space`, `archive_space`, `restore_space`, `get_space_content`, `get_space_settings`, `update_space_settings`, `get_space_theme`, `set_space_theme` |
| Pages | `search_pages`, `get_page`, `create_page`, `update_page`, `delete_page`, `get_page_versions`, `get_page_version`, `get_page_children`, `get_page_ancestors`, `move_page`, `copy_page`, `get_page_restrictions`, `set_page_restrictions`, `get_page_likes` |
| Comments | `get_page_comments`, `get_footer_comments`, `get_inline_comments`, `add_footer_comment`, `add_inline_comment`, `update_comment`, `delete_comment`, `get_comment_children` |
| Attachments | `get_attachments`, `get_attachment`, `upload_attachment`, `update_attachment`, `delete_attachment`, `download_attachment`, `get_attachment_versions`, `copy_attachment` |
| Content | `search_cql`, `search_content`, `get_labels`, `add_labels`, `remove_label`, `get_space_labels`, `add_space_label`, `remove_space_label` |
| Templates | `get_templates`, `get_template`, `create_template`, `update_template`, `delete_template` |
| Blog Posts | `get_blog_posts`, `get_blog_post`, `create_blog_post`, `update_blog_post`, `delete_blog_post` |
| Properties | `get_content_properties`, `create_content_property`, `update_content_property`, `delete_content_property` |
| Watchers | `get_content_watchers`, `add_content_watch`, `remove_content_watch`, `get_space_watchers` |
| Content States | `get_content_states`, `set_content_state` |
| Permissions | `get_space_permissions`, `add_space_permission`, `remove_space_permission`, `get_space_permission_users`, `copy_space_permissions`, `get_permission_types`, `check_content_permission`, `bulk_update_permissions` |
| Admin | `get_audit_records`, `get_system_info` |

## Tool Discovery

All servers include a `search_tools` meta-discovery tool:

```javascript
search_tools({ category: 'pages', type: 'discovery' })
// Returns filtered tool list with getting_started workflow and suggested_next_steps
```

## Skills

Skills are guided workflows that orchestrate multiple tools for complex, multi-step tasks. They encode institutional knowledge about Atlassian best practices, dependency chains, and multi-step procedures.

### Using Skills

**Claude Code:** Skills are automatically discovered from `.claude/skills/`. Invoke with `/skill-name` or describe the task.

**Claude Desktop:** Package and upload skills as ZIP files:
```bash
npm run package:skills    # Creates dist/skills/*.zip
```
Then upload each ZIP via Claude Desktop → Settings → Capabilities → Upload Custom Skill.

### Atlassian Workflow Skills

| Skill | Servers | Purpose |
|-------|---------|---------|
| `atlassian-project-setup` | jira-projects, jira-workflows, jira-fields-permissions, jira-service-desk, confluence | Dependency-aware Jira project provisioning |
| `confluence-space-health-audit` | confluence | Audit space for stale pages, permission issues |
| `confluence-template-library-builder` | confluence | Create ADR, Runbook, API spec templates |
| `jpd-prioritization-review` | jira-product-discovery | Backlog readiness report for planning |
| `sprint-health-reporter` | jira-projects, confluence | Sprint metrics, velocity, blockers report |
| `jpd-idea-to-delivery` | jira-product-discovery, jira-projects, confluence | Convert JPD idea to Epic with traceability |

### atlassian-project-setup

Dependency-aware Jira Cloud project provisioning with spec gap analysis and incremental verification. Use this skill when setting up:

- Jira Software projects (Scrum/Kanban)
- Jira Service Management projects with request types
- Business projects
- Confluence documentation spaces
- Workflow schemes, issue type schemes, screen schemes, field configurations

**Why use the skill?** Jira Cloud objects exist in a strict dependency hierarchy. Creating a workflow without a workflow scheme, or issues without an issue type scheme assigned to the project, produces orphaned objects that appear to succeed but don't function. This skill enforces pre-flight validation, spec gap analysis, and incremental smoke testing at every phase.

**Invoke with:** `/atlassian-project-setup` or describe a project setup task

### confluence-space-health-audit

Audit a Confluence space for content health issues:

- Stale pages not updated in 180+ days
- Unlabeled pages missing categorization
- Permission anomalies differing from space baseline
- Draft backlog of unpublished content
- Orphaned pages with broken hierarchy

**Invoke with:** `/confluence-space-health-audit` or ask to "audit a space", "find stale pages", "check space health"

### confluence-template-library-builder

Create a documentation template library with common templates and examples:

- Architecture Decision Records (ADR)
- Runbooks for operational procedures
- API Specifications
- Meeting Notes
- Technical Design documents
- Postmortem templates

**Invoke with:** `/confluence-template-library-builder` or ask to "set up templates", "create doc standards"

### jpd-prioritization-review

Generate a prioritization readiness report for JPD projects:

- Scoring completeness analysis
- Evidence coverage (insights) per idea
- Readiness categorization for planning
- Top ideas by different criteria
- Data gap identification

**Invoke with:** `/jpd-prioritization-review` or ask to "review idea backlog", "check prioritization readiness"

### sprint-health-reporter

Generate comprehensive sprint health reports:

- Current sprint status and completion percentage
- Velocity trends across sprints
- Slip rate (rollover from previous sprints)
- Blocked items requiring attention
- Workload distribution by team member
- Optional Confluence page publication

**Invoke with:** `/sprint-health-reporter` or ask for "sprint report", "velocity report", "sprint health"

### jpd-idea-to-delivery

Translate an approved JPD idea into delivery artifacts:

- Jira Epic with prioritization context and evidence
- Confluence specification page
- Bidirectional linking (Epic ↔ Idea ↔ Spec)
- Preserved scoring rationale and customer evidence

**Invoke with:** `/jpd-idea-to-delivery` or ask to "create epic from idea", "move idea to delivery"

## Examples

Real-world scenarios demonstrating how AI assistants use these tools to solve everyday Atlassian administration and collaboration challenges.

### Example 1: Sprint Health Check and Stale Issue Cleanup

A scrum master preparing for sprint retrospective asks Claude to analyze the current state of their board.

**User prompt:**
> "We're closing Sprint 24 tomorrow. Can you find all issues in project PLATFORM that are still In Progress or In Review, show me who's assigned, and flag anything that hasn't been updated in over a week? Also pull the sprint report so I can see our velocity trend."

**Tools used:** `search_jql` | `get_issue` | `generate_project_report` (jira-projects)

Claude executes a JQL search (`project = PLATFORM AND sprint in openSprints() AND status in ("In Progress", "In Review") ORDER BY updated ASC`), iterates through results to surface assignees and last-updated timestamps, flags stale items, and calls `generate_project_report` to pull velocity and completion metrics — giving the scrum master a single consolidated view before their retro.

---

### Example 2: Onboarding a New JSM Service Desk with Request Types

An IT operations lead is setting up a new service desk for their infrastructure team and needs request types wired to the right workflows.

**User prompt:**
> "Set up request types on our INFRA service desk for 'Cloud Access Request', 'VPN Issue', and 'Server Provisioning'. Each one should collect different fields. Then show me what customer organizations currently have visibility so I know who can submit requests."

**Tools used:** `get_service_desks` | `create_request_type` | `get_request_type_fields` | `configure_request_type_workflow` | `analyze_customer_visibility` (jira-service-desk)

Claude retrieves the INFRA service desk ID, creates three request types with appropriate descriptions, configures which fields appear on each intake form, maps them to the correct workflow transitions, and then calls `analyze_customer_visibility` to report which customer organizations can currently see and submit requests — highlighting any gaps in access.

---

### Example 3: Confluence Knowledge Base Scaffold with Permissions

A documentation lead needs to stand up a new product knowledge base space with a consistent page hierarchy and locked-down permissions before a launch.

**User prompt:**
> "Create a Confluence space called 'Payments Platform' with key PAY. Set up top-level pages for Architecture, Runbooks, API Reference, and Onboarding. Add the 'Technical Documentation' template to the space. Then lock down permissions so only the payments-engineering group can edit, but the whole company can view."

**Tools used:** `create_space` | `create_page` | `create_template` | `get_space_permissions` | `add_space_permission` | `bulk_update_permissions` (confluence)

Claude creates the space, builds out the four top-level pages (each with placeholder structure in Atlassian Document Format), attaches the template, then audits current permissions with `get_space_permissions` and applies granular grants — view-only for the default group, edit access for `payments-engineering` — confirming the final permission state back to the user.

---

### Example 4: Workflow and Automation Setup for a New Project

A Jira admin is spinning up a new project and needs a custom workflow with automation rules that enforce the team's process.

**User prompt:**
> "Create a workflow called 'Engineering Review Flow' with statuses: Backlog → In Development → Code Review → QA → Done. Then create an automation rule that auto-transitions issues to Code Review when a pull request is linked, and another rule that notifies the #releases Slack channel when an issue moves to Done. Assign this workflow to the CORE project."

**Tools used:** `get_statuses` | `create_workflow` | `get_automation_templates` | `create_automation_rule` | `enable_disable_automation_rule` | `create_workflow_scheme` | `set_workflow_scheme_issue_type` (jira-workflows)

Claude checks available statuses (creating any missing ones), builds the workflow with the specified transitions, creates both automation rules using the appropriate trigger/action component types, enables them, then wires the workflow to the CORE project through a workflow scheme — delivering a fully operational process in minutes instead of hours of manual admin console clicking.

## Project Structure

```
atlassian-mcp-servers/
├── servers/                    # 8 MCP server implementations
│   ├── confluence/
│   ├── jira-fields-permissions/
│   ├── jira-organization/
│   ├── jira-product-discovery/
│   ├── jira-projects/
│   ├── jira-service-desk/
│   ├── jira-system-admin/
│   └── jira-workflows/
├── docs/
│   ├── development-guide.md    # Adding tools and creating servers
│   ├── getting-started.md      # Setup and configuration
│   ├── optimization-guide.md   # Deferred loading and tool examples
│   └── tool-catalog.md         # Complete tool reference
├── deploy/                     # Docker and cloud deployment configs
├── AGENTS.md                   # For AI agents working on this codebase
└── CONTRIBUTING.md
```

## Documentation

- [Getting Started](docs/getting-started.md) - Setup and configuration
- [Development Guide](docs/development-guide.md) - Adding tools and creating servers
- [Tool Catalog](docs/tool-catalog.md) - Complete tool reference
- [Optimization Guide](docs/optimization-guide.md) - Deferred loading and tool use examples
- [AGENTS.md](AGENTS.md) - For AI agents working on this codebase
- [CHANGELOG.md](CHANGELOG.md) - Version history

## License

[MIT](LICENSE)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## Security

See [SECURITY.md](SECURITY.md) for security policy and reporting.

## Privacy

These MCP servers process data through your Atlassian Cloud instance:
- All data flows directly between the MCP server and Atlassian APIs
- Servers do not persist any user data
- API tokens are used only for Atlassian API authentication
- Minimal request logging for debugging, no PII captured

See [PRIVACY.md](PRIVACY.md) for the full privacy policy.
