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
  'body',
  'title',
  'content',
  'value',
  'storage',
  'atlas_doc_format',
  'view',
  'export_view',
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
 * Sanitize a Confluence page body object.
 * Handles various body formats (storage, atlas_doc_format, view, export_view).
 */
export function sanitizePageBody<T extends Record<string, unknown>>(body: T | undefined | null): T | undefined | null {
  if (!body) {
    return body;
  }

  const result = { ...body } as Record<string, unknown>;

  // Handle storage format
  if (result.storage && typeof result.storage === 'object') {
    const storage = result.storage as Record<string, unknown>;
    if (storage.value) {
      result.storage = {
        ...storage,
        value: wrapUserContent(storage.value),
      };
    }
  }

  // Handle atlas_doc_format
  if (result.atlas_doc_format && typeof result.atlas_doc_format === 'object') {
    const adf = result.atlas_doc_format as Record<string, unknown>;
    if (adf.value) {
      result.atlas_doc_format = {
        ...adf,
        value: wrapUserContent(adf.value),
      };
    }
  }

  // Handle view format
  if (result.view && typeof result.view === 'object') {
    const view = result.view as Record<string, unknown>;
    if (view.value) {
      result.view = {
        ...view,
        value: wrapUserContent(view.value),
      };
    }
  }

  // Handle export_view format
  if (result.export_view && typeof result.export_view === 'object') {
    const exportView = result.export_view as Record<string, unknown>;
    if (exportView.value) {
      result.export_view = {
        ...exportView,
        value: wrapUserContent(exportView.value),
      };
    }
  }

  return result as T;
}

/**
 * Sanitize a Confluence comment object.
 */
export function sanitizeComment<T extends { body?: unknown }>(comment: T): T {
  if (!comment) {
    return comment;
  }

  return {
    ...comment,
    body: comment.body ? sanitizePageBody(comment.body as Record<string, unknown>) : comment.body,
  };
}

/**
 * Sanitize a Confluence page object.
 * Wraps body content and title with boundary markers.
 */
export function sanitizePage<T extends { body?: unknown; title?: string }>(page: T): T {
  if (!page) {
    return page;
  }

  return {
    ...page,
    title: page.title ? wrapUserContent(page.title) : page.title,
    body: page.body ? sanitizePageBody(page.body as Record<string, unknown>) : page.body,
  };
}
