import { z } from 'zod';

/**
 * Input schemas for Confluence MCP Server tools.
 *
 * All schemas use .passthrough() to allow Extensions to add
 * additional parameters (like responseFormat) without modifying these schemas.
 */

// =====================
// Common Input Schemas
// =====================

export const paginationInputSchema = z.object({
  limit: z.number().min(1).max(250).optional()
    .describe('Maximum results to return (default: 25, max: 250)'),
  cursor: z.string().max(2048).optional()
    .describe('Cursor for pagination (from previous response)'),
}).passthrough();

export const fieldsInputSchema = z.object({
  fields: z.enum(['summary', 'full']).optional()
    .describe('Response detail level: "summary" for key fields only, "full" for all fields'),
}).passthrough();

// =====================
// Pages Input Schemas
// =====================

export const searchPagesInputSchema = z.object({
  spaceId: z.string().max(255).optional()
    .describe('Filter by space ID'),
  title: z.string().max(255).optional()
    .describe('Filter by page title (partial match)'),
  status: z.enum(['current', 'trashed', 'deleted', 'draft']).optional()
    .describe('Filter by page status (default: current)'),
  sort: z.enum(['id', '-id', 'title', '-title', 'created-date', '-created-date', 'modified-date', '-modified-date']).optional()
    .describe('Sort order for results'),
  limit: z.number().min(1).max(250).optional()
    .describe('Maximum results to return (default: 25, max: 250)'),
  cursor: z.string().max(2048).optional()
    .describe('Cursor for pagination (from previous response)'),
  fields: z.enum(['summary', 'full']).optional()
    .describe('Response detail level: "summary" for key fields only, "full" for all fields'),
}).passthrough();

export const getPageInputSchema = z.object({
  pageId: z.string().min(1).max(255)
    .describe('The page ID to retrieve'),
  bodyFormat: z.enum(['storage', 'atlas_doc_format', 'view', 'export_view']).optional()
    .describe('Format to return the body content in'),
  getDraft: z.boolean().optional()
    .describe('Whether to return the draft version if one exists'),
}).passthrough();

export const createPageInputSchema = z.object({
  spaceId: z.string().min(1).max(255)
    .describe('The space ID to create the page in. Use "search_spaces" first to find valid space IDs'),
  title: z.string().min(1).max(255)
    .describe('The page title (required, max 255 characters)'),
  body: z.string().max(5000000)
    .describe('Page content in storage format (XHTML) or wiki markup'),
  parentId: z.string().max(255).optional()
    .describe('Parent page ID to create as child page. Use "search_pages" to find valid parent IDs'),
  status: z.enum(['current', 'draft']).optional()
    .describe('Page status: "current" (published) or "draft"'),
  representation: z.enum(['storage', 'atlas_doc_format', 'wiki']).optional()
    .describe('Body content format (default: storage)'),
}).passthrough();

export const updatePageInputSchema = z.object({
  pageId: z.string().min(1).max(255)
    .describe('The page ID to update'),
  title: z.string().min(1).max(255).optional()
    .describe('New page title'),
  body: z.string().max(5000000).optional()
    .describe('New page content'),
  version: z.number().min(1)
    .describe('Current version number (required to prevent conflicts). Get from get_page response'),
  status: z.enum(['current', 'draft']).optional()
    .describe('New page status'),
  representation: z.enum(['storage', 'atlas_doc_format']).optional()
    .describe('Body content format'),
}).passthrough();

export const deletePageInputSchema = z.object({
  pageId: z.string().min(1).max(255)
    .describe('The page ID to delete. WARNING: This is permanent!'),
  purge: z.boolean().optional()
    .describe('If true, permanently deletes. If false, moves to trash (default: false)'),
}).passthrough();

export const getPageVersionsInputSchema = z.object({
  pageId: z.string().min(1).max(255)
    .describe('The page ID to get versions for'),
  limit: z.number().min(1).max(250).optional()
    .describe('Maximum results to return (default: 25, max: 250)'),
  cursor: z.string().max(2048).optional()
    .describe('Cursor for pagination (from previous response)'),
}).passthrough();

