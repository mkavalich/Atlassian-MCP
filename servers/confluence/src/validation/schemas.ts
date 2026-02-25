import { z } from 'zod';

// =====================
// Common Validation Schemas
// =====================

export const paginationSchema = z.object({
  limit: z.number().min(1).max(250).optional().default(25),
  cursor: z.string().optional(),
}).strict();

export const fieldsSchema = z.object({
  fields: z.enum(['summary', 'full']).optional().default('summary'),
}).strict();

// =====================
// Pages Validation Schemas
// =====================

export const searchPagesSchema = paginationSchema.merge(fieldsSchema).extend({
  spaceId: z.string().optional(),
  title: z.string().optional(),
  status: z.enum(['current', 'trashed', 'deleted', 'draft']).optional(),
  sort: z.enum(['id', '-id', 'title', '-title', 'created-date', '-created-date', 'modified-date', '-modified-date']).optional(),
}).strict();

export const getPageSchema = z.object({
  pageId: z.string().min(1),
  bodyFormat: z.enum(['storage', 'atlas_doc_format', 'view', 'export_view']).optional(),
  getDraft: z.boolean().optional(),
}).strict();

export const createPageSchema = z.object({
  spaceId: z.string().min(1),
  title: z.string().min(1).max(255),
  body: z.string(),
  parentId: z.string().optional(),
  status: z.enum(['current', 'draft']).optional().default('current'),
  representation: z.enum(['storage', 'atlas_doc_format', 'wiki']).optional().default('storage'),
}).strict();

export const updatePageSchema = z.object({
  pageId: z.string().min(1),
  title: z.string().min(1).max(255).optional(),
  body: z.string().optional(),
  version: z.number().min(1),
  status: z.enum(['current', 'draft']).optional(),
  representation: z.enum(['storage', 'atlas_doc_format']).optional().default('storage'),
}).strict();

export const deletePageSchema = z.object({
  pageId: z.string().min(1),
  purge: z.boolean().optional().default(false),
}).strict();

export const getPageVersionsSchema = paginationSchema.extend({
  pageId: z.string().min(1),
}).strict();

export const getPageVersionSchema = z.object({
  pageId: z.string().min(1),
  versionNumber: z.number().min(1),
  bodyFormat: z.enum(['storage', 'atlas_doc_format', 'view']).optional(),
}).strict();

export const getPageChildrenSchema = paginationSchema.merge(fieldsSchema).extend({
  pageId: z.string().min(1),
}).strict();

export const getPageAncestorsSchema = fieldsSchema.extend({
  pageId: z.string().min(1),
}).strict();

export const movePageSchema = z.object({
  pageId: z.string().min(1),
  targetId: z.string().min(1),
  position: z.enum(['append', 'prepend', 'before', 'after']).optional().default('append'),
}).strict();

export const copyPageSchema = z.object({
  pageId: z.string().min(1),
  destinationSpaceId: z.string().optional(),
  destinationParentId: z.string().optional(),
  title: z.string().optional(),
  copyAttachments: z.boolean().optional().default(true),
  copyLabels: z.boolean().optional().default(true),
}).strict();

export const getPageRestrictionsSchema = z.object({
  pageId: z.string().min(1),
}).strict();

export const setPageRestrictionsSchema = z.object({
  pageId: z.string().min(1),
  operation: z.enum(['read', 'update']),
  users: z.array(z.string()).optional(),
  groups: z.array(z.string()).optional(),
}).strict();

export const getPageLikesSchema = paginationSchema.extend({
  pageId: z.string().min(1),
}).strict();

// =====================
// Spaces Validation Schemas
// =====================

export const searchSpacesSchema = paginationSchema.merge(fieldsSchema).extend({
  keys: z.array(z.string()).optional(),
  type: z.enum(['global', 'personal']).optional(),
  status: z.enum(['current', 'archived']).optional(),
  labels: z.array(z.string()).optional(),
  sort: z.enum(['id', '-id', 'key', '-key', 'name', '-name']).optional(),
}).strict();

export const getSpaceSchema = z.object({
  spaceId: z.string().min(1),
  descriptionFormat: z.enum(['plain', 'view']).optional(),
}).strict();

