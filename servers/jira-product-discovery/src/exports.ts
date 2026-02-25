/**
 * Jira Product Discovery MCP Server - Public Exports
 *
 * This module exports the public API for extension.
 * Import from 'jira-product-discovery-mcp-server/exports' to access these.
 *
 * NOTE: This server has BOTH REST and GraphQL clients:
 * - JiraApiClient: REST API for ideas (Jira issues)
 * - JpdGraphQLClient: GraphQL API for insights, scoring
 *
 * Extension example:
 * ```typescript
 * import { createServer, type ServerHooks } from 'jira-product-discovery-mcp-server/exports';
 *
 * const hooks: ServerHooks = {
 *   transformResponse: async (tool, result) => TokenOptimizer.compress(result),
 *   onToolCall: async (tool, params) => telemetry.track('tool_call', { tool }),
 * };
 *
 * const { start } = await createServer({ hooks });
 * await start();
 * ```
 */

// Server Factory (primary extension point)
export {
  createServer,
  toolCatalog,
  type ServerHooks,
  type ServerConfig,
  type ServerInstance,
} from './server.js';

// Tool Registration Functions (for custom tool composition)
export {
  registerDiscoveryTools,
  registerIdeaTools,
  registerInsightTools,
  registerScoringTools,
} from './server.js';

// API Clients
export { JiraApiClient } from './api/client.js';
export { JpdGraphQLClient } from './api/graphql-client.js';

// Authentication
export { AuthManager } from './auth/index.js';

// Error Handling
export {
  JiraApiError,
  JpdGraphQLError,
  AuthenticationError,
  RateLimitError,
  ValidationError,
  NotFoundError,
  PermissionError,
  mapAtlassianError,
  mapGraphQLError,
  analyzeAtlassianError,
  sanitizeErrorMessage,
  sanitizeErrorDetails,
  ATLASSIAN_ERROR_PATTERNS,
} from './utils/errors.js';

// Logging (includes GraphQL-specific logging)
export { logger, logApiCall, logGraphQLCall, logError } from './utils/logger.js';

// GraphQL Queries
export {
  GET_IDEA_INSIGHTS,
  GET_INSIGHT,
  GET_IDEA_SCORING,
  GET_JPD_PROJECT_CONFIG,
  GET_POLARIS_INSIGHTS,
  GET_INSIGHTS_COUNT,
} from './graphql/queries.js';

// GraphQL Mutations
export {
  CREATE_INSIGHT,
  UPDATE_INSIGHT,
  DELETE_INSIGHT,
  CREATE_POLARIS_INSIGHT,
  UPDATE_POLARIS_INSIGHT,
  DELETE_POLARIS_INSIGHT,
  UPDATE_IDEA_SCORING,
} from './graphql/mutations.js';

// Types - re-export all types for consumers
export type {
  // Core types
  AuthConfig,
  RequestConfig,
  ApiResponse,
  RateLimitInfo,
  // GraphQL types
  GraphQLRequest,
  GraphQLResponse,
  GraphQLErrorDetail,
  // User types
  JiraUser,
  // Project types
  JpdProject,
  // Idea types
  JpdIdea,
  JpdIdeaFields,
  JpdIssueType,
  JpdStatus,
  JpdPriority,
  // Insight types (GraphQL)
  JpdInsight,
  JpdInsightSnippet,
  JpdInsightInput,
  JpdInsightsResponse,
  JpdInsightAnalysis,
  // Scoring types (GraphQL)
  JpdScoringData,
  JpdScore,
  JpdScoringField,
  JpdScoringOption,
  // View types (GraphQL)
  JpdView,
  JpdFilter,
  // Search types
  JpdSearchResult,
  JpdCreateIdeaResponse,
  // Aliases
  JiraSearchResult,
  JiraCreateIssueResponse,
} from './types/index.js';

// Note: Validation schemas are intentionally not exported.
// They are internal implementation details.
// See docs/type-first-schema-plan.md for future schema export strategy.
