/**
 * Jira Fields & Permissions MCP Server - Public Exports
 *
 * This module exports the public API for extension.
 * Import from 'jira-fields-permissions-mcp-server/exports' to access these.
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
  registerPermissionTools,
  registerFieldTools,
  registerFieldContextTools,
  registerFieldConfigurationTools,
  registerNotificationScreenTools,
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
  // Workflow types
  JiraWorkflow,
  // Permission types
  JiraPermissionScheme,
  JiraPermission,
  // Field types
  JiraFieldSchema,
  JiraFieldListItem,
  JiraFieldSearchItem,
  JiraCustomFieldContext,
  JiraCustomFieldOption,
  // Field Configuration types
  JiraFieldConfiguration,
  JiraFieldConfigItem,
  JiraFieldConfigurationScheme,
  JiraFieldConfigurationSchemeItem,
  // Notification Scheme types
  JiraNotificationScheme,
  JiraNotificationSchemeEvent,
  JiraEvent,
  JiraNotification,
  // Issue Type types
  JiraIssueType,
  JiraIssueTypeScheme,
  JiraIssueTypeScreenScheme,
  JiraIssueTypeMapping,
  // Screen types
  JiraScreen,
  JiraScreenScheme,
  JiraScreenDetailed,
  JiraScreenTab,
  JiraScreenField,
  // Dashboard types
  JiraDashboard,
  JiraSharePermission,
  JiraDashboardGadget,
  JiraGadgetPosition,
  // User/Group types
  JiraUser,
  JiraGroup,
  JiraProjectRole,
  // Service Desk types
  JiraServiceDesk,
  JiraRequestType,
  JiraRequestTypeField,
  JiraRequestTypeCreateRequest,
  JiraRequestTypeGroup,
  JiraServiceDeskInfo,
  JiraCustomerGroup,
  JiraPortalSettings,
} from './types/index.js';

// Note: Validation schemas are intentionally not exported.
// They are internal implementation details.
// See docs/type-first-schema-plan.md for future schema export strategy.
