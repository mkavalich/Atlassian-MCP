# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-02-24

Initial open-source release of Atlassian MCP Servers.

### Servers

- **jira-projects** (60 tools) - Issues, projects, sprints, boards, dashboards, attachments, reporting
- **jira-workflows** (39 tools) - Workflows, screens, schemes, automation rules
- **jira-fields-permissions** (31 tools) - Custom fields, field configurations, permission schemes
- **jira-service-desk** (12 tools) - JSM service desks, request types, customer organizations
- **jira-organization** (31 tools) - Organization management, users, groups, identity providers
- **jira-system-admin** (21 tools) - System configuration, audit logs, webhooks, reporting
- **jira-product-discovery** (12 tools) - JPD ideas, insights, scoring
- **confluence** (69 tools) - Pages, spaces, comments, attachments, templates, permissions

### Skills

- `atlassian-project-setup` - Dependency-aware Jira project provisioning
- `confluence-space-health-audit` - Audit spaces for stale pages, permissions
- `confluence-template-library-builder` - Create ADR, Runbook, API spec templates
- `jpd-prioritization-review` - Backlog readiness report for planning
- `sprint-health-reporter` - Sprint metrics, velocity, blockers report
- `jpd-idea-to-delivery` - Convert JPD ideas to Epics with traceability

### Optimizations

- Response caching with tiered TTL (30s to 30min)
- Deferred schema loading (60-75% reduction in `tools/list` response size)
- Tool use examples on 15 high-complexity tools
- Compact response formatting (TOON/TSV, detailed, markdown)
- MCP security annotations on all tools

### Infrastructure

- Docker Compose deployment for all 8 servers
- CI pipeline with security audit, multi-node build (Node 18/20/22), MCP validation
- Shared packages (`@atlassian-mcp/shared`, `@atlassian-mcp/optimizations`)
- Pre-push validation hooks for tool catalog and skill synchronization