export const getPageVersionInputSchema = z.object({
  pageId: z.string().min(1).max(255)
    .describe('The page ID'),
  versionNumber: z.number().min(1)
    .describe('The version number to retrieve'),
  bodyFormat: z.enum(['storage', 'atlas_doc_format', 'view']).optional()
    .describe('Format to return the body content in'),
}).passthrough();

export const getPageChildrenInputSchema = z.object({
  pageId: z.string().min(1).max(255)
    .describe('The parent page ID'),
  limit: z.number().min(1).max(250).optional()
    .describe('Maximum results to return (default: 25, max: 250)'),
  cursor: z.string().max(2048).optional()
    .describe('Cursor for pagination (from previous response)'),
  fields: z.enum(['summary', 'full']).optional()
    .describe('Response detail level: "summary" for key fields only, "full" for all fields'),
}).passthrough();

export const getPageAncestorsInputSchema = z.object({
  pageId: z.string().min(1).max(255)
    .describe('The page ID to get ancestors for'),
  fields: z.enum(['summary', 'full']).optional()
    .describe('Response detail level: "summary" for key fields only, "full" for all fields'),
}).passthrough();

export const movePageInputSchema = z.object({
  pageId: z.string().min(1).max(255)
    .describe('The page ID to move'),
  targetId: z.string().min(1).max(255)
    .describe('Target parent page ID'),
  position: z.enum(['append', 'prepend', 'before', 'after']).optional()
    .describe('Position relative to target'),
}).passthrough();

export const copyPageInputSchema = z.object({
  pageId: z.string().min(1).max(255)
    .describe('The page ID to copy'),
  destinationSpaceId: z.string().max(255).optional()
    .describe('Target space ID (default: same space)'),
  destinationParentId: z.string().max(255).optional()
    .describe('Target parent page ID'),
  title: z.string().max(255).optional()
    .describe('New title for the copy'),
  copyAttachments: z.boolean().optional()
    .describe('Whether to copy attachments (default: true)'),
  copyLabels: z.boolean().optional()
    .describe('Whether to copy labels (default: true)'),
}).passthrough();

export const getPageRestrictionsInputSchema = z.object({
  pageId: z.string().min(1).max(255)
    .describe('The page ID to get restrictions for'),
}).passthrough();

export const setPageRestrictionsInputSchema = z.object({
  pageId: z.string().min(1).max(255)
    .describe('The page ID to set restrictions for'),
  operation: z.enum(['read', 'update'])
    .describe('Which operation to restrict: read or update. The other operation is always preserved.'),
  mode: z.enum(['add', 'remove', 'replace'])
    .describe('REQUIRED. add = grant to the listed principals, keeping existing grants. remove = revoke only the listed principals. replace = make the listed principals the complete set for this operation, dropping any others. Restrictions on the OTHER operation are preserved in all three modes.'),
  users: z.array(z.string().max(255)).optional()
    .describe('User account IDs'),
  groups: z.array(z.string().max(255)).optional()
    .describe('Group names'),
}).passthrough();

export const getPageLikesInputSchema = z.object({
  pageId: z.string().min(1).max(255)
    .describe('The page ID to get likes for'),
  limit: z.number().min(1).max(250).optional()
    .describe('Maximum results to return (default: 25, max: 250)'),
  cursor: z.string().max(2048).optional()
    .describe('Cursor for pagination (from previous response)'),
}).passthrough();

// =====================
// Spaces Input Schemas
// =====================

export const searchSpacesInputSchema = z.object({
  keys: z.array(z.string().max(255)).optional()
    .describe('Filter by space keys'),
  type: z.enum(['global', 'personal']).optional()
    .describe('Filter by space type'),
  status: z.enum(['current', 'archived']).optional()
    .describe('Filter by space status'),
  labels: z.array(z.string().max(255)).optional()
    .describe('Filter by space labels'),
  sort: z.enum(['id', '-id', 'key', '-key', 'name', '-name']).optional()
    .describe('Sort order'),
  limit: z.number().min(1).max(250).optional()
    .describe('Maximum results to return (default: 25, max: 250)'),
  cursor: z.string().max(2048).optional()
    .describe('Cursor for pagination (from previous response)'),
  fields: z.enum(['summary', 'full']).optional()
    .describe('Response detail level: "summary" for key fields only, "full" for all fields'),
}).passthrough();

