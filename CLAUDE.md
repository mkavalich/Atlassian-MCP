# Atlassian MCP Servers

### Quick Start

1. Read the skill: `.claude/skills/tool-validation/SKILL.md`
2. MCP servers configured in: `.mcp.json`
3. Results tracked in: `test-results/results.json`

### Testing Workflow

Follow the 5-phase approach in the skill:
```
Phase 1: Discovery (read-only) → Validates connectivity, discovers IDs
Phase 2: Create → Creates test entities with MCP_TEST_ prefix  
Phase 3: Read → Validates entity retrieval
Phase 4: Update → Modifies test entities
Phase 5: Delete → Cleans up test data
```

---

## Operational Guidelines

### Task Routing

| Task Type | Action |
|-----------|--------|
| **Test MCP tools** | Read `.claude/skills/tool-validation/SKILL.md` |
| Build/modify MCP server | Read `.claude/skills/mcp-builder/SKILL.md` first |
| Add tools to existing server | Read skill, then examine existing patterns in that server |
| Fix failing server | Check `reference/mcp_best_practices.md` for debugging checklist |
| Update documentation | See Documentation section below |
| Create/modify skills | Update `metadata.yaml` with tool dependencies |

### Workflow: Explore → Plan → Implement → Verify

1. **Explore**: Read relevant files before proposing changes. For MCP work, always read the skill first.
2. **Plan**: State your approach before writing code. For complex changes, create a checklist.
3. **Implement**: Follow patterns established in existing servers. Use TypeScript for new servers.
4. **Verify**: Build must pass (`npm run build`). Test with actual MCP client, not just unit tests.

### Quality Standards

- **Correctness** > Maintainability > Performance
- All tools must have complete annotations (readOnlyHint, destructiveHint, idempotentHint, openWorldHint)
- Zod schemas required for all tool inputs with `.strict()` enforcement
- Tool descriptions must document parameters, return types, and usage examples
- No `any` types in TypeScript

### When Unsure

- Check existing server implementations for patterns
- Read the mcp-builder skill reference files
- Ask clarifying questions before making architectural changes

---

## Pre-Push Validation

**Automatic**: A hook runs validation before `git push` to ensure tools and skills stay in sync.

**Manual**: Run validation anytime with:
```bash
npm run validate:all
```

This runs:
1. `generate:tool-catalog` → Updates `schemas/tools.json` + `docs/tool-catalog.md`
2. `validate:skills` → Checks all skills reference valid tools

If validation fails:
- Check tool names for typos in skill files
- Ensure tools weren't renamed or removed
- Update skill `metadata.yaml` if tool dependencies changed

---

## Documentation

Update docs **in the same session** as related code changes.

| Change | Update |
|--------|--------|
| Add/remove/modify tools | Run `npm run generate:tool-catalog` |
| Add new server | Update root `README.md`, create `servers/<n>/README.md` |
| Change architecture | Update `docs/architecture.md` |
| Change setup/install | Update `docs/getting-started.md` |
| Create/modify skill | Update skill's `metadata.yaml` with tool dependencies |

Detailed documentation standards are in `.claude/rules/documentation.md` (loads automatically when editing docs).

---

## Project Context

### Server Locations

All MCP servers are in `servers/`:
- `jira-projects` - Issues, projects, sprints, boards, dashboards, attachments (60 tools)
- `jira-workflows` - Workflows, screens, automation rules (39 tools)
- `jira-service-desk` - JSM queues, SLAs, customers (12 tools)
- `jira-fields-permissions` - Custom fields, field configurations, permissions (31 tools)
- `jira-organization` - Users, groups, organization management (31 tools)
- `jira-system-admin` - System settings, audit logs, reporting (21 tools)
- `jira-product-discovery` - JPD ideas, insights, roadmaps (12 tools)
- `confluence` - Spaces, pages, content management (69 tools)

**Total: 275 tools across 8 servers**

### Skills

Available skills in `.claude/skills/`:

**Atlassian Workflows:**
- `atlassian-project-setup` - Dependency-aware Jira project provisioning
- `confluence-space-health-audit` - Audit spaces for stale pages, permissions
- `confluence-template-library-builder` - Create ADR, Runbook, API spec templates
- `jpd-prioritization-review` - Backlog readiness reports for planning
- `sprint-health-reporter` - Sprint metrics, velocity, blockers
- `jpd-idea-to-delivery` - Convert JPD ideas to Epics with traceability

**Development & Quality:**
- `tool-validation` - Integration testing of MCP tools
- `mcp-builder` - Guide for creating MCP servers
- `security-audit` - Security assessment for MCP servers
- `memory-leak-detection` - Memory leak diagnosis for Node.js servers

### Environment

Credentials in `.env` at project root:
- `ATLASSIAN_SITE_URL` - Your Atlassian site URL
- `ATLASSIAN_USER_EMAIL` - API user email  
- `ATLASSIAN_API_TOKEN` - API token
- `ATLASSIAN_ORG_ID` - Organization ID (for admin APIs)

### Key Commands

```bash
# Building
npm run build                  # Build server (run from server directory)
npm run dev                    # Development with watch mode

# Validation
npm run generate:tool-catalog  # Regenerate tool schema and docs
npm run validate:skills        # Validate skills against schema
npm run validate:all           # Run both (same as pre-push hook)

# Docker
docker-compose up -d           # Start all containers
```

### After Implementation

1. Verify `npm run build` succeeds
2. Test with Claude Desktop or JSON-RPC commands
3. Update `config/clients/claude-desktop-config.json` if adding new server
4. Run `npm run validate:all` before pushing

---

## Docker Deployment (not npm packages)

These MCP servers are **not published to npm**. Instead of the typical MCP pattern (`npx @org/package-name`), we use Docker containers.

### Why Docker instead of npm?

The servers share a workspace package (`@atlassian-mcp/shared`) that creates complications for npm publishing:
- npm workspaces don't resolve cleanly when packages are published standalone
- Each server would need to bundle or depend on a published `@atlassian-mcp/shared`
- Docker provides consistent runtime across platforms without package resolution issues

### How it works

1. **Build**: `docker-compose build` creates images from the monorepo root context
2. **Run**: Containers run continuously with HTTP transport internally
3. **Connect**: MCP clients use `docker exec` with stdio transport to communicate

```json
{
  "jira-projects": {
    "command": "docker",
    "args": ["exec", "-i", "-e", "TRANSPORT=stdio", "jira-projects-mcp",
             "sh", "-c", "node /app/servers/jira-projects/dist/index.js"]
  }
}
```

### Future consideration

To publish to npm, we would need to either:
1. Bundle `@atlassian-mcp/shared` into each server at build time (esbuild with `bundle: true`)
2. Publish `@atlassian-mcp/shared` as a separate npm package first
3. Use a monorepo publishing tool (Lerna, Changesets, Turborepo)

---

## Claude Code Configuration

### MCP Server Configuration (Windows)

On Windows, MCP servers using `npx` require a `cmd /c` wrapper in `.mcp.json`:

```json
{
  "mcpServers": {
    "jira-projects": {
      "command": "cmd",
      "args": ["/c", "npx", "tsx", "servers/jira-projects/src/index.ts"],
      "env": { ... }
    }
  }
}
```

Without this wrapper, Claude Code will show warnings like:
```
[Warning] mcpServers.jira-projects: Windows requires 'cmd /c' wrapper to execute npx
```

### Settings File Syntax

Claude Code settings files (`.claude/settings.json`, `.claude/settings.local.json`) use specific wildcard syntax for permissions:

| Pattern | Meaning | Example |
|---------|---------|---------|
| `Bash(cmd:*)` | Prefix match (cmd followed by anything) | `Bash(npm run:*)` matches `npm run build`, `npm run test` |
| `Bash(cmd *)` | **Invalid** - will cause config errors | Don't use space before `*` |
| `Bash(cmd)` | Exact match only | Matches only `cmd` with no arguments |

**Common mistake**: Using `Bash(npm run *)` instead of `Bash(npm run:*)`. The colon is required for prefix matching.

If you see settings errors on startup like:
```
Use ":*" for prefix matching, not just "*"
```

Fix by changing patterns from `Bash(command *)` or `Bash(command*)` to `Bash(command:*)`.