export const createSpaceSchema = z.object({
  key: z.string().min(1).max(255).regex(/^[A-Z][A-Z0-9]*$/),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  type: z.enum(['global', 'personal']).optional().default('global'),
}).strict();

export const updateSpaceSchema = z.object({
  spaceId: z.string().min(1),
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  homepageId: z.string().optional(),
}).strict();

export const deleteSpaceSchema = z.object({
  spaceId: z.string().min(1),
}).strict();

export const archiveSpaceSchema = z.object({
  spaceId: z.string().min(1),
}).strict();

export const restoreSpaceSchema = z.object({
  spaceId: z.string().min(1),
}).strict();

export const getSpaceContentSchema = paginationSchema.extend({
  spaceId: z.string().min(1),
  depth: z.enum(['all', 'root']).optional().default('all'),
}).strict();

export const getSpaceSettingsSchema = z.object({
  spaceKey: z.string().min(1),
}).strict();

export const updateSpaceSettingsSchema = z.object({
  spaceKey: z.string().min(1),
  routeOverrideEnabled: z.boolean().optional(),
}).strict();

export const getSpaceThemeSchema = z.object({
  spaceKey: z.string().min(1),
}).strict();

export const setSpaceThemeSchema = z.object({
  spaceKey: z.string().min(1),
  themeKey: z.string(),
}).strict();

// =====================
// Space Permissions Validation Schemas
// =====================

export const getSpacePermissionsSchema = paginationSchema.extend({
  spaceId: z.string().min(1),
}).strict();

export const addSpacePermissionSchema = z.object({
  spaceId: z.string().min(1),
  principalType: z.enum(['user', 'group']),
  principalId: z.string().min(1),
  operation: z.string().min(1),
  targetType: z.string().optional(),
}).strict();

export const removeSpacePermissionSchema = z.object({
  spaceId: z.string().min(1),
  permissionId: z.string().min(1),
}).strict();

export const getSpacePermissionUsersSchema = paginationSchema.extend({
  spaceKey: z.string().min(1),
  permissionKey: z.string().min(1),
}).strict();

export const copySpacePermissionsSchema = z.object({
  sourceSpaceId: z.string().min(1),
  targetSpaceId: z.string().min(1),
}).strict();

export const checkContentPermissionSchema = z.object({
  contentId: z.string().min(1),
  operation: z.enum(['read', 'update', 'delete']),
  accountId: z.string().optional(),
}).strict();

export const bulkUpdatePermissionsSchema = z.object({
  spaceId: z.string().min(1),
  permissions: z.array(z.object({
    principalType: z.enum(['user', 'group']),
    principalId: z.string(),
    operation: z.string(),
    targetType: z.string().optional(),
  }).strict()),
}).strict();

// =====================
// Comments Validation Schemas
// =====================

export const getPageCommentsSchema = paginationSchema.extend({
  pageId: z.string().min(1),
  bodyFormat: z.enum(['storage', 'atlas_doc_format', 'view']).optional(),
}).strict();

export const getFooterCommentsSchema = paginationSchema.extend({
  pageId: z.string().min(1),
  bodyFormat: z.enum(['storage', 'atlas_doc_format', 'view']).optional(),
}).strict();

export const getInlineCommentsSchema = paginationSchema.extend({
  pageId: z.string().min(1),
  bodyFormat: z.enum(['storage', 'atlas_doc_format', 'view']).optional(),
}).strict();

export const addFooterCommentSchema = z.object({
  pageId: z.string().min(1),
  body: z.string().min(1),
  representation: z.enum(['storage', 'atlas_doc_format']).optional().default('storage'),
}).strict();

export const addInlineCommentSchema = z.object({
  pageId: z.string().min(1),
  body: z.string().min(1),
  textSelection: z.string().min(1),
  textSelectionMatchCount: z.number().optional(),
  textSelectionMatchIndex: z.number().optional(),
  representation: z.enum(['storage', 'atlas_doc_format']).optional().default('storage'),
}).strict();