export const getSpaceInputSchema = z.object({
  spaceId: z.string().min(1).max(255)
    .describe('The space ID to retrieve'),
  descriptionFormat: z.enum(['plain', 'view']).optional()
    .describe('Format for space description'),
}).passthrough();

export const createSpaceInputSchema = z.object({
  key: z.string().min(1).max(255).regex(/^[A-Z][A-Z0-9]*$/)
    .describe('Space key (uppercase alphanumeric, starts with letter)'),
  name: z.string().min(1).max(255)
    .describe('Space display name'),
  description: z.string().max(32768).optional()
    .describe('Space description'),
  type: z.enum(['global', 'personal']).optional()
    .describe('Space type (default: global)'),
}).passthrough();

export const updateSpaceInputSchema = z.object({
  spaceId: z.string().min(1).max(255)
    .describe('The space ID to update'),
  name: z.string().min(1).max(255).optional()
    .describe('New space name'),
  description: z.string().max(32768).optional()
    .describe('New space description'),
  homepageId: z.string().max(255).optional()
    .describe('New homepage page ID'),
}).passthrough();

export const deleteSpaceInputSchema = z.object({
  spaceId: z.string().min(1).max(255)
    .describe('The space ID to delete. WARNING: This deletes all content!'),
}).passthrough();

export const archiveSpaceInputSchema = z.object({
  spaceId: z.string().min(1).max(255)
    .describe('The space ID to archive'),
}).passthrough();

export const restoreSpaceInputSchema = z.object({
  spaceId: z.string().min(1).max(255)
    .describe('The space ID to restore from archive'),
}).passthrough();

export const getSpaceContentInputSchema = z.object({
  spaceId: z.string().min(1).max(255)
    .describe('The space ID to get content for'),
  depth: z.enum(['all', 'root']).optional()
    .describe('Content depth: "all" for everything, "root" for top-level only'),
  limit: z.number().min(1).max(250).optional()
    .describe('Maximum results to return (default: 25, max: 250)'),
  cursor: z.string().max(2048).optional()
    .describe('Cursor for pagination (from previous response)'),
}).passthrough();

export const getSpaceSettingsInputSchema = z.object({
  spaceKey: z.string().min(1).max(255)
    .describe('The space key'),
}).passthrough();

export const updateSpaceSettingsInputSchema = z.object({
  spaceKey: z.string().min(1).max(255)
    .describe('The space key'),
  routeOverrideEnabled: z.boolean().optional()
    .describe('Enable custom URL routing'),
}).passthrough();

export const getSpaceThemeInputSchema = z.object({
  spaceKey: z.string().min(1).max(255)
    .describe('The space key'),
}).passthrough();

export const setSpaceThemeInputSchema = z.object({
  spaceKey: z.string().min(1).max(255)
    .describe('The space key'),
  themeKey: z.string().max(255)
    .describe('Theme key to apply'),
}).passthrough();

// =====================
// Space Permissions Input Schemas
// =====================

export const getSpacePermissionsInputSchema = z.object({
  spaceId: z.string().min(1).max(255)
    .describe('The space ID to get permissions for'),
  limit: z.number().min(1).max(250).optional()
    .describe('Maximum results to return (default: 25, max: 250)'),
  cursor: z.string().max(2048).optional()
    .describe('Cursor for pagination (from previous response)'),
}).passthrough();

export const addSpacePermissionInputSchema = z.object({
  spaceId: z.string().min(1).max(255)
    .describe('The space ID to add permission to'),
  principalType: z.enum(['user', 'group'])
    .describe('Type of principal'),
  principalId: z.string().min(1).max(255)
    .describe('User account ID or group name'),
  operation: z.string().min(1).max(255)
    .describe('Permission operation key (e.g., "read", "create", "delete")'),
  targetType: z.string().max(255).optional()
    .describe('Target type for the operation (e.g., "page", "blogpost")'),
}).passthrough();

export const removeSpacePermissionInputSchema = z.object({
  spaceId: z.string().min(1).max(255)
    .describe('The space ID'),
  permissionId: z.string().min(1).max(255)
    .describe('The permission ID to remove'),
}).passthrough();

