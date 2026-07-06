import { z } from 'zod';

// =====================
// Common Validation Schemas
// =====================

export const paginationSchema = z.object({
  limit: z.number().min(1).max(250).optional().default(25),
  cursor: z.string().max(2048).optional(),
}).strict();

export const fieldsSchema = z.object({
  fields: z.enum(['summary', 'full']).optional().default('summary'),
}).strict();

// =====================
// Pages Validation Schemas
// =====================

export const searchPagesSchema = paginationSchema.merge(fieldsSchema).extend({
  spaceId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').optional(),
  title: z.string().max(255).optional(),
  status: z.enum(['current', 'trashed', 'deleted', 'draft']).optional(),
  sort: z.enum(['id', '-id', 'title', '-title', 'created-date', '-created-date', 'modified-date', '-modified-date']).optional(),
}).strict();

export const getPageSchema = z.object({
  pageId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
  bodyFormat: z.enum(['storage', 'atlas_doc_format', 'view', 'export_view']).optional(),
  getDraft: z.boolean().optional(),
}).strict();

export const createPageSchema = z.object({
  spaceId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
  title: z.string().min(1).max(255),
  body: z.string().max(5000000),
  parentId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').optional(),
  status: z.enum(['current', 'draft']).optional().default('current'),
  representation: z.enum(['storage', 'atlas_doc_format', 'wiki']).optional().default('storage'),
}).strict();

export const updatePageSchema = z.object({
  pageId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
  title: z.string().min(1).max(255).optional(),
  body: z.string().max(5000000).optional(),
  version: z.number().min(1),
  status: z.enum(['current', 'draft']).optional(),
  representation: z.enum(['storage', 'atlas_doc_format']).optional().default('storage'),
}).strict();

export const deletePageSchema = z.object({
  pageId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
  purge: z.boolean().optional().default(false),
}).strict();

export const getPageVersionsSchema = paginationSchema.extend({
  pageId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
}).strict();

export const getPageVersionSchema = z.object({
  pageId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
  versionNumber: z.number().min(1),
  bodyFormat: z.enum(['storage', 'atlas_doc_format', 'view']).optional(),
}).strict();

export const getPageChildrenSchema = paginationSchema.merge(fieldsSchema).extend({
  pageId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
}).strict();

export const getPageAncestorsSchema = fieldsSchema.extend({
  pageId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
}).strict();

export const movePageSchema = z.object({
  pageId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
  targetId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
  position: z.enum(['append', 'prepend', 'before', 'after']).optional().default('append'),
}).strict();

export const copyPageSchema = z.object({
  pageId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
  destinationSpaceId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').optional(),
  destinationParentId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').optional(),
  title: z.string().max(255).optional(),
  copyAttachments: z.boolean().optional().default(true),
  copyLabels: z.boolean().optional().default(true),
}).strict();

export const getPageRestrictionsSchema = z.object({
  pageId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
}).strict();

export const setPageRestrictionsSchema = z.object({
  pageId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
  operation: z.enum(['read', 'update']),
  users: z.array(z.string().max(255)).optional(),
  groups: z.array(z.string().max(255)).optional(),
}).strict();

export const getPageLikesSchema = paginationSchema.extend({
  pageId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
}).strict();

// =====================
// Spaces Validation Schemas
// =====================

export const searchSpacesSchema = paginationSchema.merge(fieldsSchema).extend({
  keys: z.array(z.string().max(255)).optional(),
  type: z.enum(['global', 'personal']).optional(),
  status: z.enum(['current', 'archived']).optional(),
  labels: z.array(z.string().max(255)).optional(),
  sort: z.enum(['id', '-id', 'key', '-key', 'name', '-name']).optional(),
}).strict();

export const getSpaceSchema = z.object({
  spaceId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
  descriptionFormat: z.enum(['plain', 'view']).optional(),
}).strict();

export const createSpaceSchema = z.object({
  key: z.string().min(1).max(255).regex(/^[A-Z][A-Z0-9]*$/),
  name: z.string().min(1).max(255),
  description: z.string().max(32768).optional(),
  type: z.enum(['global', 'personal']).optional().default('global'),
}).strict();

