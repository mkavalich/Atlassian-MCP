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

export class ConfluenceApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: any,
    public suggestion?: string
  ) {
    super(sanitizeErrorMessage(message));
    this.name = 'ConfluenceApiError';
    this.details = sanitizeErrorDetails(details);
  }
}

export class AuthenticationError extends ConfluenceApiError {
  constructor(message: string = 'Authentication failed') {
    super('AUTH_ERROR', message, undefined, 'Check your API credentials and permissions');
  }
}

export class RateLimitError extends ConfluenceApiError {
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

export class ValidationError extends ConfluenceApiError {
  constructor(message: string, details?: any) {
    super('VALIDATION_ERROR', message, details, 'Check input parameters and try again');
  }
}

export class NotFoundError extends ConfluenceApiError {
  constructor(resource: string, identifier: string) {
    super(
      'NOT_FOUND',
      `${resource} with identifier '${identifier}' not found`,
      { resource, identifier },
      `Verify the ${resource} exists and you have permission to access it`
    );
  }
}

export class PermissionError extends ConfluenceApiError {
  constructor(operation: string, resource?: string) {
    super(
      'PERMISSION_DENIED',
      `You don't have permission to ${operation}${resource ? ` on ${resource}` : ''}`,
      { operation, resource },
      'Request the necessary permissions from your Confluence administrator'
    );
  }
}

// Helper function to safely convert error values to strings
function stringifyErrorValue(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'object') {
    // Handle objects with message property
    if (value.message) {
      return String(value.message);
    }
    // Handle objects with title property (common in Confluence errors)
    if (value.title) {
      return String(value.title);
    }
    // Fallback to JSON for other objects
    try {
      return JSON.stringify(value);
    } catch {
      return 'Error details unavailable';
    }
  }
  return String(value);
}

// Enhanced error mapping for Atlassian-specific error codes
export function mapAtlassianError(statusCode: number, responseBody?: any): ConfluenceApiError {
  const errorData = responseBody?.errors || responseBody?.errorMessages || responseBody?.message || [];

  let errorMessage: string;
  if (Array.isArray(errorData)) {
    errorMessage = errorData.map(stringifyErrorValue).filter(Boolean).join('; ') || 'Unknown error';
  } else if (typeof errorData === 'object') {
    errorMessage = Object.values(errorData).map(stringifyErrorValue).filter(Boolean).join('; ') || 'Unknown error';
  } else {
    errorMessage = stringifyErrorValue(errorData) || stringifyErrorValue(responseBody?.message) || 'Unknown error';
  }

  switch (statusCode) {
    case 400:
      return new ValidationError(errorMessage || 'Bad request - invalid parameters', responseBody);
    case 401:
      return new AuthenticationError(errorMessage || 'Authentication required');
    case 403:
      return new PermissionError('perform this operation', errorMessage);
    case 404:
      return new NotFoundError('resource', errorMessage || 'Resource not found');
    case 409:
      return new ConfluenceApiError(
        'CONFLICT',
        errorMessage || 'Conflict - resource already exists or version mismatch',
        responseBody,
        'Check for duplicate content or update the version number'
      );
    case 429:
      const resetTime = responseBody?.['X-RateLimit-Reset'] || Math.floor(Date.now() / 1000) + 3600;
      return new RateLimitError(resetTime);
    case 500:
      return new ConfluenceApiError(
        'INTERNAL_SERVER_ERROR',
        'Confluence server error - please try again later',
        responseBody,
        'Contact your Confluence administrator if the problem persists'
      );
    case 503:
      return new ConfluenceApiError(
        'SERVICE_UNAVAILABLE',
        'Confluence service temporarily unavailable',
        responseBody,
        'Try again in a few minutes'
      );
    default:
      return new ConfluenceApiError(
        `HTTP_${statusCode}`,
        errorMessage || `Request failed with status ${statusCode}`,
        responseBody,
        'Check the request parameters and try again'
      );
  }
}

// Common Confluence error patterns
export const CONFLUENCE_ERROR_PATTERNS = {
  SPACE_KEY_EXISTS: /space.*key.*already exists/i,
  SPACE_NAME_EXISTS: /space.*name.*already exists/i,
  INVALID_SPACE_KEY: /space key.*invalid/i,
  CONTENT_NOT_FOUND: /content.*not found/i,
  VERSION_CONFLICT: /version.*conflict/i,
  PARENT_NOT_FOUND: /parent.*not found/i,
  INSUFFICIENT_PERMISSIONS: /insufficient.*permission/i,
  CONTENT_LOCKED: /content.*locked/i,
  ATTACHMENT_TOO_LARGE: /attachment.*too large/i,
};

// Enhanced error analysis for Confluence
export function analyzeConfluenceError(error: any): { code: string; suggestion: string } {
  const message = error.message || error.toString();

  if (CONFLUENCE_ERROR_PATTERNS.SPACE_KEY_EXISTS.test(message)) {
    return {
      code: 'SPACE_KEY_EXISTS',
      suggestion: 'Choose a different space key that is not already in use'
    };
  }

  if (CONFLUENCE_ERROR_PATTERNS.SPACE_NAME_EXISTS.test(message)) {
    return {
      code: 'SPACE_NAME_EXISTS',
      suggestion: 'Choose a different space name that is not already in use'
    };
  }

  if (CONFLUENCE_ERROR_PATTERNS.INVALID_SPACE_KEY.test(message)) {
    return {
      code: 'INVALID_SPACE_KEY',
      suggestion: 'Space key must be alphanumeric characters only (no spaces or special characters)'
    };
  }

  if (CONFLUENCE_ERROR_PATTERNS.VERSION_CONFLICT.test(message)) {
    return {
      code: 'VERSION_CONFLICT',
      suggestion: 'The content was modified. Get the latest version and retry with the updated version number'
    };
  }

  if (CONFLUENCE_ERROR_PATTERNS.PARENT_NOT_FOUND.test(message)) {
    return {
      code: 'PARENT_NOT_FOUND',
      suggestion: 'The parent page does not exist. Use search_pages to find valid parent IDs'
    };
  }

  if (CONFLUENCE_ERROR_PATTERNS.CONTENT_LOCKED.test(message)) {
    return {
      code: 'CONTENT_LOCKED',
      suggestion: 'The content is locked for editing. Wait for the lock to be released or contact the editor'
    };
  }

  if (CONFLUENCE_ERROR_PATTERNS.ATTACHMENT_TOO_LARGE.test(message)) {
    return {
      code: 'ATTACHMENT_TOO_LARGE',
      suggestion: 'The attachment exceeds the maximum file size. Reduce file size or contact your administrator'
    };
  }

  return {
    code: error.code || 'UNKNOWN_ERROR',
    suggestion: error.suggestion || 'Check the error details and try again'
  };
}
