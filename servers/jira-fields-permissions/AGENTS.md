# Jira Fields & Permissions MCP Server

> 30 tools for custom fields, field configurations, and permission schemes.

## Build

```bash
npm run build    # Build server
npm run dev      # Development with watch mode
```

## Key Files

```
src/index.ts           # Server entry, tool registration
src/tools/             # Tool implementations by category
  fields.ts            # Custom field management
  field-contexts.ts    # Field context operations
  field-config.ts      # Field configurations
  permissions.ts       # Permission schemes
  notifications.ts     # Notification schemes
```

## API Quirks

See `CLAUDE.md` for detailed Atlassian API notes. Key points:
- Field IDs: `customfield_XXXXX` format, system fields use short names
- Field contexts determine project/issue type visibility
- Cannot delete configurations in use by schemes
- Permission checks are complex; use the permission check API

## Adding Tools

1. Create/modify tool in `src/tools/`
2. Register in `src/index.ts`
3. Run `npm run generate:tool-catalog` from project root
4. Update `.claude/skills/*/metadata.yaml` if skill uses this tool