export const updateCommentSchema = z.object({
  commentId: z.string().min(1),
  body: z.string().min(1),
  version: z.number().min(1),
  representation: z.enum(['storage', 'atlas_doc_format']).optional().default('storage'),
}).strict();

export const deleteCommentSchema = z.object({
  commentId: z.string().min(1),
}).strict();

export const getCommentChildrenSchema = paginationSchema.extend({
  commentId: z.string().min(1),
  bodyFormat: z.enum(['storage', 'atlas_doc_format', 'view']).optional(),
}).strict();

// =====================
// Attachments Validation Schemas
// =====================

export const getAttachmentsSchema = paginationSchema.extend({
  pageId: z.string().min(1),
  mediaType: z.string().optional(),
  filename: z.string().optional(),
}).strict();

export const getAttachmentSchema = z.object({
  attachmentId: z.string().min(1),
}).strict();

export const uploadAttachmentSchema = z.object({
  pageId: z.string().min(1),
  filename: z.string().min(1),
  content: z.string(),
  mediaType: z.string().optional(),
  comment: z.string().optional(),
}).strict();

export const updateAttachmentSchema = z.object({
  attachmentId: z.string().min(1),
  content: z.string(),
  comment: z.string().optional(),
}).strict();

export const deleteAttachmentSchema = z.object({
  attachmentId: z.string().min(1),
  purge: z.boolean().optional().default(false),
}).strict();

export const downloadAttachmentSchema = z.object({
  attachmentId: z.string().min(1),
}).strict();

export const getAttachmentVersionsSchema = paginationSchema.extend({
  attachmentId: z.string().min(1),
}).strict();

export const copyAttachmentSchema = z.object({
  attachmentId: z.string().min(1),
  destinationPageId: z.string().min(1),
}).strict();

// =====================
// Templates Validation Schemas
// =====================

export const getTemplatesSchema = paginationSchema.extend({
  spaceKey: z.string().optional(),
}).strict();

export const getTemplateSchema = z.object({
  templateId: z.string().min(1),
}).strict();

export const createTemplateSchema = z.object({
  name: z.string().min(1),
  templateType: z.enum(['page', 'blogpost']),
  body: z.string(),
  description: z.string().optional(),
  spaceKey: z.string().optional(),
  labels: z.array(z.string()).optional(),
}).strict();

export const updateTemplateSchema = z.object({
  templateId: z.string().min(1),
  name: z.string().optional(),
  body: z.string().optional(),
  description: z.string().optional(),
}).strict();

export const deleteTemplateSchema = z.object({
  templateId: z.string().min(1),
}).strict();

// =====================
// Labels Validation Schemas
// =====================

export const getLabelsSchema = paginationSchema.extend({
  contentId: z.string().min(1),
  prefix: z.enum(['global', 'my', 'team']).optional(),
}).strict();

export const addLabelsSchema = z.object({
  contentId: z.string().min(1),
  labels: z.array(z.object({
    name: z.string().min(1),
    prefix: z.enum(['global', 'my', 'team']).optional().default('global'),
  }).strict()),
}).strict();

export const removeLabelSchema = z.object({
  contentId: z.string().min(1),
  labelName: z.string().min(1),
}).strict();

export const getSpaceLabelsSchema = paginationSchema.extend({
  spaceId: z.string().min(1),
  prefix: z.enum(['global', 'my', 'team']).optional(),
}).strict();

export const addSpaceLabelSchema = z.object({
  spaceId: z.string().min(1),
  labels: z.array(z.object({
    name: z.string().min(1),
    prefix: z.enum(['global', 'my', 'team']).optional().default('global'),
  }).strict()),
}).strict();

export const removeSpaceLabelSchema = z.object({
  spaceId: z.string().min(1),
  labelName: z.string().min(1),
}).strict();

// =====================
// Search Validation Schemas
// =====================

export const searchCqlSchema = paginationSchema.extend({
  cql: z.string().min(1),
  cqlcontext: z.string().optional(),
  excerpt: z.enum(['highlight', 'indexed', 'none']).optional(),
  expand: z.string().optional(),
}).strict();

