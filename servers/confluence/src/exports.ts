/**
 * Confluence MCP Server - Public Exports
 *
 * This module exports the public API for extension.
 * Import from 'confluence-mcp-server/exports' to access these.
 */

// Server Factory (primary extension point)
export {
  createServer,
  toolCatalog,
  type ServerHooks,
  type ServerConfig,
  type ServerInstance,
} from './server.js';

// Tool Registration Functions
export {
  registerPageTools,
  registerSpaceTools,
  registerPermissionTools,
  registerCommentTools,
  registerAttachmentTools,
  registerContentTools,
  registerAdminTools,
} from './server.js';

// API Client
export { ConfluenceApiClient } from './api/client.js';

// Authentication
export { AuthManager } from './auth/index.js';
export type { AuthConfig } from './auth/index.js';

// Error Handling
export {
  ConfluenceApiError,
  AuthenticationError,
  RateLimitError,
  ValidationError,
  NotFoundError,
  PermissionError,
  mapAtlassianError,
  analyzeConfluenceError,
  sanitizeErrorMessage,
  sanitizeErrorDetails,
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
  PaginatedResponse,
  CursorPaginatedResponse,
  // Space types
  ConfluenceSpace,
  CreateSpaceInput,
  UpdateSpaceInput,
  SpacePermission,
  AddSpacePermissionInput,
  // Page types
  ConfluencePage,
  ContentVersion,
  CreatePageInput,
  UpdatePageInput,
  // Blog types
  ConfluenceBlogPost,
  CreateBlogPostInput,
  // Comment types
  ConfluenceComment,
  CreateCommentInput,
  CreateInlineCommentInput,
  // Attachment types
  ConfluenceAttachment,
  // Label types
  ConfluenceLabel,
  AddLabelInput,
  // Template types
  ConfluenceTemplate,
  CreateTemplateInput,
  // User/Group types
  ConfluenceUser,
  ConfluenceGroup,
  // Search types
  CqlSearchResult,
  SearchResponse,
  // Content types
  ContentRestriction,
  ContentAnalytics,
  ContentProperty,
  CreateContentPropertyInput,
  UpdateContentPropertyInput,
  ContentWatcher,
  ContentState,
  ContentLike,
  // System types
  AuditRecord,
  SystemInfo,
} from './types/index.js';

// Note: Validation schemas are intentionally not exported.
// They are internal implementation details.
// See docs/type-first-schema-plan.md for future schema export strategy.
