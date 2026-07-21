import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';
import axiosRetry from 'axios-retry';
import http from 'http';
import https from 'https';
import { LRUCache } from 'lru-cache';
import { AuthManager } from '../auth/index.js';
import { RequestConfig, ApiResponse, RateLimitInfo } from '../types/index.js';
import {
  ConfluenceApiError,
  mapAtlassianError,
  analyzeConfluenceError,
  sanitizeErrorDetails
} from '../utils/errors.js';
import { logger, logApiCall, redactSensitive } from '../utils/logger.js';

interface AxiosConfigWithMetadata extends AxiosRequestConfig {
  metadata?: {
    startTime: number;
  };
}

/**
 * Confluence API Client supporting both v1 and v2 REST APIs
 *
 * API Base URLs:
 * - v1: /wiki/rest/api
 * - v2: /wiki/api/v2
 */
export class ConfluenceApiClient {
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

  /**
   * Resolve an attachment downloadLink to an absolute URL bound to the
   * configured Confluence site.
   *
   * This client only ever holds the TENANT credential, so every URL it fetches
   * with that credential must be on the tenant origin. Relative links (the only
   * shape the Confluence Cloud API returns in practice) are joined onto the base
   * URL exactly as before. An ABSOLUTE link is honoured only when its origin
   * matches the configured base URL; any other origin is rejected rather than
   * fetched, so a server-supplied link cannot carry the credential off-site.
   *
   * Resolution runs before any credential is read, so the off-origin case is
   * structurally incapable of attaching an Authorization header.
   *
   * Rejecting is deliberate rather than falling back to an unauthenticated
   * fetch: the only caller re-uploads the bytes, and a credential-less fetch of
   * a foreign URL would likely return an error page that would then be uploaded
   * as the "copied" attachment. A loud failure beats a plausible wrong result.
   */
  private resolveAttachmentDownloadUrl(downloadLink: string): string {
    // Guard first: ConfluenceAttachment.downloadLink is optional, so this can be
    // undefined at runtime. Without this the string methods below would throw a
    // raw TypeError from OUTSIDE downloadAttachment's try block, losing the
    // DOWNLOAD_ERROR wrapping that callers rely on.
    if (typeof downloadLink !== 'string' || downloadLink.length === 0) {
      throw new ConfluenceApiError(
        'INVALID_DOWNLOAD_LINK',
        'Attachment metadata did not include a downloadLink',
        { received: typeof downloadLink },
        'Re-fetch the attachment metadata; the attachment may be trashed or still uploading'
      );
    }

    const baseUrl = this.authManager.getBaseUrl();

    // No URI scheme => relative link. Existing behaviour, unchanged.
    if (!/^[a-z][a-z0-9+.-]*:/i.test(downloadLink)) {
      // V2 API returns /download/... without the /wiki prefix
      return downloadLink.startsWith('/wiki/')
        ? `${baseUrl}${downloadLink}`
        : `${baseUrl}/wiki${downloadLink}`;
    }

    let linkHost: string;
    let linkOrigin: string;
    let expectedHost: string;
    let expectedOrigin: string;
    try {
      const link = new URL(downloadLink);
      const expected = new URL(baseUrl);
      linkHost = link.host;
      linkOrigin = link.origin;
      expectedHost = expected.host;
      expectedOrigin = expected.origin;
    } catch {
      throw new ConfluenceApiError(
        'INVALID_DOWNLOAD_LINK',
        'Attachment downloadLink could not be resolved against the configured Confluence site',
        { reason: 'unparseable downloadLink or base URL' },
        'Re-fetch the attachment metadata and confirm the Confluence base URL is a valid absolute URL'
      );
    }

    if (linkOrigin !== expectedOrigin) {
      throw new ConfluenceApiError(
        'DOWNLOAD_LINK_ORIGIN_MISMATCH',
        `Refusing to download attachment: downloadLink points at host "${linkHost}", which is not the configured Confluence site`,
        { linkHost, expectedHost },
        'Attachment downloads are restricted to the configured Confluence site so the tenant API token is never sent to another host. If Atlassian has started returning off-site media URLs, add an explicit UNAUTHENTICATED fetch path for them instead of widening this check.'
      );
    }

    // Absolute but same-origin: equivalent to the relative case. Log it - this
    // branch has never been observed on a live tenant and we want to know if it starts.
    logger.warn('Attachment downloadLink was absolute', { linkHost });
    return downloadLink;
  }

