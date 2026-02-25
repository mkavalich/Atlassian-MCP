import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import axios from 'axios';
import { JiraApiClient } from '../../src/api/client.js';
import { AuthManager } from '../../src/auth/index.js';
import { AuthConfig } from '../../src/types/index.js';
import { RateLimitError, NotFoundError } from '../../src/utils/errors.js';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('JiraApiClient', () => {
  let authManager: AuthManager;
  let apiClient: JiraApiClient;
  let mockAxiosInstance: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    jest.restoreAllMocks();

    // Setup auth config
    const authConfig: AuthConfig = {
      type: 'basic',
      baseUrl: 'https://test.atlassian.net',
      email: 'test@example.com',
      apiToken: 'test-token',
    };

    // Create auth manager
    authManager = new AuthManager(authConfig);

    // Mock axios instance with interceptors that actually call the functions
    mockAxiosInstance = {
      request: jest.fn(),
      interceptors: {
        request: { 
          use: jest.fn((onFulfilled) => {
            // Store the interceptor for later use
            if (onFulfilled) {
              mockAxiosInstance._requestInterceptor = onFulfilled;
            }
          }) 
        },
        response: { 
          use: jest.fn((onFulfilled) => {
            // Store the interceptor for later use  
            if (onFulfilled) {
              mockAxiosInstance._responseInterceptor = onFulfilled;
            }
          }) 
        },
      },
      _requestInterceptor: null,
      _responseInterceptor: null,
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance);

    // Create API client
    apiClient = new JiraApiClient(authManager);
  });

  describe('makeRequest', () => {
    it('should make successful GET request', async () => {
      const mockResponse = {
        data: { id: '123', name: 'Test Project' },
        status: 200,
        headers: {},
        config: { metadata: { startTime: Date.now() } },
      };

      mockAxiosInstance.request.mockResolvedValue(mockResponse);

      const result = await apiClient.makeRequest({
        method: 'GET',
        path: '/project/TEST',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse.data);
      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'GET',
        url: '/project/TEST',
        params: undefined,
        data: undefined,
        headers: undefined,
        metadata: expect.any(Object),
      });
    });

    it('should handle rate limit errors', async () => {
      const mockError = {
        response: {
          status: 429,
          headers: {
            'retry-after': '60',
            'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 60),
          },
          data: {
            errorMessages: ['Rate limit exceeded'],
          },
        },
        config: {
          url: '/project/TEST',
        },
        message: 'Request failed with status code 429',
        name: 'AxiosError',
        isAxiosError: true,
      };

      // Mock axios.isAxiosError to return true for our mock error
      jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);
      mockAxiosInstance.request.mockRejectedValue(mockError);

      await expect(
        apiClient.makeRequest({
          method: 'GET',
          path: '/project/TEST',
        })
      ).rejects.toThrow(RateLimitError);
    });

    it('should handle 404 errors', async () => {
      const mockError = {
        response: {
          status: 404,
          data: {
            errorMessages: ['Project not found'],
          },
        },
        config: {
          url: '/project/TEST',
        },
        message: 'Request failed with status code 404',
        name: 'AxiosError',
        isAxiosError: true,
      };

      // Mock axios.isAxiosError to return true for our mock error
      jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);
      mockAxiosInstance.request.mockRejectedValue(mockError);

      await expect(
        apiClient.makeRequest({
          method: 'GET',
          path: '/project/TEST',
        })
      ).rejects.toThrow(NotFoundError);
    });

    it('should track rate limit info from headers', async () => {
      const mockResponse = {
        data: { success: true },
        status: 200,
        headers: {
          'x-ratelimit-limit': '100',
          'x-ratelimit-remaining': '99',
          'x-ratelimit-reset': '1234567890',
        },
        config: { 
          metadata: { startTime: Date.now() },
          method: 'GET',
          url: '/test'
        },
      };

      mockAxiosInstance.request.mockImplementation(async (_config: any) => {
        // Simulate the response interceptor being called
        if (mockAxiosInstance._responseInterceptor) {
          return mockAxiosInstance._responseInterceptor(mockResponse);
        }
        return mockResponse;
      });

      await apiClient.makeRequest({
        method: 'GET',
        path: '/test',
      });

      const rateLimitInfo = apiClient.getRateLimitInfo();
      expect(rateLimitInfo).toEqual({
        limit: 100,
        remaining: 99,
        reset: 1234567890,
      });
    });
  });

  describe('waitForRateLimit', () => {
    it('should wait when rate limit is reached', async () => {
      // Set rate limit info
      const resetTime = Math.floor(Date.now() / 1000) + 1; // 1 second in future
      const mockResponse = {
        data: {},
        status: 200,
        headers: {
          'x-ratelimit-limit': '100',
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': String(resetTime),
        },
        config: { metadata: { startTime: Date.now() } },
      };

      mockAxiosInstance.request.mockResolvedValue(mockResponse);
      await apiClient.makeRequest({ method: 'GET', path: '/test' });

      // Mock setTimeout
      jest.useFakeTimers();
      const waitPromise = apiClient.waitForRateLimit();
      
      // Fast-forward time
      jest.runAllTimers();
      
      await waitPromise;
      
      jest.useRealTimers();
    });

    it('should not wait when rate limit is not reached', async () => {
      const mockResponse = {
        data: {},
        status: 200,
        headers: {
          'x-ratelimit-limit': '100',
          'x-ratelimit-remaining': '50',
          'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600),
        },
        config: { metadata: { startTime: Date.now() } },
      };

      mockAxiosInstance.request.mockResolvedValue(mockResponse);
      await apiClient.makeRequest({ method: 'GET', path: '/test' });

      // Should return immediately
      const start = Date.now();
      await apiClient.waitForRateLimit();
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(100); // Should be nearly instant
    });
  });
});