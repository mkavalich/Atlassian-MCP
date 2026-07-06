/**
 * Sanitizes error messages to prevent information disclosure.
 * Removes stack traces, file paths, and internal details.
 */
export function sanitizeErrorMessage(message: string): string {
  if (!message || typeof message !== 'string') {
    return 'An error occurred';
  }

  let sanitized = message;

  // Remove stack traces (lines starting with "at " or containing file paths)
  sanitized = sanitized.replace(/\s+at\s+.+/g, '');

  // Remove file paths (Windows and Unix)
  sanitized = sanitized.replace(/[A-Za-z]:\\[^\s:]+/g, '[path]');
  sanitized = sanitized.replace(/\/[^\s:]+\.(ts|js|json)/g, '[path]');

  // Remove HTTP/HTTPS URLs (Atlassian API errors sometimes echo the site URL)
  sanitized = sanitized.replace(/https?:\/\/[^\s]+/gi, '[url]');

  // Remove line/column numbers
  sanitized = sanitized.replace(/:\d+:\d+/g, '');

  // Remove internal error codes that might expose implementation details
  sanitized = sanitized.replace(/Error:\s*[A-Z_]+_\d+/g, 'Error');

  // Truncate overly long messages (max 500 chars)
  if (sanitized.length > 500) {
    sanitized = sanitized.substring(0, 497) + '...';
  }

  // Clean up multiple spaces and trim
  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  return sanitized || 'An error occurred';
}

/**
 * Sanitizes error details object to remove sensitive information.
 */
export function sanitizeErrorDetails(details: any): any {
  if (!details) return undefined;

  // If it's a primitive, return as-is (no sensitive data in primitives)
  if (typeof details !== 'object') return details;

  // Create a shallow sanitized copy
  const sanitized: Record<string, any> = {};
  const sensitiveKeys = ['password', 'token', 'secret', 'apiKey', 'authorization', 'cookie', 'session'];

  for (const [key, value] of Object.entries(details)) {
    // Skip sensitive keys
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
      continue;
    }

    // Skip internal error properties
    if (key === 'stack' || key === 'originalError') {
      continue;
    }

    // Recursively sanitize nested objects (max 2 levels deep)
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeErrorDetails(value);
    } else {
      sanitized[key] = value;
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

export class JiraApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: any,
    public suggestion?: string
  ) {
    super(sanitizeErrorMessage(message));
    this.name = 'JiraApiError';
    this.details = sanitizeErrorDetails(details);
  }
}

export class AuthenticationError extends JiraApiError {
  constructor(message: string = 'Authentication failed') {
    super('AUTH_ERROR', message, undefined, 'Check your API credentials and permissions');
  }
}

export class RateLimitError extends JiraApiError {
  constructor(resetTime: number) {
    const resetDate = new Date(resetTime * 1000);
    super(
      'RATE_LIMIT',
      'Rate limit exceeded',
      { resetTime },
      `Wait until ${resetDate.toISOString()} before retrying`
    );
  }
}

export class ValidationError extends JiraApiError {
  constructor(message: string, details?: any) {
    super('VALIDATION_ERROR', message, details, 'Check input parameters and try again');
  }
}

export class NotFoundError extends JiraApiError {
  constructor(resource: string, identifier: string) {
    super(
      'NOT_FOUND',
      `${resource} with identifier '${identifier}' not found`,
      { resource, identifier },
      `Verify the ${resource} exists and you have permission to access it`
    );
  }
}

export class PermissionError extends JiraApiError {
  constructor(operation: string, resource?: string) {
    super(
      'PERMISSION_DENIED',
      `You don't have permission to ${operation}${resource ? ` on ${resource}` : ''}`,
      { operation, resource },
      'Request the necessary permissions from your Jira administrator'
    );
  }
}

/**
 * Normalizes any thrown value into a sanitized, client-safe error payload.
 * Guarantees the message and details pass through sanitization.
 */