export const updateSpaceSchema = z.object({
  spaceId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(32768).optional(),
  homepageId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').optional(),
}).strict();

export const deleteSpaceSchema = z.object({
  spaceId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
}).strict();

export const archiveSpaceSchema = z.object({
  spaceId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
}).strict();

export const restoreSpaceSchema = z.object({
  spaceId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
}).strict();

export const getSpaceContentSchema = paginationSchema.extend({
  spaceId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
  depth: z.enum(['all', 'root']).optional().default('all'),
}).strict();

export const getSpaceSettingsSchema = z.object({
  spaceKey: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid key'),
}).strict();

export const updateSpaceSettingsSchema = z.object({
  spaceKey: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid key'),
  routeOverrideEnabled: z.boolean().optional(),
}).strict();

export const getSpaceThemeSchema = z.object({
  spaceKey: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid key'),
}).strict();

export const setSpaceThemeSchema = z.object({
  spaceKey: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid key'),
  themeKey: z.string().max(255),
}).strict();

// =====================
// Space Permissions Validation Schemas
// =====================

export const getSpacePermissionsSchema = paginationSchema.extend({
  spaceId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
}).strict();

export const addSpacePermissionSchema = z.object({
  spaceId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
  principalType: z.enum(['user', 'group']),
  principalId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
  operation: z.string().min(1).max(255),
  targetType: z.string().max(255).optional(),
}).strict();

export const removeSpacePermissionSchema = z.object({
  spaceId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
  permissionId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
}).strict();

export const getSpacePermissionUsersSchema = paginationSchema.extend({
  spaceKey: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid key'),
  permissionKey: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid key'),
}).strict();

export const copySpacePermissionsSchema = z.object({
  sourceSpaceId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
  targetSpaceId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
}).strict();

export const checkContentPermissionSchema = z.object({
  contentId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
  operation: z.enum(['read', 'update', 'delete']),
  accountId: z.string().max(255).regex(/^[a-zA-Z0-9:._\-]+$/, 'invalid accountId').optional(),
}).strict();

export const bulkUpdatePermissionsSchema = z.object({
  spaceId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
  permissions: z.array(z.object({
    principalType: z.enum(['user', 'group']),
    principalId: z.string().max(255),
    operation: z.string().max(255),
    targetType: z.string().max(255).optional(),
  }).strict()),
}).strict();

// =====================
// Comments Validation Schemas
// =====================

export const getPageCommentsSchema = paginationSchema.extend({
  pageId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
  bodyFormat: z.enum(['storage', 'atlas_doc_format', 'view']).optional(),
}).strict();

export const getFooterCommentsSchema = paginationSchema.extend({
  pageId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
  bodyFormat: z.enum(['storage', 'atlas_doc_format', 'view']).optional(),
}).strict();

export const getInlineCommentsSchema = paginationSchema.extend({
  pageId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
  bodyFormat: z.enum(['storage', 'atlas_doc_format', 'view']).optional(),
}).strict();

export const addFooterCommentSchema = z.object({
  pageId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
  body: z.string().min(1).max(5000000),
  representation: z.enum(['storage', 'atlas_doc_format']).optional().default('storage'),
}).strict();

export const addInlineCommentSchema = z.object({
  pageId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
  body: z.string().min(1).max(5000000),
  textSelection: z.string().min(1).max(1000),
  textSelectionMatchCount: z.number().optional(),
  textSelectionMatchIndex: z.number().optional(),
  representation: z.enum(['storage', 'atlas_doc_format']).optional().default('storage'),
}).strict();

export const updateCommentSchema = z.object({
  commentId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
  body: z.string().min(1).max(5000000),
  version: z.number().min(1),
  representation: z.enum(['storage', 'atlas_doc_format']).optional().default('storage'),
}).strict();

export const deleteCommentSchema = z.object({
  commentId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
}).strict();