  private handleError(error: AxiosError): never {
    const status = error.response?.status;
    const data = error.response?.data as any;

    if (status) {
      // Use enhanced Atlassian error mapping
      const mappedError = mapAtlassianError(status, data);

      // Analyze error for additional context
      const analysis = analyzeConfluenceError(mappedError);

      // Enhance the error with analysis results
      mappedError.code = analysis.code;
      mappedError.suggestion = analysis.suggestion;

      // Add request context for debugging (re-sanitize the merged object,
      // otherwise requestUrl/requestMethod bypass the constructor's sanitizer)
      mappedError.details = sanitizeErrorDetails({
        ...mappedError.details,
        requestUrl: error.config?.url,
        requestMethod: error.config?.method?.toUpperCase(),
        timestamp: new Date().toISOString(),
      });

      throw mappedError;
    }

    // Fallback for network errors or other issues
    throw new ConfluenceApiError(
      'NETWORK_ERROR',
      error.message || 'Network error occurred',
      { originalError: error },
      'Check your internet connection and Confluence instance availability'
    );
  }

  /**
   * Get the base URL for the specified API version
   */
  private getApiBaseUrl(apiVersion: 'v1' | 'v2'): string {
    const baseUrl = this.authManager.getBaseUrl();
    if (apiVersion === 'v2') {
      return `${baseUrl}/wiki/api/v2`;
    }
    return `${baseUrl}/wiki/rest/api`;
  }

  /**
   * Make a request to the Confluence API
   * @param config Request configuration
   * @returns API response
   */
  async makeRequest<T>(config: RequestConfig): Promise<ApiResponse<T>> {
    const startTime = Date.now();
    const apiVersion = config.apiVersion || 'v2';

    try {
      const authHeaders = this.authManager.getAuthHeaders();
      const baseURL = this.getApiBaseUrl(apiVersion);

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

      throw new ConfluenceApiError(
        'UNKNOWN_ERROR',
        error instanceof Error ? error.message : 'Unknown error occurred',
        error
      );
    }
  }

  /**
   * Make a request to the Confluence v1 API
   */
  async makeV1Request<T>(config: Omit<RequestConfig, 'apiVersion'>): Promise<ApiResponse<T>> {
    return this.makeRequest<T>({ ...config, apiVersion: 'v1' });
  }

  /**
   * Make a request to the Confluence v2 API
   */
  async makeV2Request<T>(config: Omit<RequestConfig, 'apiVersion'>): Promise<ApiResponse<T>> {
    return this.makeRequest<T>({ ...config, apiVersion: 'v2' });
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
   * Download attachment content as a Buffer
   * @param downloadLink The download link from the attachment metadata
   * @returns API response with Buffer data
   */
  async downloadAttachment(downloadLink: string): Promise<ApiResponse<Buffer>> {
    const startTime = Date.now();

    // Resolve and origin-check the target BEFORE entering the credentialed
    // region. Thrown outside the try so the specific error code survives instead
    // of being re-wrapped as DOWNLOAD_ERROR by the catch below.
    const fullUrl = this.resolveAttachmentDownloadUrl(downloadLink);

    try {
      const authHeaders = this.authManager.getAuthHeaders();

      const response = await this.axios.request<Buffer>({
        method: 'GET',
        url: fullUrl,
        headers: authHeaders,
        responseType: 'arraybuffer',
      });

      return {
        success: true,
        data: Buffer.from(response.data),
        metadata: {
          executionTime: Date.now() - startTime,
          rateLimitInfo: this.rateLimitInfo.get('default'),
        },
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.handleError(error);
      }

      throw new ConfluenceApiError(
        'DOWNLOAD_ERROR',
        error instanceof Error ? error.message : 'Failed to download attachment',
        error
      );
    }
  }
}
