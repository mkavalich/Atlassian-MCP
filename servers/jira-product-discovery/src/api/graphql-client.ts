import axios, { AxiosInstance, AxiosError } from 'axios';
import axiosRetry from 'axios-retry';
import http from 'http';
import https from 'https';
import { LRUCache } from 'lru-cache';
import { AuthManager } from '../auth/index.js';
import { GraphQLRequest, GraphQLResponse, ApiResponse, RateLimitInfo } from '../types/index.js';
import { JiraApiError, mapGraphQLError, GraphQLErrorDetail } from '../utils/errors.js';
import { logger, logGraphQLCall } from '../utils/logger.js';

/**
 * GraphQL client for Jira Product Discovery
 * Uses the Atlassian GraphQL Gateway for insights, scoring, and views
 */
export class JpdGraphQLClient {
  private axios: AxiosInstance;
  private cloudId: string | null = null;
  // Rate limit tracking with bounded LRU cache (max 100 entries, 5 min TTL)
  private rateLimitInfo: LRUCache<string, RateLimitInfo> = new LRUCache({
    max: 100,
    ttl: 1000 * 60 * 5, // 5 minutes
  });

  constructor(private authManager: AuthManager) {
    this.axios = axios.create({
      timeout: parseInt(process.env.REQUEST_TIMEOUT || '30000'),
      httpAgent: new http.Agent({ keepAlive: true, maxSockets: 10 }),
      httpsAgent: new https.Agent({ keepAlive: true, maxSockets: 10 }),
    });

    // Configure retry logic
    axiosRetry(this.axios, {
      retries: parseInt(process.env.MAX_RETRIES || '3'),
      retryDelay: (retryCount) => {
        const delay = parseInt(process.env.RETRY_DELAY || '1000');
        return delay * Math.pow(2, retryCount - 1);
      },
      retryCondition: (error) => {
        // Retry on network errors and 5xx status codes
        return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
          (error.response?.status && error.response.status >= 500) || false;
      },
    });

    // Request interceptor for logging
    this.axios.interceptors.request.use(
      (config) => {
        logger.debug('GraphQL Request', {
          url: config.url,
          operationName: (config.data as GraphQLRequest)?.operationName,
        });
        return config;
      },
      (error) => {
        logger.error('GraphQL request interceptor error', { error: error.message });
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging
    this.axios.interceptors.response.use(
      (response) => {
        this.updateRateLimitInfo(response.headers);
        return response;
      },
      (error) => {
        return Promise.reject(error);
      }
    );
  }

  /**
   * Fetch the Atlassian Cloud ID required for GraphQL requests
   */
  private async getCloudId(): Promise<string> {
    if (this.cloudId) {
      return this.cloudId;
    }

    try {
      const authHeaders = this.authManager.getAuthHeaders();
      const baseUrl = this.authManager.getBaseUrl();

      // Fetch tenant info to get cloud ID
      const response = await this.axios.get(`${baseUrl}/_edge/tenant_info`, {
        headers: authHeaders,
      });

      if (response.data?.cloudId) {
        this.cloudId = response.data.cloudId;
        logger.info('Retrieved Atlassian Cloud ID', { cloudId: this.cloudId });
        return this.cloudId as string;
      }

      throw new Error('Cloud ID not found in tenant info response');
    } catch (error) {
      logger.error('Failed to retrieve Cloud ID', { error });

      // Try alternative method using accessible-resources
      try {
        const authHeaders = this.authManager.getAuthHeaders();
        const response = await this.axios.get('https://api.atlassian.com/oauth/token/accessible-resources', {
          headers: authHeaders,
        });

        if (Array.isArray(response.data) && response.data.length > 0) {
          // Find the matching site
          const baseUrl = this.authManager.getBaseUrl();
          const site = response.data.find((r: any) => r.url === baseUrl) || response.data[0];
          if (site?.id) {
            this.cloudId = site.id;
            logger.info('Retrieved Atlassian Cloud ID from accessible-resources', { cloudId: this.cloudId });
            return this.cloudId as string;
          }
        }
      } catch {
        // Fall through to error
      }

      throw new JiraApiError(
        'CLOUD_ID_ERROR',
        'Failed to retrieve Atlassian Cloud ID',
        error,
        'Ensure you have valid API credentials and the site is accessible'
      );
    }
  }

  private updateRateLimitInfo(headers: any): void {
    const limit = parseInt(headers['x-ratelimit-limit']);
    const remaining = parseInt(headers['x-ratelimit-remaining']);
    const reset = parseInt(headers['x-ratelimit-reset']);

    if (!isNaN(limit) && !isNaN(remaining) && !isNaN(reset)) {
      this.rateLimitInfo.set('graphql', { limit, remaining, reset });
    }
  }

  /**
   * Execute a GraphQL query/mutation
   */
  async execute<T>(request: GraphQLRequest): Promise<ApiResponse<T>> {
    const startTime = Date.now();
    const operationName = request.operationName || 'UnnamedOperation';

    try {
      const cloudId = await this.getCloudId();
      const authHeaders = this.authManager.getAuthHeaders();

      // Atlassian GraphQL Gateway endpoint
      const url = 'https://api.atlassian.com/graphql';

      const response = await this.axios.post<GraphQLResponse<T>>(
        url,
        {
          query: request.query,
          variables: request.variables,
          operationName: request.operationName,
        },
        {
          headers: {
            ...authHeaders,
            'Content-Type': 'application/json',
            'X-Atlassian-Cloud-ID': cloudId,
            // Required for JPD Polaris insights API
            'X-ExperimentalApi': 'polaris-v0',
          },
        }
      );

      const duration = Date.now() - startTime;
      logGraphQLCall(operationName, 200, duration);

      // GraphQL returns errors in the response body, not as HTTP errors
      if (response.data.errors && response.data.errors.length > 0) {
        const graphqlError = mapGraphQLError(response.data.errors as GraphQLErrorDetail[]);
        throw graphqlError;
      }

      return {
        success: true,
        data: response.data.data as T,
        metadata: {
          executionTime: duration,
          rateLimitInfo: this.rateLimitInfo.get('graphql'),
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      if (axios.isAxiosError(error)) {
        logGraphQLCall(operationName, error.response?.status || 0, duration);
        return this.handleAxiosError(error);
      }

      // Re-throw JiraApiError or JpdGraphQLError
      if (error instanceof JiraApiError) {
        throw error;
      }

      throw new JiraApiError(
        'GRAPHQL_ERROR',
        error instanceof Error ? error.message : 'GraphQL request failed',
        error
      );
    }
  }

  private handleAxiosError(error: AxiosError): never {
    const status = error.response?.status;
    const data = error.response?.data as any;

    // Check for GraphQL errors in response body
    if (data?.errors && Array.isArray(data.errors)) {
      throw mapGraphQLError(data.errors);
    }

    // HTTP-level errors
    if (status === 401) {
      throw new JiraApiError(
        'AUTH_ERROR',
        'GraphQL authentication failed',
        data,
        'Check your API credentials'
      );
    }

    if (status === 403) {
      throw new JiraApiError(
        'PERMISSION_DENIED',
        'GraphQL access denied',
        data,
        'Request the necessary permissions from your Jira administrator'
      );
    }

    if (status === 429) {
      throw new JiraApiError(
        'RATE_LIMIT',
        'GraphQL rate limit exceeded',
        data,
        'Wait a moment before retrying'
      );
    }

    throw new JiraApiError(
      'GRAPHQL_HTTP_ERROR',
      error.message || `GraphQL request failed with status ${status}`,
      { status, data },
      'Check your network connection and try again'
    );
  }

  getRateLimitInfo(): RateLimitInfo | undefined {
    return this.rateLimitInfo.get('graphql');
  }

  /**
   * Get the Cloud ID (public accessor for building ARIs)
   */
  async getPublicCloudId(): Promise<string> {
    return this.getCloudId();
  }

  /**
   * Build an Atlassian Resource Identifier (ARI) for a project
   */
  async buildProjectAri(projectId: string): Promise<string> {
    const cloudId = await this.getCloudId();
    return `ari:cloud:jira:${cloudId}:project/${projectId}`;
  }

  /**
   * Build an Atlassian Resource Identifier (ARI) for an issue
   */
  async buildIssueAri(issueId: string): Promise<string> {
    const cloudId = await this.getCloudId();
    return `ari:cloud:jira:${cloudId}:issue/${issueId}`;
  }

  async waitForRateLimit(): Promise<void> {
    const info = this.getRateLimitInfo();
    if (info && info.remaining === 0) {
      const waitTime = (info.reset * 1000) - Date.now();
      if (waitTime > 0) {
        logger.info(`GraphQL rate limit reached. Waiting ${waitTime}ms until reset.`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
}
