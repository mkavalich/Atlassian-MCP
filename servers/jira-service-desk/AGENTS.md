# Jira Service Desk MCP Server

> 11 tools for JSM service desks, request types, and customers.

## Build

```bash
npm run build    # Build server
npm run dev      # Development with watch mode
```

## Key Files

```
src/index.ts           # Server entry, tool registration
src/tools/             # Tool implementations by category
  service-desks.ts     # Service desk management
  request-types.ts     # Request type configuration
  customers.ts         # Customer and organization management
```

## API Quirks

See `CLAUDE.md` for detailed Atlassian API notes. Key points:
- Service desk ID is separate from project ID (use `get_service_desk_info` to map)
- Request types wrap issue types with customer-facing configuration
- `groupIds` parameter expects group names, not IDs (API inconsistency)
- Some endpoints use `start`/`limit` instead of `startAt`/`maxResults`

## Adding Tools

1. Create/modify tool in `src/tools/`
2. Register in `src/index.ts`
3. Run `npm run generate:tool-catalog` from project root
4. Update `.claude/skills/*/metadata.yaml` if skill uses this tool
