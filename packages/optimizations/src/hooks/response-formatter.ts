/**
 * Response Formatter Hook
 *
 * Transforms tool responses to token-efficient formats (TOON, TSV).
 * This is an feature providing ~50-60% token reduction.
 */

import {
  CompactSerializer,
  type ResponseFormat,
  type EntityType,
} from '@atlassian-mcp/shared';

/**
 * Response formatter configuration.
 */
export interface ResponseFormatterConfig {
  /** Default format when not specified (default: 'concise') */
  defaultFormat?: ResponseFormat;
  /** Enable debug logging (default: false) */
  debug?: boolean;
}

/**
 * Maps tool names to entity types for proper formatting.
 */
const TOOL_ENTITY_MAP: Record<string, EntityType> = {
  // Jira Projects
  search_projects: 'project',
  get_project: 'project',
  create_project: 'project',
  update_project: 'project',
  search_jql: 'issue',
  get_issue: 'issue',
  create_issue: 'issue',
  update_issue: 'issue',
  get_comments: 'comment',
  add_comment: 'comment',
  get_dashboards: 'dashboard',
  get_dashboard: 'dashboard',
  create_dashboard: 'dashboard',

  // Jira Workflows
  get_workflows: 'workflow',
  get_screens: 'screen',
  get_screen_schemes: 'screenScheme',
  get_workflow_schemes: 'workflowScheme',

  // Jira Fields & Permissions
  get_fields: 'field',
  get_fields_paginated: 'field',
  get_permission_schemes: 'permission',
  get_permission_grants: 'permission',

  // Jira Organization
  get_organization_users: 'user',
  search_organization_users: 'user',
  get_directory_users: 'user',
  search_site_users: 'user',

  // Confluence
  search_spaces: 'space',
  get_space: 'space',
  search_pages: 'page',
  get_page: 'page',
  get_page_children: 'page',
  get_attachments: 'attachment',
  get_blog_posts: 'blogPost',
  get_page_comments: 'comment',
  get_footer_comments: 'comment',
  get_inline_comments: 'comment',

  // Jira Product Discovery
  get_ideas: 'idea',
  search_ideas: 'idea',
  get_insights: 'insight',
  get_jpd_projects: 'project',
};

/**
 * Detect entity type from tool name.
 */
function detectEntityType(toolName: string): EntityType | null {
  // Direct mapping
  if (TOOL_ENTITY_MAP[toolName]) {
    return TOOL_ENTITY_MAP[toolName];
  }

  // Pattern-based detection
  const patterns: Array<[RegExp, EntityType]> = [
    [/project/i, 'project'],
    [/issue/i, 'issue'],
    [/comment/i, 'comment'],
    [/dashboard/i, 'dashboard'],
    [/workflow/i, 'workflow'],
    [/screen/i, 'screen'],
    [/field/i, 'field'],
    [/permission/i, 'permission'],
    [/user/i, 'user'],
    [/space/i, 'space'],
    [/page/i, 'page'],
    [/attachment/i, 'attachment'],
    [/blog/i, 'blogPost'],
    [/idea/i, 'idea'],
  ];

  for (const [pattern, entityType] of patterns) {
    if (pattern.test(toolName)) {
      return entityType;
    }
  }

  return null;
}

/**
 * Extract data array from tool response for formatting.
 */
function extractDataArray(result: unknown): Record<string, unknown>[] | null {
  if (!result || typeof result !== 'object') {
    return null;
  }

  const obj = result as Record<string, unknown>;

  // Common patterns for data arrays in responses
  const arrayFields = [
    'projects', 'issues', 'comments', 'dashboards', 'workflows',
    'screens', 'screenSchemes', 'fields', 'users', 'spaces', 'pages',
    'attachments', 'blogPosts', 'ideas', 'insights', 'results', 'values',
    'records', 'permissions', 'permissionSchemes', 'fieldConfigurations',
    'notificationSchemes', 'workflowSchemes', 'schemes', 'groups',
    'organizations', 'serviceDesks', 'requestTypes',
  ];

  for (const field of arrayFields) {
    if (Array.isArray(obj[field]) && obj[field].length > 0) {
      return obj[field] as Record<string, unknown>[];
    }
  }

  // Check if the result itself is an array
  if (Array.isArray(result) && result.length > 0) {
    return result as Record<string, unknown>[];
  }

  return null;
}

