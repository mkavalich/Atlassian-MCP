/**
 * Jira Product Discovery MCP Server - Type Declarations
 *
 * Hand-written minimal type stubs for external imports.
 * These provide IDE autocomplete and type checking for the public API.
 *
 * NOTE: This server has BOTH REST and GraphQL clients.
 */

import type { Logger } from 'winston';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// ============================================================================
// Server Factory Types
// ============================================================================

/**
 * Hooks for extension of server behavior.
 * All hooks are optional and async.
 */
export interface ServerHooks {
  /** Called before each tool execution. Use for telemetry, rate limiting, audit logging. */
  onToolCall?: (toolName: string, params: unknown) => Promise<void>;

  /**
   * Called after tool execution, can transform the result.
   * Primary hook for token optimization (TOON format, field filtering).
   */
  transformResponse?: (toolName: string, result: unknown) => Promise<unknown>;

  /** Called on tool errors. Use for error aggregation, custom formatting. */
  onToolError?: (toolName: string, error: Error) => Promise<void>;

  /** Called after MCP server is created, before tools are registered. */
  onServerCreate?: (server: McpServer) => Promise<void>;

  /** Called after API clients are created. Use for request interceptors, custom headers. */
  onClientCreate?: (restClient: JiraApiClient, graphqlClient: JpdGraphQLClient) => Promise<void>;
}

/**
 * Configuration for creating a server instance.
 */
export interface ServerConfig {
  /** Override the server name (default: 'jira-product-discovery-mcp-server') */
  name?: string;

  /** Override the server version (default: '1.0.0') */
  version?: string;

  /** Extension hooks */
  hooks?: ServerHooks;

  /** Override auth config (for testing or custom auth). If not provided, reads from env. */
  authConfig?: AuthConfig;
}

/**
 * A running server instance with control methods.
 */
export interface ServerInstance {
  /** The underlying MCP server */
  server: McpServer;

  /** REST API client for Jira operations (ideas are Jira issues) */
  restClient: JiraApiClient;

  /** GraphQL client for Polaris operations (insights, scoring) */
  graphqlClient: JpdGraphQLClient;

  /** Start the server with specified transport */
  start: (transport?: 'stdio' | 'http') => Promise<void>;

  /** Stop the server gracefully */
  stop: () => Promise<void>;
}

/**
 * Tool catalog entry for progressive disclosure.
 */
export interface ToolCatalogEntry {
  name: string;
  category: string;
  type: string;
  description: string;
}

/**
 * Creates a new JPD MCP server instance with optional hooks.
 */
export declare function createServer(config?: ServerConfig): Promise<ServerInstance>;

/**
 * Catalog of all tools in this server, for discovery and documentation.
 */
export declare const toolCatalog: ToolCatalogEntry[];

// Tool Registration Functions (for custom tool composition)
export declare function registerDiscoveryTools(server: McpServer, apiClient: JiraApiClient): Promise<void>;
export declare function registerIdeaTools(server: McpServer, apiClient: JiraApiClient): Promise<void>;
export declare function registerInsightTools(server: McpServer, graphqlClient: JpdGraphQLClient, restClient: JiraApiClient): Promise<void>;
export declare function registerScoringTools(server: McpServer, graphqlClient: JpdGraphQLClient, restClient: JiraApiClient): Promise<void>;

// ============================================================================
// Core Types
// ============================================================================

