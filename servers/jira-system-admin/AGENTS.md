# Jira System Admin MCP Server

> 20 tools for system configuration, audit logs, and reporting.

## Build

```bash
npm run build    # Build server
npm run dev      # Development with watch mode
```

## Key Files

```
src/index.ts           # Server entry, tool registration
src/tools/             # Tool implementations by category
  system.ts            # System configuration
  audit.ts             # Audit log operations
  reporting.ts         # Health and usage reports
  users.ts             # Site-level user search
```

## API Quirks

See `CLAUDE.md` for detailed Atlassian API notes. Key points:
- Most settings require Jira admin (not just project admin)
- Some settings are read-only in Cloud (Data Center only)
- Audit log API has date range limits (~6 months)
- Application properties may require restart to take effect

## Adding Tools

1. Create/modify tool in `src/tools/`
2. Register in `src/index.ts`
3. Run `npm run generate:tool-catalog` from project root
4. Update `.claude/skills/*/metadata.yaml` if skill uses this tool