export const getSpacePermissionUsersInputSchema = z.object({
  spaceKey: z.string().min(1).max(255)
    .describe('The space key'),
  permissionKey: z.string().min(1).max(255)
    .describe('The permission key to check'),
  limit: z.number().min(1).max(250).optional()
    .describe('Maximum results to return (default: 25, max: 250)'),
  cursor: z.string().max(2048).optional()
    .describe('Cursor for pagination (from previous response)'),
}).passthrough();

export const copySpacePermissionsInputSchema = z.object({
  sourceSpaceId: z.string().min(1).max(255)
    .describe('Source space ID to copy permissions from'),
  targetSpaceId: z.string().min(1).max(255)
    .describe('Target space ID to copy permissions to'),
}).passthrough();

export const getPermissionTypesInputSchema = z.object({}).passthrough();

export const checkContentPermissionInputSchema = z.object({
  contentId: z.string().min(1).max(255)
    .describe('The content ID to check permissions for'),
  operation: z.enum(['read', 'update', 'delete'])
    .describe('The operation to check'),
  accountId: z.string().max(255).regex(/^[a-zA-Z0-9:._\-]+$/).optional()
    .describe('Account ID to check (default: current user)'),
}).passthrough();

export const bulkUpdatePermissionsInputSchema = z.object({
  spaceId: z.string().min(1).max(255)
    .describe('The space ID'),
  permissions: z.array(z.object({
    principalType: z.enum(['user', 'group']),
    principalId: z.string().max(255),
    operation: z.string().max(255),
    targetType: z.string().max(255).optional(),
  }))
    .describe('Array of permissions to add'),
}).passthrough();

// =====================
// Comments Input Schemas
// =====================

export const getPageCommentsInputSchema = z.object({
  pageId: z.string().min(1).max(255)
    .describe('The page ID to get comments for'),
  bodyFormat: z.enum(['storage', 'atlas_doc_format', 'view']).optional()
    .describe('Format for comment body'),
  limit: z.number().min(1).max(250).optional()
    .describe('Maximum results to return (default: 25, max: 250)'),
  cursor: z.string().max(2048).optional()
    .describe('Cursor for pagination (from previous response)'),
}).passthrough();

export const getFooterCommentsInputSchema = z.object({
  pageId: z.string().min(1).max(255)
    .describe('The page ID'),
  bodyFormat: z.enum(['storage', 'atlas_doc_format', 'view']).optional()
    .describe('Format for comment body'),
  limit: z.number().min(1).max(250).optional()
    .describe('Maximum results to return (default: 25, max: 250)'),
  cursor: z.string().max(2048).optional()
    .describe('Cursor for pagination (from previous response)'),
}).passthrough();

export const getInlineCommentsInputSchema = z.object({
  pageId: z.string().min(1).max(255)
    .describe('The page ID'),
  bodyFormat: z.enum(['storage', 'atlas_doc_format', 'view']).optional()
    .describe('Format for comment body'),
  limit: z.number().min(1).max(250).optional()
    .describe('Maximum results to return (default: 25, max: 250)'),
  cursor: z.string().max(2048).optional()
    .describe('Cursor for pagination (from previous response)'),
}).passthrough();

export const addFooterCommentInputSchema = z.object({
  pageId: z.string().min(1).max(255)
    .describe('The page ID to add comment to'),
  body: z.string().min(1).max(5000000)
    .describe('Comment content'),
  representation: z.enum(['storage', 'atlas_doc_format']).optional()
    .describe('Body format (default: storage)'),
}).passthrough();

export const addInlineCommentInputSchema = z.object({
  pageId: z.string().min(1).max(255)
    .describe('The page ID to add inline comment to'),
  body: z.string().min(1).max(5000000)
    .describe('Comment content'),
  textSelection: z.string().min(1).max(1000)
    .describe('The text to attach the comment to'),
  textSelectionMatchCount: z.number().optional()
    .describe('Number of times the selection appears on page'),
  textSelectionMatchIndex: z.number().optional()
    .describe('Which occurrence to attach to (0-indexed)'),
  representation: z.enum(['storage', 'atlas_doc_format']).optional()
    .describe('Body format (default: storage)'),
}).passthrough();

