import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';
import axiosRetry from 'axios-retry';
import http from 'http';
import https from 'https';
import { LRUCache } from 'lru-cache';
import { AuthManager } from '../auth/index.js';
import { RequestConfig, ApiResponse, RateLimitInfo } from '../types/index.js';
import {
  JiraApiError,
  mapAtlassianError,
  analyzeAtlassianError,
  sanitizeErrorDetails
} from '../utils/errors.js';
import { logger, logApiCall, redactSensitive } from '../utils/logger.js';

interface AxiosConfigWithMetadata extends AxiosRequestConfig {
  metadata?: {
    startTime: number;
  };
}

export class JiraApiClient {
  private axios: AxiosInstance;
  // Rate limit tracking with bounded LRU cache (max 100 entries, 5 min TTL)
  private rateLimitInfo: LRUCache<string, RateLimitInfo> = new LRUCache({
    max: 100,
    ttl: 1000 * 60 * 5, // 5 minutes
  });
  private cloudId: string | null = null;

  constructor(private authManager: AuthManager) {
    // Create axios instance with connection pooling and timeout
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
        return delay * Math.pow(2, retryCount - 1); // Exponential backoff
      },
      retryCondition: (error) => {
        // Retry on network errors and 5xx status codes (except 503 rate limit)
        return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
          (error.response?.status && error.response.status >= 500 && error.response.status !== 503) || false;
      },
    });

    // Request interceptor for logging
    this.axios.interceptors.request.use(
      (config) => {
        logger.debug('API Request', {
          method: config.method,
          url: config.url,
          params: redactSensitive(config.params),
        });
        return config;
      },
      (error) => {
        logger.error('Request interceptor error', { error: error.message });
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging and rate limit tracking
    this.axios.interceptors.response.use(
      (response) => {
        const config = response.config as AxiosConfigWithMetadata;
        const duration = config.metadata?.startTime 
          ? Date.now() - config.metadata.startTime 
          : undefined;
        
        logApiCall(
          response.config.method?.toUpperCase() || 'GET',
          response.config.url || '',
          response.status,
          duration
        );

        // Track rate limit info
        this.updateRateLimitInfo(response.headers);

        return response;
      },
      (error) => {
        if (error.response) {
          const duration = error.config?.metadata?.startTime 
            ? Date.now() - error.config.metadata.startTime 
            : undefined;
          
          logApiCall(
            error.config?.method?.toUpperCase() || 'GET',
            error.config?.url || '',
            error.response.status,
            duration
          );
        }
        return Promise.reject(error);
      }
    );
  }

  private updateRateLimitInfo(headers: any): void {
    const limit = parseInt(headers['x-ratelimit-limit']);
    const remaining = parseInt(headers['x-ratelimit-remaining']);
    const reset = parseInt(headers['x-ratelimit-reset']);

    if (!isNaN(limit) && !isNaN(remaining) && !isNaN(reset)) {
      this.rateLimitInfo.set('default', { limit, remaining, reset });
    }
  }

  private handleError(error: AxiosError): never {
    const status = error.response?.status;
    const data = error.response?.data as any;

    if (status) {
      // Use enhanced Atlassian error mapping
      const mappedError = mapAtlassianError(status, data);
      
      // Analyze error for additional context
      const analysis = analyzeAtlassianError(mappedError);
      
      // Enhance the error with analysis results
      mappedError.code = analysis.code;
      mappedError.suggestion = analysis.suggestion;
      
      // Add request context for debugging (re-sanitize the merged object so the
      // post-constructor reassignment does not bypass sanitizeErrorDetails)
      mappedError.details = sanitizeErrorDetails({
        ...mappedError.details,
        requestUrl: error.config?.url,
        requestMethod: error.config?.method?.toUpperCase(),
        timestamp: new Date().toISOString(),
      });
      
      throw mappedError;
    }

    // Fallback for network errors or other issues
    throw new JiraApiError(
      'NETWORK_ERROR',
      error.message || 'Network error occurred',
      { originalError: error },
      'Check your internet connection and Jira instance availability'
    );
  }

  /**
   * Determines if a Service Desk API endpoint requires the experimental API header
   * Based on Atlassian documentation, certain request type operations are experimental
   */
  private isExperimentalServiceDeskEndpoint(path: string, method: string): boolean {
    // Request type endpoints that require experimental header
    const requestTypePatterns = [
      /^\/servicedesk\/\d+\/requesttype$/, // POST /servicedesk/{serviceDeskId}/requesttype
      /^\/servicedesk\/\d+\/requesttype\/\d+$/, // PUT/DELETE /servicedesk/{serviceDeskId}/requesttype/{requestTypeId}
      /^\/servicedesk\/\d+\/requesttype\/\d+\/field$/, // PUT /servicedesk/{serviceDeskId}/requesttype/{requestTypeId}/field
      /^\/servicedesk\/\d+\/requesttype\/\d+\/group$/, // PUT /servicedesk/{serviceDeskId}/requesttype/{requestTypeId}/group
    ];

    // Check if the path matches any experimental patterns
    const isRequestTypeEndpoint = requestTypePatterns.some(pattern => pattern.test(path));
    
    // Only certain methods on request type endpoints are experimental
    const isExperimentalMethod = ['POST', 'PUT', 'DELETE'].includes(method.toUpperCase());
    
    return isRequestTypeEndpoint && isExperimentalMethod;
  }

  /**
   * Determines if an endpoint requires organization admin permissions
   * These endpoints need the JIRA_ORG_ADMIN_TOKEN for access
   */
  private requiresOrgAdminToken(path: string): boolean {
    const orgAdminEndpoints = [
      '/instance/license',     // License information
      '/instance/billing',     // Billing information  
      '/instance/',           // All instance-level endpoints
      '/organization',         // Organization management
      '/admin/organization',   // Organization administration
      '/admin/billing',       // Admin billing endpoints
      '/admin/instance',      // Admin instance endpoints
    ];
    
    return orgAdminEndpoints.some(endpoint => path.startsWith(endpoint));
  }

  async makeRequest<T>(config: RequestConfig): Promise<ApiResponse<T>> {
    const startTime = Date.now();
    
    try {
      // Determine if this endpoint requires org admin token
      const needsOrgAdmin = this.requiresOrgAdminToken(config.path);
      
      // Use appropriate token based on endpoint requirements
      let authHeaders: Record<string, string>;
      if (needsOrgAdmin) {
        if (this.authManager.hasOrgAdminToken()) {
          authHeaders = this.authManager.getAuthHeaders(true);
        } else {
          // For org admin endpoints without org admin token, still try with regular token
          // but let the error handling provide clear feedback about missing permissions
          authHeaders = this.authManager.getAuthHeaders(false);
        }
      } else {
        // Regular endpoints always use regular token
        authHeaders = this.authManager.getAuthHeaders(false);
      }
      
      const baseURL = `${this.authManager.getBaseUrl()}/rest/api/3`;
      
      const axiosConfig: AxiosConfigWithMetadata = {
        method: config.method,
        url: config.path,
        baseURL,
        params: config.params,
        data: config.data,
        headers: {
          ...authHeaders,
          ...config.headers,
        },
        metadata: { startTime },
      };

      const response = await this.axios.request<T>(axiosConfig);
      
      return {
        success: true,
        data: response.data,
        metadata: {
          executionTime: Date.now() - startTime,
          rateLimitInfo: this.rateLimitInfo.get('default'),
        },
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.handleError(error);
      }
      
      throw new JiraApiError(
        'UNKNOWN_ERROR',
        error instanceof Error ? error.message : 'Unknown error occurred',
        error
      );
    }
  }

  async makeServiceDeskRequest<T>(config: RequestConfig): Promise<ApiResponse<T>> {
    const startTime = Date.now();
    
    try {
      // Add auth headers and Service Desk API base URL
      const authHeaders = this.authManager.getAuthHeaders();
      const baseURL = `${this.authManager.getBaseUrl()}/rest/servicedeskapi`;
      
      // Check if this endpoint requires experimental API header
      const requiresExperimentalHeader = this.isExperimentalServiceDeskEndpoint(config.path, config.method);
      
      const headers = {
        ...authHeaders,
        ...config.headers,
      };
      
      // Add experimental API header for endpoints that require it
      if (requiresExperimentalHeader) {
        headers['X-ExperimentalApi'] = 'opt-in';
      }
      
      const axiosConfig: AxiosConfigWithMetadata = {
        method: config.method,
        url: config.path,
        baseURL,
        params: config.params,
        data: config.data,
        headers,
        metadata: { startTime },
      };

      const response = await this.axios.request<T>(axiosConfig);
      
      return {
        success: true,
        data: response.data,
        metadata: {
          executionTime: Date.now() - startTime,
          rateLimitInfo: this.rateLimitInfo.get('default'),
        },
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.handleError(error);
      }
      
      throw new JiraApiError(
        'UNKNOWN_ERROR',
        error instanceof Error ? error.message : 'Unknown error occurred',
        error
      );
    }
  }

  getRateLimitInfo(): RateLimitInfo | undefined {
    return this.rateLimitInfo.get('default');
  }

  async waitForRateLimit(): Promise<void> {
    const info = this.getRateLimitInfo();
    if (info && info.remaining === 0) {
      const waitTime = (info.reset * 1000) - Date.now();
      if (waitTime > 0) {
        logger.info(`Rate limit reached. Waiting ${waitTime}ms until reset.`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  /**
   * Fetches the Cloud ID for the Jira instance
   * Required for Automation API calls
   */
  private async getCloudId(): Promise<string> {
    if (this.cloudId) {
      return this.cloudId;
    }

    try {
      const response = await this.axios.get(`${this.authManager.getBaseUrl()}/_edge/tenant_info`, {
        headers: this.authManager.getAuthHeaders(),
      });

      if (response.data && response.data.cloudId) {
        this.cloudId = response.data.cloudId;
        logger.info('Cloud ID fetched successfully', { cloudId: this.cloudId });
        return this.cloudId as string;
      }

      throw new Error('Cloud ID not found in tenant info');
    } catch (error) {
      logger.error('Failed to fetch Cloud ID', { error });
      throw new JiraApiError(
        'CLOUD_ID_FETCH_ERROR',
        'Failed to fetch Atlassian Cloud ID. Automation features require Cloud ID.',
        error
      );
    }
  }

  async makeAutomationRequest<T>(config: RequestConfig): Promise<ApiResponse<T>> {
    const startTime = Date.now();

    try {
      // Fetch Cloud ID if not already fetched
      const cloudId = await this.getCloudId();

      // IMPORTANT: Automation API only supports Basic Auth (email + API token)
      // According to Atlassian docs: https://support.atlassian.com/cloud-automation/docs/jira-cloud-automation-rest-api/
      // OAuth and Bearer tokens are NOT supported for Automation API
      // Always use Basic auth regardless of orgAdminToken presence
      const authHeaders = this.authManager.getAuthHeaders(false);

      // Use the global Atlassian API endpoint with cloud ID
      // Format: https://api.atlassian.com/automation/public/{product}/{cloudid}/rest/v1
      const baseURL = `https://api.atlassian.com/automation/public/jira/${cloudId}/rest/v1`;

      // Note: config.path should be relative, e.g., '/rule' not '/rules'
      // The automation API uses singular forms: /rule, /rule/summary, etc.
      const axiosConfig: AxiosConfigWithMetadata = {
        method: config.method,
        url: config.path,
        baseURL,
        params: config.params,
        data: config.data,
        headers: {
          ...authHeaders,
          ...config.headers,
        },
        metadata: { startTime },
      };

      const response = await this.axios.request<T>(axiosConfig);

      return {
        success: true,
        data: response.data,
        metadata: {
          executionTime: Date.now() - startTime,
          rateLimitInfo: this.rateLimitInfo.get('default'),
        },
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.handleError(error);
      }

      throw new JiraApiError(
        'UNKNOWN_ERROR',
        error instanceof Error ? error.message : 'Unknown error occurred',
        error
      );
    }
  }
}