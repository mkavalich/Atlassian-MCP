# Jira Projects MCP Server

> 38 tools for projects, issues, comments, dashboards, and attachments.

## Build

```bash
npm run build    # Build server
npm run dev      # Development with watch mode
```

## Key Files

```
src/index.ts           # Server entry, tool registration
src/tools/             # Tool implementations by category
  projects.ts          # Project CRUD operations
  issues.ts            # Issue management
  comments.ts          # Issue comments
  dashboards.ts        # Dashboard operations
  attachments.ts       # File attachments
```

## API Quirks

See `CLAUDE.md` for detailed Atlassian API notes. Key points:
- Project keys: 2-10 uppercase chars, starting with letter
- Pagination: `startAt` (0-indexed), `maxResults` (max 100)
- Use `expand` parameters to reduce API calls

## Adding Tools

1. Create/modify tool in `src/tools/`
2. Register in `src/index.ts`
3. Run `npm run generate:tool-catalog` from project root
4. Update `.claude/skills/*/metadata.yaml` if skill uses this tool
