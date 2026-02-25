# Jira Workflows MCP Server

> 33 tools for workflows, screens, schemes, and automation rules.

## Build

```bash
npm run build    # Build server
npm run dev      # Development with watch mode
```

## Key Files

```
src/index.ts           # Server entry, tool registration
src/tools/             # Tool implementations by category
  workflows.ts         # Workflow CRUD operations
  screens.ts           # Screen management
  screen-schemes.ts    # Screen scheme mapping
  automation.ts        # Automation rules
  guided-workflows.ts  # High-level workflow helpers
```

## API Quirks

See `CLAUDE.md` for detailed Atlassian API notes. Key points:
- Workflows can't be edited while in use (create draft first)
- Automation rules require `authorAccountId` from existing rules
- Screen tab ordering requires explicit API calls

## Adding Tools

1. Create/modify tool in `src/tools/`
2. Register in `src/index.ts`
3. Run `npm run generate:tool-catalog` from project root
4. Update `.claude/skills/*/metadata.yaml` if skill uses this tool