export function formatToolError(error: unknown): {
  code: string;
  message: string;
  details?: any;
  suggestion?: string;
} {
  if (error instanceof JiraApiError) {
    // JiraApiError already sanitized message + details in its constructor
    return {
      code: error.code,
      message: error.message,
      details: error.details,
      suggestion: error.suggestion,
    };
  }
  const message =
    error instanceof Error ? sanitizeErrorMessage(error.message) : 'An unknown error occurred';
  return { code: 'UNKNOWN_ERROR', message };
}

// Enhanced error mapping for Atlassian-specific error codes
export function mapAtlassianError(statusCode: number, responseBody?: any): JiraApiError {
  const errorData = responseBody?.errors || responseBody?.errorMessages || [];
  const errorMessage = Array.isArray(errorData) ? errorData.join('; ') : 
    (typeof errorData === 'object' ? Object.values(errorData).join('; ') : responseBody?.message || 'Unknown error');

  switch (statusCode) {
    case 400:
      return new ValidationError(errorMessage || 'Bad request - invalid parameters', responseBody);
    case 401:
      return new AuthenticationError(errorMessage || 'Authentication required');
    case 403:
      return new PermissionError('perform this operation', errorMessage);
    case 404:
      return new NotFoundError('resource', errorMessage || 'Resource not found');
    case 429:
      const resetTime = responseBody?.['X-RateLimit-Reset'] || Math.floor(Date.now() / 1000) + 3600;
      return new RateLimitError(resetTime);
    case 500:
      return new JiraApiError(
        'INTERNAL_SERVER_ERROR',
        'Jira server error - please try again later',
        responseBody,
        'Contact your Jira administrator if the problem persists'
      );
    case 503:
      return new JiraApiError(
        'SERVICE_UNAVAILABLE',
        'Jira service temporarily unavailable',
        responseBody,
        'Try again in a few minutes'
      );
    default:
      return new JiraApiError(
        `HTTP_${statusCode}`,
        errorMessage || `Request failed with status ${statusCode}`,
        responseBody,
        'Check the request parameters and try again'
      );
  }
}

// Common Atlassian error patterns
export const ATLASSIAN_ERROR_PATTERNS = {
  PROJECT_KEY_EXISTS: /project.*key.*already exists/i,
  PROJECT_NAME_EXISTS: /project.*name.*already exists/i,
  INVALID_PROJECT_KEY: /project key.*invalid/i,
  INSUFFICIENT_LICENSE: /license.*insufficient/i,
  WORKFLOW_IN_USE: /workflow.*in use/i,
  PERMISSION_SCHEME_IN_USE: /permission scheme.*in use/i,
  FIELD_LOCKED: /field.*locked/i,
  ISSUE_TYPE_IN_USE: /issue type.*in use/i,
};

// Enhanced error analysis
export function analyzeAtlassianError(error: any): { code: string; suggestion: string } {
  const message = error.message || error.toString();
  
  if (ATLASSIAN_ERROR_PATTERNS.PROJECT_KEY_EXISTS.test(message)) {
    return {
      code: 'PROJECT_KEY_EXISTS',
      suggestion: 'Choose a different project key that is not already in use'
    };
  }
  
  if (ATLASSIAN_ERROR_PATTERNS.PROJECT_NAME_EXISTS.test(message)) {
    return {
      code: 'PROJECT_NAME_EXISTS', 
      suggestion: 'Choose a different project name that is not already in use'
    };
  }
  
  if (ATLASSIAN_ERROR_PATTERNS.INVALID_PROJECT_KEY.test(message)) {
    return {
      code: 'INVALID_PROJECT_KEY',
      suggestion: 'Project key must be 2-10 uppercase letters and numbers, starting with a letter'
    };
  }
  
  if (ATLASSIAN_ERROR_PATTERNS.INSUFFICIENT_LICENSE.test(message)) {
    return {
      code: 'INSUFFICIENT_LICENSE',
      suggestion: 'Contact your Jira administrator to upgrade your license'
    };
  }
  
  if (ATLASSIAN_ERROR_PATTERNS.WORKFLOW_IN_USE.test(message)) {
    return {
      code: 'WORKFLOW_IN_USE',
      suggestion: 'Remove workflow from all projects before deleting it'
    };
  }
  
  return {
    code: error.code || 'UNKNOWN_ERROR',
    suggestion: error.suggestion || 'Check the error details and try again'
  };
}