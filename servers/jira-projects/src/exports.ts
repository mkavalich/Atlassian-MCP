/**
 * Jira Projects MCP Server - Public Exports
 *
 * This module exports the public API for extension.
 * Import from 'jira-projects-mcp-server/exports' to access these.
 *
 * Extension example:
 * ```typescript
 * import { createServer, type ServerHooks } from 'jira-projects-mcp-server/exports';
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
  registerProjectTools,
  registerIssueTools,
  registerIssueTypeTools,
  registerDashboardTools,
  registerReportingTools,
  registerAttachmentTools,
} from './server.js';

// API Client
export { JiraApiClient } from './api/client.js';

// Authentication
export { AuthManager } from './auth/index.js';

// Error Handling
export {
  JiraApiError,
  AuthenticationError,
  RateLimitError,
  ValidationError,
  NotFoundError,
  PermissionError,
  mapAtlassianError,
  analyzeAtlassianError,
  sanitizeErrorMessage,
  sanitizeErrorDetails,
  ATLASSIAN_ERROR_PATTERNS,
} from './utils/errors.js';

// Logging
export { logger, logApiCall, logError } from './utils/logger.js';

// Types - re-export all types for consumers
export type {
  // Core types
  AuthConfig,
  RequestConfig,
  ApiResponse,
  RateLimitInfo,
  // Project types
  JiraProject,
  CreateProjectInput,
  // Issue types
  JiraIssue,
  JiraIssueFields,
  JiraIssueType,
  JiraIssueTypeScheme,
  JiraIssueTypeScreenScheme,
  JiraIssueTypeMapping,
  JiraScreenScheme,
  JiraCreateIssueResponse,
  // Status and priority types
  JiraStatus,
  JiraPriority,
  JiraResolution,
  // User types
  JiraUser,
  // Component and version types
  JiraComponent,
  JiraVersion,
  // Dashboard types
  JiraDashboard,
  JiraSharePermission,
  JiraDashboardGadget,
  JiraGadgetPosition,
  // Comment types
  JiraComment,
  JiraCommentVisibility,
  JiraCommentPage,
  // Worklog types
  JiraWorklog,
  JiraWorklogPage,
  // Attachment types
  JiraAttachment,
  // Issue link types
  JiraIssueLink,
  JiraIssueLinkType,
  JiraLinkedIssue,
  // Watches and votes types
  JiraWatches,
  JiraVotes,
  // Time tracking types
  JiraTimeTracking,
  // Transition types
  JiraTransition,
  JiraTransitionField,
  // Changelog types
  JiraChangelog,
  JiraChangelogHistory,
  JiraChangelogItem,
  // Parent/subtask types
  JiraIssueParent,
  JiraIssueSubtask,
  // Edit meta types
  JiraEditMeta,
  JiraOperations,
} from './types/index.js';

// Note: Validation schemas are intentionally not exported.
// They are internal implementation details.
// See docs/type-first-schema-plan.md for future schema export strategy.
