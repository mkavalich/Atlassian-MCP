# Jira Organization MCP Server

> 30 tools for organization-wide user, group, and identity management.

## Build

```bash
npm run build    # Build server
npm run dev      # Development with watch mode
```

## Key Files

```
src/index.ts           # Server entry, tool registration
src/tools/             # Tool implementations by category
  organization.ts      # Org settings and policies
  identity.ts          # Identity providers, directory sync
  users.ts             # User management
  analytics.ts         # Usage analytics and health checks
```

## API Quirks

See `CLAUDE.md` for detailed Atlassian API notes. Key points:
- Uses **Atlassian Admin API**, not Jira REST API
- Base URL: `https://api.atlassian.com/admin/v1/orgs/{orgId}`
- Requires `ATLASSIAN_ORG_ID` environment variable (UUID format)
- Changes affect entire Atlassian organization (Jira, Confluence, etc.)
- Stricter rate limits than Jira API

## Adding Tools

1. Create/modify tool in `src/tools/`
2. Register in `src/index.ts`
3. Run `npm run generate:tool-catalog` from project root
4. Update `.claude/skills/*/metadata.yaml` if skill uses this tool
