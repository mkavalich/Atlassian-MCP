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
  analyzeAtlassianError
} from '../utils/errors.js';
import { logger, logApiCall } from '../utils/logger.js';

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
          params: config.params,
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

  private sanitizePath(path: string): string {
    return path.split('/').map(segment => {
      if (!segment) return segment;
      if (segment === '.' || segment === '..') {
        throw new Error(`Invalid path segment: ${segment}`);
      }
      if (/^[\w\-.:@~+]+$/.test(segment)) return segment;
      return encodeURIComponent(segment);
    }).join('/');
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

      // Add request context for debugging
      mappedError.details = {
        ...mappedError.details,
        requestUrl: error.config?.url,
        requestMethod: error.config?.method?.toUpperCase(),
        timestamp: new Date().toISOString(),
      };

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

  async makeRequest<T>(config: RequestConfig): Promise<ApiResponse<T>> {
    const startTime = Date.now();

    try {
      const authHeaders = this.authManager.getAuthHeaders(false);
      const baseURL = `${this.authManager.getBaseUrl()}/rest/api/3`;

      const axiosConfig: AxiosConfigWithMetadata = {
        method: config.method,
        url: this.sanitizePath(config.path),
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
}