export const updateCommentInputSchema = z.object({
  commentId: z.string().min(1).max(255)
    .describe('The comment ID to update'),
  body: z.string().min(1).max(5000000)
    .describe('New comment content'),
  version: z.number().min(1)
    .describe('Current version number'),
  representation: z.enum(['storage', 'atlas_doc_format']).optional()
    .describe('Body format'),
}).passthrough();

export const deleteCommentInputSchema = z.object({
  commentId: z.string().min(1).max(255)
    .describe('The comment ID to delete'),
}).passthrough();

export const getCommentChildrenInputSchema = z.object({
  commentId: z.string().min(1).max(255)
    .describe('The parent comment ID'),
  bodyFormat: z.enum(['storage', 'atlas_doc_format', 'view']).optional()
    .describe('Format for reply body'),
  limit: z.number().min(1).max(250).optional()
    .describe('Maximum results to return (default: 25, max: 250)'),
  cursor: z.string().max(2048).optional()
    .describe('Cursor for pagination (from previous response)'),
}).passthrough();

// =====================
// Attachments Input Schemas
// =====================

export const getAttachmentsInputSchema = z.object({
  pageId: z.string().min(1).max(255)
    .describe('The page ID to get attachments for'),
  mediaType: z.string().max(255).optional()
    .describe('Filter by media type (e.g., "image/png")'),
  filename: z.string().max(255).optional()
    .describe('Filter by filename (partial match)'),
  limit: z.number().min(1).max(250).optional()
    .describe('Maximum results to return (default: 25, max: 250)'),
  cursor: z.string().max(2048).optional()
    .describe('Cursor for pagination (from previous response)'),
}).passthrough();

export const getAttachmentInputSchema = z.object({
  attachmentId: z.string().min(1).max(255)
    .describe('The attachment ID'),
}).passthrough();

export const uploadAttachmentInputSchema = z.object({
  pageId: z.string().min(1).max(255)
    .describe('The page ID to attach file to'),
  filename: z.string().min(1).max(255)
    .describe('Name for the file'),
  content: z.string().max(5000000)
    .describe('Base64-encoded file content'),
  mediaType: z.string().max(255).optional()
    .describe('MIME type (will be auto-detected if not provided)'),
  comment: z.string().max(32768).optional()
    .describe('Comment/description for the attachment'),
}).passthrough();

export const updateAttachmentInputSchema = z.object({
  attachmentId: z.string().min(1).max(255)
    .describe('The attachment ID to update'),
  content: z.string().max(5000000)
    .describe('New base64-encoded file content'),
  comment: z.string().max(32768).optional()
    .describe('Comment for this version'),
}).passthrough();

export const deleteAttachmentInputSchema = z.object({
  attachmentId: z.string().min(1).max(255)
    .describe('The attachment ID to delete'),
  purge: z.boolean().optional()
    .describe('If true, permanently deletes (default: false)'),
}).passthrough();

export const downloadAttachmentInputSchema = z.object({
  attachmentId: z.string().min(1).max(255)
    .describe('The attachment ID to download'),
}).passthrough();

export const getAttachmentVersionsInputSchema = z.object({
  attachmentId: z.string().min(1).max(255)
    .describe('The attachment ID'),
  limit: z.number().min(1).max(250).optional()
    .describe('Maximum results to return (default: 25, max: 250)'),
  cursor: z.string().max(2048).optional()
    .describe('Cursor for pagination (from previous response)'),
}).passthrough();

export const copyAttachmentInputSchema = z.object({
  attachmentId: z.string().min(1).max(255)
    .describe('The attachment ID to copy'),
  destinationPageId: z.string().min(1).max(255)
    .describe('Target page ID'),
}).passthrough();

// =====================
// Templates Input Schemas
// =====================

export const getTemplatesInputSchema = z.object({
  spaceKey: z.string().max(255).optional()
    .describe('Filter by space key (omit for global templates)'),
  limit: z.number().min(1).max(250).optional()
    .describe('Maximum results to return (default: 25, max: 250)'),
  cursor: z.string().max(2048).optional()
    .describe('Cursor for pagination (from previous response)'),
}).passthrough();

export const getTemplateInputSchema = z.object({
  templateId: z.string().min(1).max(255)
    .describe('The template ID'),
}).passthrough();

