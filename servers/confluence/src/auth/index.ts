import { AuthConfig } from '../types/index.js';
import { AuthenticationError } from '../utils/errors.js';

export class AuthManager {
  private config: AuthConfig;

  constructor(config: AuthConfig) {
    this.config = config;
    // Defer validation until actual use to allow server startup
  }

  // Validate config when authentication is actually needed
  private validateConfig(): void {
    if (!this.config.baseUrl) {
      throw new AuthenticationError('Confluence base URL is required');
    }

    if (this.config.type === 'basic') {
      if (!this.config.email || !this.config.apiToken) {
        throw new AuthenticationError('Email and API token are required for basic authentication');
      }
    } else if (this.config.type === 'oauth') {
      if (!this.config.clientId || !this.config.clientSecret) {
        throw new AuthenticationError('Client ID and Client Secret are required for OAuth authentication');
      }
    } else {
      throw new AuthenticationError(`Unsupported authentication type: ${this.config.type}`);
    }
  }

  getAuthHeaders(): Record<string, string> {
    // Validate config when authentication is actually needed
    this.validateConfig();

    if (this.config.type === 'basic') {
      // This server is site-scoped: every request it makes targets the tenant host, so
      // Basic auth with email:apiToken is the only correct credential. There is
      // deliberately NO org-admin branch here -- an admin.atlassian.com organization
      // token must not be attachable to a tenant request, and getAuthHeaders takes no
      // parameter that could select one.
      const auth = Buffer.from(`${this.config.email}:${this.config.apiToken}`).toString('base64');
      return {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      };
    } else if (this.config.type === 'oauth' && this.config.accessToken) {
      return {
        'Authorization': `Bearer ${this.config.accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      };
    }

    throw new AuthenticationError('No valid authentication credentials available');
  }

  getBaseUrl(): string {
    return this.config.baseUrl.replace(/\/$/, '');
  }

  async refreshOAuthToken(): Promise<void> {
    if (this.config.type !== 'oauth' || !this.config.refreshToken) {
      throw new AuthenticationError('OAuth refresh token not available');
    }

    // TODO: Implement OAuth token refresh
    throw new Error('OAuth token refresh not yet implemented');
  }
}