export interface AuthConfig {
  type: 'basic' | 'oauth';
  baseUrl: string;
  email?: string;
  apiToken?: string;
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
// GraphQL Types
// ============================================================================

export interface GraphQLRequest {
  query: string;
  variables?: Record<string, unknown>;
  operationName?: string;
}

export interface GraphQLResponse<T> {
  data?: T;
  errors?: GraphQLErrorDetail[];
}

export interface GraphQLErrorDetail {
  message: string;
  locations?: Array<{ line: number; column: number }>;
  path?: Array<string | number>;
  extensions?: Record<string, unknown>;
}

// ============================================================================
// API Clients
// ============================================================================

export declare class JiraApiClient {
  constructor(authManager: AuthManager);
  makeRequest<T>(config: RequestConfig): Promise<ApiResponse<T>>;
  getRateLimitInfo(): RateLimitInfo | undefined;
  waitForRateLimit(): Promise<void>;
}

export declare class JpdGraphQLClient {
  constructor(authManager: AuthManager);
  execute<T>(request: GraphQLRequest): Promise<ApiResponse<T>>;
  getRateLimitInfo(): RateLimitInfo | undefined;
  getPublicCloudId(): Promise<string>;
  buildProjectAri(projectId: string): Promise<string>;
  buildIssueAri(issueId: string): Promise<string>;
  waitForRateLimit(): Promise<void>;
}

// ============================================================================
// Authentication
// ============================================================================

export declare class AuthManager {
  constructor(config: AuthConfig);
  getAuthHeaders(): Record<string, string>;
  getBaseUrl(): string;
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

export declare class JpdGraphQLError extends JiraApiError {
  graphqlErrors: GraphQLErrorDetail[];
  constructor(message: string, errors: GraphQLErrorDetail[]);
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
export declare function mapGraphQLError(errors: GraphQLErrorDetail[]): JpdGraphQLError;
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
export declare function logGraphQLCall(operationName: string, statusCode: number, duration?: number): void;
export declare function logError(error: Error, context?: Record<string, unknown>): void;

// ============================================================================
// GraphQL Queries (string constants)
// ============================================================================

export declare const GET_IDEA_INSIGHTS: string;
export declare const GET_INSIGHT: string;
export declare const GET_IDEA_SCORING: string;
export declare const GET_JPD_PROJECT_CONFIG: string;
export declare const GET_POLARIS_INSIGHTS: string;
export declare const GET_INSIGHTS_COUNT: string;

// ============================================================================
// GraphQL Mutations (string constants)
// ============================================================================

export declare const CREATE_INSIGHT: string;
export declare const UPDATE_INSIGHT: string;
export declare const DELETE_INSIGHT: string;
export declare const CREATE_POLARIS_INSIGHT: string;
export declare const UPDATE_POLARIS_INSIGHT: string;
export declare const DELETE_POLARIS_INSIGHT: string;
export declare const UPDATE_IDEA_SCORING: string;

// ============================================================================
// Domain Types (re-exported from types/index.ts)
// ============================================================================

export type {
  JiraUser,
  JpdProject,
  JpdIdea,
  JpdIdeaFields,
  JpdIssueType,
  JpdStatus,
  JpdPriority,
  JpdInsight,
  JpdInsightSnippet,
  JpdInsightInput,
  JpdInsightsResponse,
  JpdInsightAnalysis,
  JpdScoringData,
  JpdScore,
  JpdScoringField,
  JpdScoringOption,
  JpdView,
  JpdFilter,
  JpdSearchResult,
  JpdCreateIdeaResponse,
  JiraSearchResult,
  JiraCreateIssueResponse,
} from './types/index.js';

// ============================================================================
// Validation Schemas (Zod schemas for tool inputs)
// ============================================================================

import type { ZodSchema } from 'zod';

export declare const getIdeasSchema: ZodSchema;
export declare const searchIdeasSchema: ZodSchema;
export declare const getIdeaSchema: ZodSchema;
export declare const createIdeaSchema: ZodSchema;
export declare const updateIdeaSchema: ZodSchema;
export declare const deleteIdeaSchema: ZodSchema;
export declare const getJpdProjectsSchema: ZodSchema;
export declare const getInsightsSchema: ZodSchema;
export declare const getInsightSchema: ZodSchema;
export declare const createInsightSchema: ZodSchema;
export declare const updateInsightSchema: ZodSchema;
export declare const deleteInsightSchema: ZodSchema;
export declare const analyzeIdeaInsightsSchema: ZodSchema;
export declare const getIdeaScoringSchema: ZodSchema;
