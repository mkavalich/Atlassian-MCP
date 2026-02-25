/**
 * Schema Transformer Hook
 *
 * NOTE: Schema transformation for adding extra parameters is now handled
 * differently. Base schemas use .passthrough() to allow extra parameters.
 * The optimizations package passes responseFormat directly, and it flows
 * through without being stripped.
 *
 * This file provides metadata about which tools support responseFormat and
 * is kept for documentation and potential future use.
 *
 * ## Why We Don't Inject Zod Schemas at Runtime
 *
 * The original approach of injecting Zod schemas failed because:
 * - Separate packages have separate Zod instances
 * - MCP SDK detects "Mixed Zod versions" and rejects the schema
 * - You cannot mix Zod schemas from different package instances
 *
 * ## The Elegant Solution: .passthrough()
 *
 * Base schemas use z.object({...}).passthrough() which:
 * - Allows extra parameters to pass through without being stripped
 * - Clean separation of concerns between base and optimization layers
 *
 * The response formatter hook checks for responseFormat in params
 * and applies the appropriate formatting (TOON, TSV, or detailed JSON).
 */

/**
 * Tools that support the responseFormat parameter.
 * These are typically list/search operations that return multiple items.
 *
 * When calling these tools, users can pass:
 * - responseFormat: 'concise' (default) - TOON format, minimal tokens
 * - responseFormat: 'standard' - TSV format, balanced
 * - responseFormat: 'detailed' - Full JSON, no transformation
 */
export const TOOLS_WITH_RESPONSE_FORMAT = new Set([
  // Jira Projects
  'search_projects',
  'search_jql',
  'get_comments',
  'get_dashboards',

  // Jira Workflows
  'get_workflows',
  'get_screens',
  'get_screen_schemes',
  'get_workflow_schemes',

  // Jira Fields & Permissions
  'get_fields',
  'get_fields_paginated',
  'get_permission_schemes',
  'get_permission_grants',
  'get_field_configurations',

  // Jira Organization
  'get_organization_users',
  'search_organization_users',
  'get_directory_users',
  'search_site_users',
  'get_organizations',
  'get_organization_policies',
  'get_organization_domains',
  'get_organization_workspaces',
  'get_organization_events',
  'get_identity_providers',

  // Jira System Admin
  'get_audit_records',
  'search_groups',
  'get_application_roles',
  'get_application_properties',
  'get_system_avatars',
  'export_project_data',
  'export_user_data',
  'generate_system_report',
  'generate_usage_analytics',
  'generate_health_check_report',

  // Jira Product Discovery
  'get_ideas',
  'search_ideas',
  'get_insights',
  'get_jpd_projects',

  // Confluence
  'search_spaces',
  'get_space_content',
  'search_pages',
  'get_page_versions',
  'get_page_children',
  'get_page_ancestors',
  'get_page_likes',
  'get_templates',
  'search_cql',
  'search_content',
  'get_page_comments',
  'get_footer_comments',
  'get_inline_comments',
  'get_attachments',
  'get_space_permissions',
  'get_blog_posts',
]);

/**
 * Check if a tool supports the responseFormat parameter.
 */
export function supportsResponseFormat(toolName: string): boolean {
  return TOOLS_WITH_RESPONSE_FORMAT.has(toolName);
}

/**
 * Configuration for schema transformer (kept for API compatibility).
 */
export interface SchemaTransformerConfig {
  /** Enable debug logging */
  debug?: boolean;
  /** Additional tools to add responseFormat to */
  additionalTools?: string[];
  /** Tools to exclude from responseFormat injection */
  excludeTools?: string[];
}

/** Type for registerTool function */
type RegisterToolFn = (name: string, config: any, handler: any) => void;

/**
 * Creates a schema transformer.
 *
 * NOTE: This no longer modifies schemas at runtime. Base schemas use
 * .passthrough() to allow extra parameters. This function is kept for
 * API compatibility and returns no-op functions.
 */
export function createSchemaTransformer(config: SchemaTransformerConfig = {}) {
  const { debug = false } = config;

  if (debug) {
    console.log('[SchemaTransformer] Schema transformation disabled - using passthrough() pattern');
  }

  return {
    shouldTransform: supportsResponseFormat,
    // No-op: schemas are already extensible via passthrough()
    transformToolConfig: (_toolName: string, config: unknown) => config,
    // No-op wrapper - returns the function unchanged
    wrapRegisterTool: (fn: RegisterToolFn): RegisterToolFn => fn,
    toolsToTransform: TOOLS_WITH_RESPONSE_FORMAT,
  };
}

/**
 * Default schema transformer instance.
 */
export const defaultSchemaTransformer = createSchemaTransformer({
  debug: process.env.DEBUG === 'true',
});
