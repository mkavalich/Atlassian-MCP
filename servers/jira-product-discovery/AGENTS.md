# Jira Product Discovery MCP Server

> 11 tools for JPD ideas, insights, and prioritization.

## Build

```bash
npm run build    # Build server
npm run dev      # Development with watch mode
```

## Key Files

```
src/index.ts           # Server entry, tool registration
src/tools/             # Tool implementations
  ideas.ts             # Idea CRUD operations
  insights.ts          # Insight management (GraphQL)
  scoring.ts           # Prioritization scoring
src/graphql/           # GraphQL operations
  queries.ts           # Read operations
  mutations.ts         # Write operations
```

## API Quirks

See `CLAUDE.md` for detailed Atlassian API notes. Key points:
- Ideas use standard Jira REST API (they're specialized issues)
- Insights use **GraphQL** with Polaris namespace, NOT REST
- GraphQL endpoint: `https://api.atlassian.com/graphql`
- Required header: `X-ExperimentalApi: polaris-v0`
- Uses ARIs: `ari:cloud:jira:{cloudId}:project/{projectId}`

## Adding Tools

1. Create/modify tool in `src/tools/`
2. For insights: Add GraphQL operations to `src/graphql/`
3. Register in `src/index.ts`
4. Run `npm run generate:tool-catalog` from project root
5. Update `.claude/skills/*/metadata.yaml` if skill uses this tool