export const createTemplateInputSchema = z.object({
  name: z.string().min(1).max(255)
    .describe('Template name'),
  templateType: z.enum(['page', 'blogpost'])
    .describe('Type of content this template creates'),
  body: z.string().max(5000000)
    .describe('Template body in storage format'),
  description: z.string().max(32768).optional()
    .describe('Template description'),
  spaceKey: z.string().max(255).optional()
    .describe('Space key for space template (omit for global)'),
  labels: z.array(z.string().max(255)).optional()
    .describe('Labels to apply to template'),
}).passthrough();

export const updateTemplateInputSchema = z.object({
  templateId: z.string().min(1).max(255)
    .describe('The template ID to update'),
  name: z.string().max(255).optional()
    .describe('New template name'),
  body: z.string().max(5000000).optional()
    .describe('New template body'),
  description: z.string().max(32768).optional()
    .describe('New description'),
}).passthrough();

export const deleteTemplateInputSchema = z.object({
  templateId: z.string().min(1).max(255)
    .describe('The template ID to delete'),
}).passthrough();

// =====================
// Labels Input Schemas
// =====================

export const getLabelsInputSchema = z.object({
  contentId: z.string().min(1).max(255)
    .describe('The content ID to get labels for'),
  prefix: z.enum(['global', 'my', 'team']).optional()
    .describe('Filter by label prefix'),
  limit: z.number().min(1).max(250).optional()
    .describe('Maximum results to return (default: 25, max: 250)'),
  cursor: z.string().max(2048).optional()
    .describe('Cursor for pagination (from previous response)'),
}).passthrough();

export const addLabelsInputSchema = z.object({
  contentId: z.string().min(1).max(255)
    .describe('The content ID to add labels to'),
  labels: z.array(z.object({
    name: z.string().min(1).max(255),
    prefix: z.enum(['global', 'my', 'team']).optional(),
  }))
    .describe('Labels to add'),
}).passthrough();

export const removeLabelInputSchema = z.object({
  contentId: z.string().min(1).max(255)
    .describe('The content ID'),
  labelName: z.string().min(1).max(255)
    .describe('Label name to remove'),
}).passthrough();

export const getSpaceLabelsInputSchema = z.object({
  spaceId: z.string().min(1).max(255)
    .describe('The space ID'),
  prefix: z.enum(['global', 'my', 'team']).optional()
    .describe('Filter by label prefix'),
  limit: z.number().min(1).max(250).optional()
    .describe('Maximum results to return (default: 25, max: 250)'),
  cursor: z.string().max(2048).optional()
    .describe('Cursor for pagination (from previous response)'),
}).passthrough();

export const addSpaceLabelInputSchema = z.object({
  spaceId: z.string().min(1).max(255)
    .describe('The space ID'),
  labels: z.array(z.object({
    name: z.string().min(1).max(255),
    prefix: z.enum(['global', 'my', 'team']).optional(),
  }))
    .describe('Labels to add'),
}).passthrough();

export const removeSpaceLabelInputSchema = z.object({
  spaceId: z.string().min(1).max(255)
    .describe('The space ID'),
  labelName: z.string().min(1).max(255)
    .describe('Label name to remove'),
}).passthrough();

// =====================
// Search Input Schemas
// =====================

export const searchCqlInputSchema = z.object({
  cql: z.string().min(1).max(10000)
    .describe('CQL query (e.g., "type=page AND space=DEV")'),
  cqlcontext: z.string().max(2048).optional()
    .describe('CQL context for the search'),
  excerpt: z.enum(['highlight', 'indexed', 'none']).optional()
    .describe('Excerpt style in results'),
  expand: z.string().max(1000).optional()
    .describe('Comma-separated fields to expand'),
  limit: z.number().min(1).max(250).optional()
    .describe('Maximum results to return (default: 25, max: 250)'),
  cursor: z.string().max(2048).optional()
    .describe('Cursor for pagination (from previous response)'),
}).passthrough();

export const searchContentInputSchema = z.object({
  query: z.string().min(1).max(10000)
    .describe('Search query text'),
  spaceKey: z.string().max(255).optional()
    .describe('Filter to specific space'),
  type: z.enum(['page', 'blogpost', 'attachment', 'comment']).optional()
    .describe('Content type filter'),
  limit: z.number().min(1).max(250).optional()
    .describe('Maximum results to return (default: 25, max: 250)'),
  cursor: z.string().max(2048).optional()
    .describe('Cursor for pagination (from previous response)'),
}).passthrough();