export const searchContentSchema = paginationSchema.extend({
  query: z.string().min(1),
  spaceKey: z.string().optional(),
  type: z.enum(['page', 'blogpost', 'attachment', 'comment']).optional(),
}).strict();

// =====================
// Blogs Validation Schemas
// =====================

export const getBlogPostsSchema = paginationSchema.merge(fieldsSchema).extend({
  spaceId: z.string().optional(),
  status: z.enum(['current', 'trashed', 'deleted', 'draft']).optional(),
  sort: z.enum(['id', '-id', 'title', '-title', 'created-date', '-created-date']).optional(),
}).strict();

export const getBlogPostSchema = z.object({
  blogPostId: z.string().min(1),
  bodyFormat: z.enum(['storage', 'atlas_doc_format', 'view']).optional(),
}).strict();

export const createBlogPostSchema = z.object({
  spaceId: z.string().min(1),
  title: z.string().min(1).max(255),
  body: z.string(),
  status: z.enum(['current', 'draft']).optional().default('current'),
  representation: z.enum(['storage', 'atlas_doc_format']).optional().default('storage'),
}).strict();

export const updateBlogPostSchema = z.object({
  blogPostId: z.string().min(1),
  title: z.string().max(255).optional(),
  body: z.string().optional(),
  version: z.number().min(1),
  status: z.enum(['current', 'draft']).optional(),
  representation: z.enum(['storage', 'atlas_doc_format']).optional().default('storage'),
}).strict();

export const deleteBlogPostSchema = z.object({
  blogPostId: z.string().min(1),
  purge: z.boolean().optional().default(false),
}).strict();

// =====================
// Analytics Validation Schemas
// =====================

export const getPageAnalyticsSchema = z.object({
  pageId: z.string().min(1),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
}).strict();

export const getSpaceAnalyticsSchema = z.object({
  spaceId: z.string().min(1),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
}).strict();

export const getTopViewedPagesSchema = paginationSchema.extend({
  spaceId: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
}).strict();

// =====================
// Content Properties Validation Schemas
// =====================

export const getContentPropertiesSchema = paginationSchema.extend({
  contentId: z.string().min(1),
}).strict();

export const getContentPropertySchema = z.object({
  contentId: z.string().min(1),
  propertyKey: z.string().min(1),
}).strict();

export const createContentPropertySchema = z.object({
  contentId: z.string().min(1),
  key: z.string().min(1),
  value: z.unknown(),
}).strict();

export const updateContentPropertySchema = z.object({
  contentId: z.string().min(1),
  propertyKey: z.string().min(1),
  value: z.unknown(),
  version: z.number().min(1),
}).strict();

export const deleteContentPropertySchema = z.object({
  contentId: z.string().min(1),
  propertyKey: z.string().min(1),
}).strict();

// =====================
// Watchers Validation Schemas
// =====================

export const getContentWatchersSchema = paginationSchema.extend({
  contentId: z.string().min(1),
}).strict();

export const addContentWatchSchema = z.object({
  contentId: z.string().min(1),
}).strict();

export const removeContentWatchSchema = z.object({
  contentId: z.string().min(1),
}).strict();

export const getSpaceWatchersSchema = paginationSchema.extend({
  spaceId: z.string().min(1),
}).strict();

// =====================
// Admin Validation Schemas
// =====================

export const searchToolsSchema = z.object({
  category: z.enum(['pages', 'spaces', 'permissions', 'comments', 'attachments', 'templates', 'labels', 'search', 'blogs', 'analytics', 'properties', 'watchers', 'admin', 'all']).optional(),
  type: z.enum(['discovery', 'read', 'create', 'update', 'delete', 'all']).optional(),
  query: z.string().optional(),
}).strict();

export const getAuditRecordsSchema = paginationSchema.extend({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  searchString: z.string().optional(),
}).strict();

export const exportAuditRecordsSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  format: z.enum(['csv', 'json']).optional().default('csv'),
}).strict();

export const setContentStateSchema = z.object({
  contentId: z.string().min(1),
  stateId: z.string().min(1),
}).strict();

export const getContentStatesSchema = z.object({
  spaceKey: z.string().optional(),
}).strict();
