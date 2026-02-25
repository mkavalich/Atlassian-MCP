/**
 * Content sanitization utilities for prompt injection defense.
 * Wraps user-generated content with boundary markers to clearly delineate
 * untrusted content from system content.
 */

const CONTENT_BOUNDARY_START = '===USER_CONTENT_START===';
const CONTENT_BOUNDARY_END = '===USER_CONTENT_END===';
const MAX_CONTENT_LENGTH = 10000;

/**
 * Wrap user-generated content with boundary markers.
 * Does NOT modify content (preserves fidelity), only adds markers.
 * Truncates extremely long content to prevent memory issues.
 */
export function wrapUserContent(content: unknown): string | null {
  if (content === null || content === undefined) {
    return null;
  }

  const stringContent = typeof content === 'string'
    ? content
    : JSON.stringify(content);

  const truncated = stringContent.length > MAX_CONTENT_LENGTH
    ? stringContent.slice(0, MAX_CONTENT_LENGTH) + '...[TRUNCATED]'
    : stringContent;

  return `${CONTENT_BOUNDARY_START}\n${truncated}\n${CONTENT_BOUNDARY_END}`;
}

/**
 * User content field names that require sanitization.
 * These fields typically contain user-generated content that could
 * potentially include prompt injection attempts.
 */
const USER_CONTENT_FIELDS = new Set([
  'description',
  'summary',
  'body',
  'renderedBody',
  'comment',
  'content',
]);

/**
 * Sanitize known user content fields in an object.
 * Only wraps fields that are in the USER_CONTENT_FIELDS set.
 */
export function sanitizeUserFields<T extends Record<string, unknown>>(obj: T): T {
  const result = { ...obj };
  for (const field of USER_CONTENT_FIELDS) {
    if (field in result && result[field] != null) {
      (result as Record<string, unknown>)[field] = wrapUserContent(result[field]);
    }
  }
  return result;
}

/**
 * Sanitize a comment object by wrapping body and renderedBody fields.
 */
export function sanitizeComment<T extends { body?: unknown; renderedBody?: unknown }>(comment: T): T {
  return {
    ...comment,
    body: comment.body ? wrapUserContent(comment.body) : comment.body,
    renderedBody: comment.renderedBody ? wrapUserContent(comment.renderedBody) : comment.renderedBody,
  };
}

/**
 * Sanitize issue fields by wrapping summary and description.
 */
export function sanitizeIssueFields<T extends { summary?: unknown; description?: unknown }>(fields: T): T {
  return {
    ...fields,
    summary: fields.summary ? wrapUserContent(fields.summary) : fields.summary,
    description: fields.description ? wrapUserContent(fields.description) : fields.description,
  };
}
