/**
 * Confluence MCP Server - Type Declarations
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
  onClientCreate?: (client: ConfluenceApiClient) => Promise<void>;
}

export interface ServerConfig {
  name?: string;
  version?: string;
  hooks?: ServerHooks;
  authConfig?: AuthConfig;
}

export interface ServerInstance {
  server: McpServer;
  apiClient: ConfluenceApiClient;
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
export declare function registerPageTools(server: McpServer, apiClient: ConfluenceApiClient): Promise<void>;
export declare function registerSpaceTools(server: McpServer, apiClient: ConfluenceApiClient): Promise<void>;
export declare function registerPermissionTools(server: McpServer, apiClient: ConfluenceApiClient): Promise<void>;
export declare function registerCommentTools(server: McpServer, apiClient: ConfluenceApiClient): Promise<void>;
export declare function registerAttachmentTools(server: McpServer, apiClient: ConfluenceApiClient): Promise<void>;
export declare function registerContentTools(server: McpServer, apiClient: ConfluenceApiClient): Promise<void>;
export declare function registerAdminTools(server: McpServer, apiClient: ConfluenceApiClient): Promise<void>;

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
  apiVersion?: 'v1' | 'v2';
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

export declare class ConfluenceApiClient {
  constructor(authManager: AuthManager);
  makeRequest<T>(config: RequestConfig): Promise<ApiResponse<T>>;
  makeV1Request<T>(config: Omit<RequestConfig, 'apiVersion'>): Promise<ApiResponse<T>>;
  makeV2Request<T>(config: Omit<RequestConfig, 'apiVersion'>): Promise<ApiResponse<T>>;
  downloadAttachment(downloadLink: string): Promise<ApiResponse<Buffer>>;
  getRateLimitInfo(): RateLimitInfo | undefined;
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

export declare class ConfluenceApiError extends Error {
  code: string;
  details?: unknown;
  suggestion?: string;
  constructor(code: string, message: string, details?: unknown, suggestion?: string);
}

export declare class AuthenticationError extends ConfluenceApiError {
  constructor(message?: string);
}

export declare class RateLimitError extends ConfluenceApiError {
  constructor(resetTime: number);
}

export declare class ValidationError extends ConfluenceApiError {
  constructor(message: string, details?: unknown);
}

export declare class NotFoundError extends ConfluenceApiError {
  constructor(resource: string, identifier: string);
}

export declare class PermissionError extends ConfluenceApiError {
  constructor(operation: string, resource?: string);
}

// ============================================================================
// Error Utilities
// ============================================================================

export declare function mapAtlassianError(statusCode: number, responseBody?: unknown): ConfluenceApiError;
export declare function analyzeConfluenceError(error: unknown): { code: string; suggestion: string };
export declare function sanitizeErrorMessage(message: string): string;
export declare function sanitizeErrorDetails(details: unknown): unknown;

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
  PaginatedResponse,
  CursorPaginatedResponse,
  ConfluenceSpace,
  CreateSpaceInput,
  UpdateSpaceInput,
  SpacePermission,
  AddSpacePermissionInput,
  ConfluencePage,
  ContentVersion,
  CreatePageInput,
  UpdatePageInput,
  ConfluenceBlogPost,
  CreateBlogPostInput,
  ConfluenceComment,
  CreateCommentInput,
  CreateInlineCommentInput,
  ConfluenceAttachment,
  ConfluenceLabel,
  AddLabelInput,
  ConfluenceTemplate,
  CreateTemplateInput,
  ConfluenceUser,
  ConfluenceGroup,
  CqlSearchResult,
  SearchResponse,
  ContentRestriction,
  ContentAnalytics,
  ContentProperty,
  CreateContentPropertyInput,
  UpdateContentPropertyInput,
  ContentWatcher,
  ContentState,
  ContentLike,
  AuditRecord,
  SystemInfo,
} from './types/index.js';