// =====================
// Blogs Input Schemas
// =====================

export const getBlogPostsInputSchema = z.object({
  spaceId: z.string().max(255).optional()
    .describe('Filter by space ID'),
  status: z.enum(['current', 'trashed', 'deleted', 'draft']).optional()
    .describe('Filter by status'),
  sort: z.enum(['id', '-id', 'title', '-title', 'created-date', '-created-date']).optional()
    .describe('Sort order'),
  limit: z.number().min(1).max(250).optional()
    .describe('Maximum results to return (default: 25, max: 250)'),
  cursor: z.string().max(2048).optional()
    .describe('Cursor for pagination (from previous response)'),
  fields: z.enum(['summary', 'full']).optional()
    .describe('Response detail level: "summary" for key fields only, "full" for all fields'),
}).passthrough();

export const getBlogPostInputSchema = z.object({
  blogPostId: z.string().min(1).max(255)
    .describe('The blog post ID'),
  bodyFormat: z.enum(['storage', 'atlas_doc_format', 'view']).optional()
    .describe('Format for body content'),
}).passthrough();

export const createBlogPostInputSchema = z.object({
  spaceId: z.string().min(1).max(255)
    .describe('The space ID to create blog in'),
  title: z.string().min(1).max(255)
    .describe('Blog post title'),
  body: z.string().max(5000000)
    .describe('Blog content'),
  status: z.enum(['current', 'draft']).optional()
    .describe('Blog status (default: current)'),
  representation: z.enum(['storage', 'atlas_doc_format']).optional()
    .describe('Body format'),
}).passthrough();

export const updateBlogPostInputSchema = z.object({
  blogPostId: z.string().min(1).max(255)
    .describe('The blog post ID to update'),
  title: z.string().max(255).optional()
    .describe('New title'),
  body: z.string().max(5000000).optional()
    .describe('New content'),
  version: z.number().min(1)
    .describe('Current version number'),
  status: z.enum(['current', 'draft']).optional()
    .describe('New status'),
  representation: z.enum(['storage', 'atlas_doc_format']).optional()
    .describe('Body format'),
}).passthrough();

export const deleteBlogPostInputSchema = z.object({
  blogPostId: z.string().min(1).max(255)
    .describe('The blog post ID to delete'),
  purge: z.boolean().optional()
    .describe('Permanently delete (default: false)'),
}).passthrough();

// =====================
// Analytics Input Schemas
// =====================

export const getPageAnalyticsInputSchema = z.object({
  pageId: z.string().min(1).max(255)
    .describe('The page ID to get analytics for'),
  fromDate: z.string().max(64).optional()
    .describe('Start date (ISO format)'),
  toDate: z.string().max(64).optional()
    .describe('End date (ISO format)'),
}).passthrough();

export const getSpaceAnalyticsInputSchema = z.object({
  spaceId: z.string().min(1).max(255)
    .describe('The space ID'),
  fromDate: z.string().max(64).optional()
    .describe('Start date'),
  toDate: z.string().max(64).optional()
    .describe('End date'),
}).passthrough();

export const getTopViewedPagesInputSchema = z.object({
  spaceId: z.string().max(255).optional()
    .describe('Filter by space ID'),
  fromDate: z.string().max(64).optional()
    .describe('Start date'),
  toDate: z.string().max(64).optional()
    .describe('End date'),
  limit: z.number().min(1).max(250).optional()
    .describe('Maximum results to return (default: 25, max: 250)'),
  cursor: z.string().max(2048).optional()
    .describe('Cursor for pagination (from previous response)'),
}).passthrough();

// =====================
// Content Properties Input Schemas
// =====================

export const getContentPropertiesInputSchema = z.object({
  contentId: z.string().min(1).max(255)
    .describe('The content ID'),
  limit: z.number().min(1).max(250).optional()
    .describe('Maximum results to return (default: 25, max: 250)'),
  cursor: z.string().max(2048).optional()
    .describe('Cursor for pagination (from previous response)'),
}).passthrough();

