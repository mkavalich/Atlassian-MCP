# Confluence MCP Server

> 68 tools for spaces, pages, comments, attachments, and templates.

## Build

```bash
npm run build    # Build server
npm run dev      # Development with watch mode
```

## Key Files

```
src/index.ts           # Server entry, tool registration
src/tools/             # Tool implementations by category
  spaces.ts            # Space management
  pages.ts             # Page CRUD operations
  comments.ts          # Page comments
  attachments.ts       # File attachments
  templates.ts         # Content templates
  search.ts            # CQL search operations
```

## API Quirks

See `CLAUDE.md` for detailed Atlassian API notes. Key points:
- Uses V2 API (`/wiki/api/v2/`) where possible, legacy for missing features
- Content uses "storage format" (XHTML-based)
- Must expand fields explicitly (`body.storage`, `version`, etc.)
- Version conflicts on concurrent edits

## Adding Tools

1. Create/modify tool in `src/tools/`
2. Register in `src/index.ts`
3. Run `npm run generate:tool-catalog` from project root
4. Update `.claude/skills/*/metadata.yaml` if skill uses this tool
