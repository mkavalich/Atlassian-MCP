# Jira Product Discovery Server

## Atlassian API Quirks

### REST API for Ideas
JPD "ideas" are Jira issues, so standard Jira REST API works:
- Use `/rest/api/3/search/jql` (POST) for searching ideas
- **DEPRECATED**: `/rest/api/3/search` (GET) returns HTTP 410 as of Aug 2025
- New endpoint uses `nextPageToken` and `isLast` instead of `startAt`/`total`

### GraphQL API for Insights (Polaris)
JPD uses **GraphQL** with the Polaris namespace for insights:
- Endpoint: `https://api.atlassian.com/graphql`
- **Required header**: `X-ExperimentalApi: polaris-v0`
- Uses Atlassian Resource Identifiers (ARIs) for project and issue references

ARI format:
- Project: `ari:cloud:jira:{cloudId}:project/{projectId}`
- Issue: `ari:cloud:jira:{cloudId}:issue/{issueId}`

Query structure:
```graphql
query GetIdeaInsights($projectAri: ID!, $containerAri: ID) {
  polarisInsights(project: $projectAri, container: $containerAri) {
    id
    description
    created
    updated
    snippets { id data url }
  }
}
```

Mutations:
- `createPolarisInsight(project, container, description)` - Creates insight
- `updatePolarisInsight(id, description)` - Updates insight description
- `deletePolarisInsight(id)` - Deletes insight

**Note**: Snippets (source URLs/data) cannot be added via GraphQL API - UI only.

### Cloud ID
- JPD requires the Jira Cloud ID, not organization ID
- Found via: `https://{site}.atlassian.net/_edge/tenant_info`
- Different from `ATLASSIAN_ORG_ID`

### Ideas vs Issues
- JPD "ideas" are specialized Jira issues
- They have extra fields (effort, impact, confidence)
- Standard Jira APIs see them as issues, but miss JPD-specific data

### Views and Prioritization
- Views are JPD-specific UI configurations
- Prioritization frameworks apply custom scoring
- Matrix views have axis configurations

## Patterns in This Server

### GraphQL Client
This server uses a GraphQL client, not the REST client:
```typescript
// Different from other servers
import { GraphQLClient } from 'graphql-request';
```

### Query Structure
GraphQL queries are in `src/graphql/`:
- `queries.ts` - Read operations
- `mutations.ts` - Write operations

When adding tools, add corresponding GraphQL operations.

### Scoring
JPD has built-in scoring:
- RICE (Reach, Impact, Confidence, Effort)
- Custom formulas
- Scores update when underlying fields change

## Known Issues

### UI-Only Features (Not Available via API)
The following JPD features can only be managed through the Jira UI:
- **Insight snippets**: Source URLs and data attachments for insights
- **Views configuration**: Creating/modifying JPD views and layouts
- **Prioritization frameworks**: Setting up custom scoring formulas
- **Roadmap swimlanes**: Configuring roadmap groupings

### API Availability
- JPD API is newer and less stable than Jira REST API
- Some features available in UI aren't exposed in API yet
- Check Atlassian developer changelog for updates

### Insights Linking
- Insights link to ideas via a special relationship
- The linking API is particular about ID formats
- Unlinking requires specific mutation

### Roadmap Data
- Roadmap views are complex objects
- Time-based roadmaps have date dependencies
- Changes may not reflect immediately in roadmap views

## Testing Notes

- JPD requires a separate product license
- Test in a dedicated JPD project
- Ideas created in tests should use identifiable naming
- Scoring tests need ideas with all RICE fields populated
