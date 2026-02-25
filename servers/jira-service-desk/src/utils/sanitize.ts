/**
 * Content sanitization utilities for prompt injection defense.
 * Wraps user-generated content with boundary markers.
 */

const CONTENT_BOUNDARY_START = '===USER_CONTENT_START===';
const CONTENT_BOUNDARY_END = '===USER_CONTENT_END===';
const MAX_CONTENT_LENGTH = 10000;

/**
 * Wrap user-generated content with boundary markers.
 * Does NOT modify content (preserves fidelity), only adds boundaries.
 * Truncates content exceeding MAX_CONTENT_LENGTH.
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
 * These fields typically contain user-generated content.
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
 * Sanitize a request/ticket comment object.
 */
export function sanitizeComment<T extends { body?: unknown; renderedBody?: unknown }>(comment: T): T {
  if (!comment) {
    return comment;
  }

  return {
    ...comment,
    body: comment.body ? wrapUserContent(comment.body) : comment.body,
    renderedBody: comment.renderedBody ? wrapUserContent(comment.renderedBody) : comment.renderedBody,
  };
}

/**
 * Sanitize a service desk request object.
 * Wraps description and summary with boundary markers.
 */
export function sanitizeRequest<T extends {
  requestFieldValues?: Array<{ fieldId?: string; value?: unknown }>;
}>(request: T): T {
  if (!request || !request.requestFieldValues) {
    return request;
  }

  return {
    ...request,
    requestFieldValues: request.requestFieldValues.map(field => {
      // Sanitize common user content fields
      if (field.fieldId === 'description' || field.fieldId === 'summary') {
        return {
          ...field,
          value: field.value ? wrapUserContent(field.value) : field.value,
        };
      }
      return field;
    }),
  };
}

/**
 * Sanitize an organization object.
 */
export function sanitizeOrganization<T extends { name?: unknown }>(org: T): T {
  if (!org) {
    return org;
  }

  return {
    ...org,
    name: org.name ? wrapUserContent(org.name) : org.name,
  };
}