/**
 * Creates a response formatter hook .
 *
 * @example
 * ```typescript
 * import { createResponseFormatterHook } from './hooks/response-formatter.js';
 *
 * const formatter = createResponseFormatterHook({
 *   defaultFormat: 'concise',
 *   debug: true,
 * });
 *
 * // Use in hooks
 * const hooks = {
 *   transformResponse: formatter.transformResponse,
 * };
 * ```
 */
export function createResponseFormatterHook(config: ResponseFormatterConfig = {}) {
  const {
    defaultFormat = 'concise',
    debug = false,
  } = config;

  /**
   * Transform response to token-efficient format.
   *
   * @param toolName - Name of the tool that produced the result
   * @param result - Original tool result (typically has content array with text)
   * @param params - Original tool parameters (may include responseFormat)
   * @returns Transformed result with formatted text
   */
  async function transformResponse(
    toolName: string,
    result: unknown,
    params?: Record<string, unknown>
  ): Promise<unknown> {
    // Extract response format from params, default to config
    const format = (params?.responseFormat as ResponseFormat) || defaultFormat;

    // Skip formatting for detailed format (return full JSON)
    if (format === 'detailed') {
      if (debug) {
        console.log(`[ResponseFormatter] ${toolName}: detailed format, skipping transformation`);
      }
      return result;
    }

    // Detect entity type
    const entityType = detectEntityType(toolName);
    if (!entityType) {
      if (debug) {
        console.log(`[ResponseFormatter] ${toolName}: unknown entity type, skipping transformation`);
      }
      return result;
    }

    // Parse the result if it's in MCP content format
    let parsedResult: unknown = result;

    if (result && typeof result === 'object') {
      const obj = result as Record<string, unknown>;

      // MCP tool results have content array with text
      if (Array.isArray(obj.content) && obj.content.length > 0) {
        const firstContent = obj.content[0] as Record<string, unknown>;
        if (firstContent?.type === 'text' && typeof firstContent.text === 'string') {
          try {
            parsedResult = JSON.parse(firstContent.text);
          } catch {
            // Not JSON, skip transformation
            if (debug) {
              console.log(`[ResponseFormatter] ${toolName}: content not JSON, skipping`);
            }
            return result;
          }
        }
      }
    }

    // Extract data array for formatting
    const dataArray = extractDataArray(parsedResult);
    if (!dataArray || dataArray.length === 0) {
      if (debug) {
        console.log(`[ResponseFormatter] ${toolName}: no data array found, skipping transformation`);
      }
      return result;
    }

    try {
      // Create serializer and format
      const serializer = new CompactSerializer(entityType);
      const formatted = serializer.serializeWithFormat(dataArray, format);

      if (debug) {
        console.log(
          `[ResponseFormatter] ${toolName}: ${format} format applied, ` +
          `${dataArray.length} records, ~${formatted.estimatedTokens} tokens`
        );
      }

      // Preserve metadata from original response
      const metadata: Record<string, unknown> = {};
      if (parsedResult && typeof parsedResult === 'object') {
        const obj = parsedResult as Record<string, unknown>;
        // Copy non-data fields
        for (const key of ['success', 'pagination', 'total', 'message', 'usage_guidance']) {
          if (key in obj) {
            metadata[key] = obj[key];
          }
        }
      }

      // Build formatted response
      const formattedText = formatted.text +
        (Object.keys(metadata).length > 0 ? `\n\n---\n${JSON.stringify(metadata)}` : '');

      // Return in MCP content format
      return {
        content: [{
          type: 'text',
          text: formattedText,
        }],
      };
    } catch (error) {
      // Fall back to original on error
      if (debug) {
        console.error(`[ResponseFormatter] Error formatting ${toolName}:`, error);
      }
      return result;
    }
  }

  return {
    transformResponse,
    detectEntityType,
  };
}

/**
 * Default response formatter with standard configuration.
 */
export const defaultResponseFormatter = createResponseFormatterHook({
  defaultFormat: 'concise',
  debug: process.env.DEBUG === 'true',
});