export const getCommentChildrenSchema = paginationSchema.extend({
  commentId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
  bodyFormat: z.enum(['storage', 'atlas_doc_format', 'view']).optional(),
}).strict();

// =====================
// Attachments Validation Schemas
// =====================

export const getAttachmentsSchema = paginationSchema.extend({
  pageId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
  mediaType: z.string().max(255).optional(),
  filename: z.string().max(255).optional(),
}).strict();

export const getAttachmentSchema = z.object({
  attachmentId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
}).strict();

export const uploadAttachmentSchema = z.object({
  pageId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
  filename: z.string().min(1).max(255),
  content: z.string().max(5000000),
  mediaType: z.string().max(255).optional(),
  comment: z.string().max(32768).optional(),
}).strict();

export const updateAttachmentSchema = z.object({
  attachmentId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
  content: z.string().max(5000000),
  comment: z.string().max(32768).optional(),
}).strict();

export const deleteAttachmentSchema = z.object({
  attachmentId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
  purge: z.boolean().optional().default(false),
}).strict();

export const downloadAttachmentSchema = z.object({
  attachmentId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
}).strict();

export const getAttachmentVersionsSchema = paginationSchema.extend({
  attachmentId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
}).strict();

export const copyAttachmentSchema = z.object({
  attachmentId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
  destinationPageId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
}).strict();

// =====================
// Templates Validation Schemas
// =====================

export const getTemplatesSchema = paginationSchema.extend({
  spaceKey: z.string().max(255).optional(),
}).strict();

export const getTemplateSchema = z.object({
  templateId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
}).strict();

export const createTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  templateType: z.enum(['page', 'blogpost']),
  body: z.string().max(5000000),
  description: z.string().max(32768).optional(),
  spaceKey: z.string().max(255).optional(),
  labels: z.array(z.string().max(255)).optional(),
}).strict();

export const updateTemplateSchema = z.object({
  templateId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
  name: z.string().max(255).optional(),
  body: z.string().max(5000000).optional(),
  description: z.string().max(32768).optional(),
}).strict();

export const deleteTemplateSchema = z.object({
  templateId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
}).strict();

// =====================
// Labels Validation Schemas
// =====================

export const getLabelsSchema = paginationSchema.extend({
  contentId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
  prefix: z.enum(['global', 'my', 'team']).optional(),
}).strict();

export const addLabelsSchema = z.object({
  contentId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
  labels: z.array(z.object({
    name: z.string().min(1).max(255),
    prefix: z.enum(['global', 'my', 'team']).optional().default('global'),
  }).strict()),
}).strict();

export const removeLabelSchema = z.object({
  contentId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
  labelName: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid key'),
}).strict();

export const getSpaceLabelsSchema = paginationSchema.extend({
  spaceId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
  prefix: z.enum(['global', 'my', 'team']).optional(),
}).strict();

export const addSpaceLabelSchema = z.object({
  spaceId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
  labels: z.array(z.object({
    name: z.string().min(1).max(255),
    prefix: z.enum(['global', 'my', 'team']).optional().default('global'),
  }).strict()),
}).strict();

export const removeSpaceLabelSchema = z.object({
  spaceId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
  labelName: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid key'),
}).strict();

// =====================
// Search Validation Schemas
// =====================

export const searchCqlSchema = paginationSchema.extend({
  cql: z.string().min(1).max(10000),
  cqlcontext: z.string().max(2048).optional(),
  excerpt: z.enum(['highlight', 'indexed', 'none']).optional(),
  expand: z.string().max(1000).optional(),
}).strict();

export const searchContentSchema = paginationSchema.extend({
  query: z.string().min(1).max(10000),
  spaceKey: z.string().regex(/^[A-Za-z0-9_]{1,255}$/).optional(),
  type: z.enum(['page', 'blogpost', 'attachment', 'comment']).optional(),
}).strict();

// =====================
// Blogs Validation Schemas
// =====================

export const getBlogPostsSchema = paginationSchema.merge(fieldsSchema).extend({
  spaceId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').optional(),
  status: z.enum(['current', 'trashed', 'deleted', 'draft']).optional(),
  sort: z.enum(['id', '-id', 'title', '-title', 'created-date', '-created-date']).optional(),
}).strict();