export const getContentPropertyInputSchema = z.object({
  contentId: z.string().min(1).max(255)
    .describe('The content ID'),
  propertyKey: z.string().min(1).max(255)
    .describe('The property key'),
}).passthrough();

export const createContentPropertyInputSchema = z.object({
  contentId: z.string().min(1).max(255)
    .describe('The content ID'),
  key: z.string().min(1).max(255)
    .describe('Property key'),
  value: z.unknown()
    .describe('Property value (JSON)'),
}).passthrough();

export const updateContentPropertyInputSchema = z.object({
  contentId: z.string().min(1).max(255)
    .describe('The content ID'),
  propertyKey: z.string().min(1).max(255)
    .describe('The property key'),
  value: z.unknown()
    .describe('New property value'),
  version: z.number().min(1)
    .describe('Current version number'),
}).passthrough();

export const deleteContentPropertyInputSchema = z.object({
  contentId: z.string().min(1).max(255)
    .describe('The content ID'),
  propertyKey: z.string().min(1).max(255)
    .describe('The property key to delete'),
}).passthrough();

// =====================
// Watchers Input Schemas
// =====================

export const getContentWatchersInputSchema = z.object({
  contentId: z.string().min(1).max(255)
    .describe('The content ID'),
  limit: z.number().min(1).max(250).optional()
    .describe('Maximum results to return (default: 25, max: 250)'),
  cursor: z.string().max(2048).optional()
    .describe('Cursor for pagination (from previous response)'),
}).passthrough();

export const addContentWatchInputSchema = z.object({
  contentId: z.string().min(1).max(255)
    .describe('The content ID to watch'),
}).passthrough();

export const removeContentWatchInputSchema = z.object({
  contentId: z.string().min(1).max(255)
    .describe('The content ID to unwatch'),
}).passthrough();

export const getSpaceWatchersInputSchema = z.object({
  spaceId: z.string().min(1).max(255)
    .describe('The space ID'),
  limit: z.number().min(1).max(250).optional()
    .describe('Maximum results to return (default: 25, max: 250)'),
  cursor: z.string().max(2048).optional()
    .describe('Cursor for pagination (from previous response)'),
}).passthrough();

// =====================
// Admin Input Schemas
// =====================

export const searchToolsInputSchema = z.object({
  category: z.enum(['pages', 'spaces', 'permissions', 'comments', 'attachments', 'templates', 'labels', 'search', 'blogs', 'analytics', 'properties', 'watchers', 'admin', 'all']).optional()
    .describe('Filter by tool category'),
  type: z.enum(['discovery', 'read', 'create', 'update', 'delete', 'all']).optional()
    .describe('Filter by operation type'),
  query: z.string().max(10000).optional()
    .describe('Search tool names and descriptions'),
}).passthrough();

export const getAuditRecordsInputSchema = z.object({
  startDate: z.string().max(64).optional()
    .describe('Start date (ISO format)'),
  endDate: z.string().max(64).optional()
    .describe('End date (ISO format)'),
  searchString: z.string().max(10000).optional()
    .describe('Search in audit records'),
  limit: z.number().min(1).max(250).optional()
    .describe('Maximum results to return (default: 25, max: 250)'),
  cursor: z.string().max(2048).optional()
    .describe('Cursor for pagination (from previous response)'),
}).passthrough();

export const exportAuditRecordsInputSchema = z.object({
  startDate: z.string().max(64)
    .describe('Start date (ISO format)'),
  endDate: z.string().max(64)
    .describe('End date (ISO format)'),
  format: z.enum(['csv', 'json']).optional()
    .describe('Export format (default: csv)'),
}).passthrough();

export const getSystemInfoInputSchema = z.object({}).passthrough();

export const getGlobalSettingsInputSchema = z.object({}).passthrough();

export const getContentStatesInputSchema = z.object({
  spaceKey: z.string().max(255).optional()
    .describe('Filter by space key'),
}).passthrough();

export const setContentStateInputSchema = z.object({
  contentId: z.string().min(1).max(255)
    .describe('The content ID'),
  stateId: z.string().min(1).max(255)
    .describe('The state ID to set'),
}).passthrough();

export const getDataPoliciesInputSchema = z.object({}).passthrough();
