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
 * Sanitize an idea object.
 * Wraps description and summary with boundary markers.
 */
export function sanitizeIdea<T extends { fields?: { description?: unknown; summary?: unknown } }>(idea: T): T {
  if (!idea || !idea.fields) {
    return idea;
  }

  return {
    ...idea,
    fields: {
      ...idea.fields,
      summary: idea.fields.summary ? wrapUserContent(idea.fields.summary) : idea.fields.summary,
      description: idea.fields.description ? wrapUserContent(idea.fields.description) : idea.fields.description,
    },
  };
}

/**
 * Sanitize an insight object.
 * Wraps body content with boundary markers.
 */
export function sanitizeInsight<T extends { body?: unknown }>(insight: T): T {
  if (!insight) {
    return insight;
  }

  return {
    ...insight,
    body: insight.body ? wrapUserContent(insight.body) : insight.body,
  };
}