export const getBlogPostSchema = z.object({
  blogPostId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
  bodyFormat: z.enum(['storage', 'atlas_doc_format', 'view']).optional(),
}).strict();

export const createBlogPostSchema = z.object({
  spaceId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
  title: z.string().min(1).max(255),
  body: z.string().max(5000000),
  status: z.enum(['current', 'draft']).optional().default('current'),
  representation: z.enum(['storage', 'atlas_doc_format']).optional().default('storage'),
}).strict();

export const updateBlogPostSchema = z.object({
  blogPostId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
  title: z.string().max(255).optional(),
  body: z.string().max(5000000).optional(),
  version: z.number().min(1),
  status: z.enum(['current', 'draft']).optional(),
  representation: z.enum(['storage', 'atlas_doc_format']).optional().default('storage'),
}).strict();

export const deleteBlogPostSchema = z.object({
  blogPostId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
  purge: z.boolean().optional().default(false),
}).strict();

// =====================
// Analytics Validation Schemas
// =====================

export const getPageAnalyticsSchema = z.object({
  pageId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
  fromDate: z.string().max(64).optional(),
  toDate: z.string().max(64).optional(),
}).strict();

export const getSpaceAnalyticsSchema = z.object({
  spaceId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
  fromDate: z.string().max(64).optional(),
  toDate: z.string().max(64).optional(),
}).strict();

export const getTopViewedPagesSchema = paginationSchema.extend({
  spaceId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').optional(),
  fromDate: z.string().max(64).optional(),
  toDate: z.string().max(64).optional(),
}).strict();

// =====================
// Content Properties Validation Schemas
// =====================

export const getContentPropertiesSchema = paginationSchema.extend({
  contentId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
}).strict();

export const getContentPropertySchema = z.object({
  contentId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
  propertyKey: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid key'),
}).strict();

export const createContentPropertySchema = z.object({
  contentId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
  key: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid key'),
  value: z.unknown(),
}).strict();

export const updateContentPropertySchema = z.object({
  contentId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
  propertyKey: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid key'),
  value: z.unknown(),
  version: z.number().min(1),
}).strict();

export const deleteContentPropertySchema = z.object({
  contentId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
  propertyKey: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid key'),
}).strict();

// =====================
// Watchers Validation Schemas
// =====================

export const getContentWatchersSchema = paginationSchema.extend({
  contentId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
}).strict();

export const addContentWatchSchema = z.object({
  contentId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
}).strict();

export const removeContentWatchSchema = z.object({
  contentId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
}).strict();

export const getSpaceWatchersSchema = paginationSchema.extend({
  spaceId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
}).strict();

// =====================
// Admin Validation Schemas
// =====================

export const searchToolsSchema = z.object({
  category: z.enum(['pages', 'spaces', 'permissions', 'comments', 'attachments', 'templates', 'labels', 'search', 'blogs', 'analytics', 'properties', 'watchers', 'admin', 'all']).optional(),
  type: z.enum(['discovery', 'read', 'create', 'update', 'delete', 'all']).optional(),
  query: z.string().max(10000).optional(),
}).strict();

export const getAuditRecordsSchema = paginationSchema.extend({
  startDate: z.string().max(64).optional(),
  endDate: z.string().max(64).optional(),
  searchString: z.string().max(10000).optional(),
}).strict();

export const exportAuditRecordsSchema = z.object({
  startDate: z.string().max(64),
  endDate: z.string().max(64),
  format: z.enum(['csv', 'json']).optional().default('csv'),
}).strict();

export const setContentStateSchema = z.object({
  contentId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
  stateId: z.string().min(1).max(255).regex(/^[\w.\-:]+$/, 'invalid id'),
}).strict();

export const getContentStatesSchema = z.object({
  spaceKey: z.string().max(255).optional(),
}).strict();

export const getSystemInfoSchema = z.object({}).strict();

export const getPermissionTypesSchema = z.object({}).strict();
