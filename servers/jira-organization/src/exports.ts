/**
 * Jira Organization MCP Server - Public Exports
 *
 * This module exports the public API for extension.
 * Import from 'jira-organization-mcp-server/exports' to access these.
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
  registerGlobalOrganizationTools,
  registerIdentityProviderTools,
  registerGlobalUserTools,
  registerCrossProductAnalyticsTools,
  registerDirectoryHealthTools,
  registerOrganizationManagementTools,
  registerEnhancedDirectoryAnalyticsTools,
  registerApiSecurityMonitoringTools,
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
  // Jira core types
  JiraProject,
  JiraWorkflow,
  JiraPermissionScheme,
  JiraPermission,
  JiraField,
  CreateProjectInput,
  // Issue type types
  JiraIssueTypeScheme,
  JiraIssueType,
  JiraIssueTypeScreenScheme,
  JiraIssueTypeMapping,
  // Screen types
  JiraScreenScheme,
  JiraScreen,
  JiraScreenDetailed,
  JiraScreenTab,
  JiraScreenField,
  // Field types
  JiraCustomFieldContext,
  JiraCustomFieldOption,
  JiraFieldConfiguration,
  JiraFieldConfigItem,
  JiraFieldConfigurationScheme,
  JiraFieldConfigurationSchemeItem,
  // Notification types
  JiraNotificationScheme,
  JiraNotificationSchemeEvent,
  JiraEvent,
  JiraNotification,
  // User/Group types
  JiraUser,
  JiraGroup,
  JiraProjectRole,
  // Dashboard types
  JiraDashboard,
  JiraSharePermission,
  JiraDashboardGadget,
  JiraGadgetPosition,
  // Service Desk types
  JiraServiceDesk,
  JiraRequestType,
  JiraRequestTypeField,
  JiraRequestTypeCreateRequest,
  JiraRequestTypeGroup,
  JiraServiceDeskInfo,
  JiraCustomerGroup,
  JiraPortalSettings,
  // Compass types
  CompassComponentMetric,
  CompassTeamMetric,
  CompassMetricsResponse,
  CompassSystemEvent,
  CompassComponentEvent,
  CompassEventsResponse,
  // SCIM Directory types
  ScimDirectoryGroup,
  ScimDirectoryGroupMember,
  ScimDirectoryGroupsResponse,
  ScimDirectorySchema,
  ScimSchemaAttribute,
  ScimDirectorySchemasResponse,
  ScimDirectoryResourceType,
  ScimSchemaExtension,
  ScimDirectoryResourceTypesResponse,
  // Organization types
  AtlassianOrganization,
  OrganizationDomain,
  OrganizationPolicy,
  AtlassianOrganizationsResponse,
  OrganizationDetails,
} from './types/index.js';

// Note: Validation schemas are intentionally not exported.
// They are internal implementation details.
// See docs/type-first-schema-plan.md for future schema export strategy.
