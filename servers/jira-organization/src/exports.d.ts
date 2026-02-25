/**
 * Jira Organization MCP Server - Type Declarations
 *
 * Hand-written minimal type stubs for external imports.
 * These provide IDE autocomplete and type checking for the public API.
 */

import type { Logger } from 'winston';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// ============================================================================
// Server Factory Types
// ============================================================================

export interface ServerHooks {
  onToolCall?: (toolName: string, params: unknown) => Promise<void>;
  transformResponse?: (toolName: string, result: unknown) => Promise<unknown>;
  onToolError?: (toolName: string, error: Error) => Promise<void>;
  onServerCreate?: (server: McpServer) => Promise<void>;
  onClientCreate?: (client: JiraApiClient) => Promise<void>;
}

export interface ServerConfig {
  name?: string;
  version?: string;
  hooks?: ServerHooks;
  authConfig?: AuthConfig;
}

export interface ServerInstance {
  server: McpServer;
  apiClient: JiraApiClient;
  start: (transport?: 'stdio' | 'http') => Promise<void>;
  stop: () => Promise<void>;
}

export interface ToolCatalogEntry {
  name: string;
  category: string;
  type: string;
  description: string;
}

export declare function createServer(config?: ServerConfig): Promise<ServerInstance>;
export declare const toolCatalog: ToolCatalogEntry[];

// Tool Registration Functions
export declare function registerGlobalOrganizationTools(server: McpServer, apiClient: JiraApiClient): Promise<void>;
export declare function registerIdentityProviderTools(server: McpServer, apiClient: JiraApiClient): Promise<void>;
export declare function registerGlobalUserTools(server: McpServer, apiClient: JiraApiClient): Promise<void>;
export declare function registerCrossProductAnalyticsTools(server: McpServer, apiClient: JiraApiClient): Promise<void>;
export declare function registerDirectoryHealthTools(server: McpServer, apiClient: JiraApiClient): Promise<void>;
export declare function registerOrganizationManagementTools(server: McpServer, apiClient: JiraApiClient): Promise<void>;
export declare function registerEnhancedDirectoryAnalyticsTools(server: McpServer, apiClient: JiraApiClient): Promise<void>;
export declare function registerApiSecurityMonitoringTools(server: McpServer, apiClient: JiraApiClient): Promise<void>;

// ============================================================================
// Core Types
// ============================================================================

export interface AuthConfig {
  type: 'basic' | 'oauth';
  baseUrl: string;
  email?: string;
  apiToken?: string;
  orgAdminToken?: string;
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface RequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  params?: Record<string, unknown>;
  data?: unknown;
  headers?: Record<string, string>;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
    suggestion?: string;
  };
  metadata?: {
    requestId?: string;
    executionTime?: number;
    rateLimitInfo?: RateLimitInfo;
  };
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}

// ============================================================================
// API Client
// ============================================================================

export declare class JiraApiClient {
  constructor(authManager: AuthManager);
  makeRequest<T>(config: RequestConfig): Promise<ApiResponse<T>>;
  getRateLimitInfo(): RateLimitInfo | undefined;
  waitForRateLimit(): Promise<void>;
}

// ============================================================================
// Authentication
// ============================================================================

export declare class AuthManager {
  constructor(config: AuthConfig);
  getAuthHeaders(useOrgAdmin?: boolean): Record<string, string>;
  getBaseUrl(): string;
  hasOrgAdminToken(): boolean;
  refreshOAuthToken(): Promise<void>;
}

// ============================================================================
// Error Classes
// ============================================================================

export declare class JiraApiError extends Error {
  code: string;
  details?: unknown;
  suggestion?: string;
  constructor(code: string, message: string, details?: unknown, suggestion?: string);
}

export declare class AuthenticationError extends JiraApiError {
  constructor(message?: string);
}

export declare class RateLimitError extends JiraApiError {
  constructor(resetTime: number);
}

export declare class ValidationError extends JiraApiError {
  constructor(message: string, details?: unknown);
}

export declare class NotFoundError extends JiraApiError {
  constructor(resource: string, identifier: string);
}

export declare class PermissionError extends JiraApiError {
  constructor(operation: string, resource?: string);
}

// ============================================================================
// Error Utilities
// ============================================================================

export declare function mapAtlassianError(statusCode: number, responseBody?: unknown): JiraApiError;
export declare function analyzeAtlassianError(error: unknown): { code: string; suggestion: string };
export declare function sanitizeErrorMessage(message: string): string;
export declare function sanitizeErrorDetails(details: unknown): unknown;

export declare const ATLASSIAN_ERROR_PATTERNS: {
  PROJECT_KEY_EXISTS: RegExp;
  PROJECT_NAME_EXISTS: RegExp;
  INVALID_PROJECT_KEY: RegExp;
  INSUFFICIENT_LICENSE: RegExp;
  WORKFLOW_IN_USE: RegExp;
  PERMISSION_SCHEME_IN_USE: RegExp;
  FIELD_LOCKED: RegExp;
  ISSUE_TYPE_IN_USE: RegExp;
};

// ============================================================================
// Logging
// ============================================================================

export declare const logger: Logger;
export declare function logApiCall(method: string, path: string, statusCode?: number, duration?: number): void;
export declare function logError(error: Error, context?: Record<string, unknown>): void;

// ============================================================================
// Domain Types (re-exported from types/index.ts)
// ============================================================================

export type {
  JiraProject,
  JiraWorkflow,
  JiraPermissionScheme,
  JiraPermission,
  JiraField,
  CreateProjectInput,
  JiraIssueTypeScheme,
  JiraIssueType,
  JiraIssueTypeScreenScheme,
  JiraIssueTypeMapping,
  JiraScreenScheme,
  JiraScreen,
  JiraScreenDetailed,
  JiraScreenTab,
  JiraScreenField,
  JiraCustomFieldContext,
  JiraCustomFieldOption,
  JiraFieldConfiguration,
  JiraFieldConfigItem,
  JiraFieldConfigurationScheme,
  JiraFieldConfigurationSchemeItem,
  JiraNotificationScheme,
  JiraNotificationSchemeEvent,
  JiraEvent,
  JiraNotification,
  JiraUser,
  JiraGroup,
  JiraProjectRole,
  JiraDashboard,
  JiraSharePermission,
  JiraDashboardGadget,
  JiraGadgetPosition,
  JiraServiceDesk,
  JiraRequestType,
  JiraRequestTypeField,
  JiraRequestTypeCreateRequest,
  JiraRequestTypeGroup,
  JiraServiceDeskInfo,
  JiraCustomerGroup,
  JiraPortalSettings,
  CompassComponentMetric,
  CompassTeamMetric,
  CompassMetricsResponse,
  CompassSystemEvent,
  CompassComponentEvent,
  CompassEventsResponse,
  ScimDirectoryGroup,
  ScimDirectoryGroupMember,
  ScimDirectoryGroupsResponse,
  ScimDirectorySchema,
  ScimSchemaAttribute,
  ScimDirectorySchemasResponse,
  ScimDirectoryResourceType,
  ScimSchemaExtension,
  ScimDirectoryResourceTypesResponse,
  AtlassianOrganization,
  OrganizationDomain,
  OrganizationPolicy,
  AtlassianOrganizationsResponse,
  OrganizationDetails,
} from './types/index.js';
