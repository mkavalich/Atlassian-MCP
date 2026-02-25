// =====================
// Authentication Types
// =====================

export interface AuthConfig {
  type: 'basic' | 'oauth';
  baseUrl: string;
  email?: string;
  apiToken?: string;
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;
}

// =====================
// API Response Types
// =====================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  metadata?: {
    executionTime?: number;
    rateLimitInfo?: RateLimitInfo;
  };
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}

export interface RequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  params?: Record<string, any>;
  data?: any;
  headers?: Record<string, string>;
  apiVersion?: 'v1' | 'v2';
}

// =====================
// Pagination Types
// =====================

export interface PaginatedResponse<T> {
  results: T[];
  _links?: {
    next?: string;
    base?: string;
  };
  size?: number;
  start?: number;
  limit?: number;
}

// V2 Cursor-based pagination
export interface CursorPaginatedResponse<T> {
  results: T[];
  _links?: {
    next?: string;
  };
}

// =====================
// Space Types
// =====================

export interface ConfluenceSpace {
  id: string;
  key: string;
  name: string;
  type: 'global' | 'personal';
  status?: 'current' | 'archived';
  description?: {
    plain?: { value: string };
    view?: { value: string };
  };
  homepage?: ConfluencePage;
  icon?: {
    path: string;
    width?: number;
    height?: number;
  };
  _links?: {
    webui: string;
    self: string;
  };
  createdAt?: string;
  authorId?: string;
}

export interface CreateSpaceInput {
  key: string;
  name: string;
  description?: string;
  type?: 'global' | 'personal';
}

export interface UpdateSpaceInput {
  name?: string;
  description?: string;
  homepage?: { id: string };
}

// =====================
// Page/Content Types
// =====================

export interface ConfluencePage {
  id: string;
  type: 'page' | 'blogpost' | 'comment' | 'attachment';
  status: 'current' | 'trashed' | 'deleted' | 'historical' | 'draft';
  title: string;
  spaceId?: string;
  parentId?: string;
  parentType?: string;
  position?: number;
  authorId?: string;
  ownerId?: string;
  lastOwnerId?: string;
  createdAt?: string;
  version?: ContentVersion;
  body?: {
    storage?: { value: string; representation: 'storage' };
    atlas_doc_format?: { value: string; representation: 'atlas_doc_format' };
    view?: { value: string; representation: 'view' };
    export_view?: { value: string; representation: 'export_view' };
    styled_view?: { value: string; representation: 'styled_view' };
    anonymous_export_view?: { value: string; representation: 'anonymous_export_view' };
  };
  _links?: {
    webui?: string;
    editui?: string;
    tinyui?: string;
    self?: string;
  };
  // V1 specific fields
  space?: ConfluenceSpace;
  ancestors?: ConfluencePage[];
  children?: {
    page?: PaginatedResponse<ConfluencePage>;
    comment?: PaginatedResponse<ConfluencePage>;
    attachment?: PaginatedResponse<ConfluenceAttachment>;
  };
  history?: {
    latest: boolean;
    createdBy: ConfluenceUser;
    createdDate: string;
  };
  metadata?: {
    labels?: {
      results: ConfluenceLabel[];
    };
    properties?: Record<string, any>;
  };
}

export interface ContentVersion {
  number: number;
  message?: string;
  minorEdit?: boolean;
  authorId?: string;
  createdAt?: string;
}

export interface CreatePageInput {
  spaceId: string;
  title: string;
  body: string;
  parentId?: string;
  status?: 'current' | 'draft';
  representation?: 'storage' | 'atlas_doc_format' | 'wiki';
}

export interface UpdatePageInput {
  id: string;
  title?: string;
  body?: string;
  version: number;
  status?: 'current' | 'draft';
  representation?: 'storage' | 'atlas_doc_format';
}

// =====================
// Blog Post Types
// =====================

export interface ConfluenceBlogPost {
  id: string;
  status: 'current' | 'trashed' | 'deleted' | 'historical' | 'draft';
  title: string;
  spaceId: string;
  authorId?: string;
  createdAt?: string;
  version?: ContentVersion;
  body?: {
    storage?: { value: string; representation: 'storage' };
    atlas_doc_format?: { value: string; representation: 'atlas_doc_format' };
  };
  _links?: {
    webui?: string;
    self?: string;
  };
}

export interface CreateBlogPostInput {
  spaceId: string;
  title: string;
  body: string;
  status?: 'current' | 'draft';
  representation?: 'storage' | 'atlas_doc_format';
}

// =====================
// Comment Types
// =====================

export interface ConfluenceComment {
  id: string;
  status: 'current' | 'deleted';
  title?: string;
  pageId?: string;
  blogPostId?: string;
  parentCommentId?: string;
  version?: ContentVersion;
  body?: {
    storage?: { value: string; representation: 'storage' };
    atlas_doc_format?: { value: string; representation: 'atlas_doc_format' };
  };
  createdAt?: string;
  authorId?: string;
  _links?: {
    webui?: string;
    self?: string;
  };
  // V1 fields
  inlineProperties?: {
    originalSelection?: string;
    markerRef?: string;
  };
  extensions?: {
    inlineProperties?: {
      originalSelection?: string;
    };
    resolution?: {
      status: 'open' | 'resolved' | 'reopened';
      lastModifier?: ConfluenceUser;
      lastModifiedDate?: string;
    };
  };
}

export interface CreateCommentInput {
  pageId?: string;
  blogPostId?: string;
  parentCommentId?: string;
  body: string;
  representation?: 'storage' | 'atlas_doc_format';
}

export interface CreateInlineCommentInput {
  pageId: string;
  body: string;
  inlineCommentProperties: {
    textSelection: string;
    textSelectionMatchCount?: number;
    textSelectionMatchIndex?: number;
  };
  representation?: 'storage' | 'atlas_doc_format';
}

// =====================
// Attachment Types
// =====================

export interface ConfluenceAttachment {
  id: string;
  status: 'current' | 'trashed' | 'deleted' | 'historical';
  title: string;
  mediaType?: string;
  mediaTypeDescription?: string;
  comment?: string;
  fileId?: string;
  fileSize?: number;
  webuiLink?: string;
  downloadLink?: string;
  pageId?: string;
  blogPostId?: string;
  version?: ContentVersion;
  createdAt?: string;
  _links?: {
    webui?: string;
    download?: string;
    self?: string;
  };
}

// =====================
// Label Types
// =====================

export interface ConfluenceLabel {
  id: string;
  name: string;
  prefix: 'global' | 'my' | 'team';
}

export interface AddLabelInput {
  name: string;
  prefix?: 'global' | 'my' | 'team';
}

// =====================
// Template Types
// =====================

export interface ConfluenceTemplate {
  templateId: string;
  name: string;
  description?: string;
  templateType: 'page' | 'blogpost';
  body?: {
    storage?: { value: string; representation: 'storage' };
  };
  space?: ConfluenceSpace;
  labels?: ConfluenceLabel[];
  referencingBlueprint?: string;
  _links?: {
    self?: string;
  };
}

export interface CreateTemplateInput {
  name: string;
  templateType: 'page' | 'blogpost';
  body: string;
  description?: string;
  space?: { key: string };
  labels?: AddLabelInput[];
}

// =====================
// Permission Types
// =====================

export interface SpacePermission {
  id: string;
  principal: {
    type: 'user' | 'group' | 'role';
    id: string;
  };
  operation: {
    key: string;
    targetType: string;
  };
  _links?: {
    self?: string;
  };
}

export interface AddSpacePermissionInput {
  subject: {
    type: 'user' | 'group';
    identifier: string;
  };
  operation: {
    key: string;
    target: string;
  };
}

export interface ContentRestriction {
  operation: 'read' | 'update';
  restrictions: {
    user?: { results: ConfluenceUser[] };
    group?: { results: ConfluenceGroup[] };
  };
}

// =====================
// User & Group Types
// =====================

export interface ConfluenceUser {
  type: 'known' | 'unknown' | 'anonymous' | 'user';
  accountId: string;
  accountType?: string;
  email?: string;
  publicName?: string;
  displayName?: string;
  profilePicture?: {
    path: string;
    width?: number;
    height?: number;
  };
  _links?: {
    self?: string;
  };
}

export interface ConfluenceGroup {
  type: 'group';
  id?: string;
  name: string;
  _links?: {
    self?: string;
  };
}

// =====================
// Search Types
// =====================

export interface CqlSearchResult {
  content?: ConfluencePage;
  space?: ConfluenceSpace;
  user?: ConfluenceUser;
  title?: string;
  excerpt?: string;
  url?: string;
  resultGlobalContainer?: {
    title: string;
    displayUrl: string;
  };
  breadcrumbs?: Array<{
    label: string;
    url: string;
  }>;
  entityType?: string;
  iconCssClass?: string;
  lastModified?: string;
  friendlyLastModified?: string;
}

export interface SearchResponse {
  results: CqlSearchResult[];
  start: number;
  limit: number;
  size: number;
  totalSize?: number;
  cqlQuery?: string;
  searchDuration?: number;
  _links?: {
    base?: string;
    context?: string;
    next?: string;
    prev?: string;
    self?: string;
  };
}

// =====================
// Analytics Types
// =====================

export interface ContentAnalytics {
  id: string;
  views?: {
    count: number;
    lastSeen?: string;
  };
  uniqueUsers?: number;
  trend?: number;
}

// =====================
// Audit Types
// =====================

export interface AuditRecord {
  author?: ConfluenceUser;
  remoteAddress?: string;
  creationDate?: string;
  summary?: string;
  description?: string;
  category?: string;
  sysAdmin?: boolean;
  affectedObject?: {
    name: string;
    objectType: string;
  };
  changedValues?: Array<{
    name: string;
    oldValue?: string;
    newValue?: string;
  }>;
  associatedObjects?: Array<{
    name: string;
    objectType: string;
  }>;
}

// =====================
// Content Property Types
// =====================

export interface ContentProperty {
  id: string;
  key: string;
  value: any;
  version?: {
    number: number;
    minorEdit?: boolean;
  };
  content?: ConfluencePage;
}

export interface CreateContentPropertyInput {
  key: string;
  value: any;
}

export interface UpdateContentPropertyInput {
  key: string;
  value: any;
  version: number;
}

// =====================
// Watcher Types
// =====================

export interface ContentWatcher {
  type: 'user';
  watcher: ConfluenceUser;
  contentId: string;
}

// =====================
// System Info Types
// =====================

export interface SystemInfo {
  cloudId?: string;
  edition?: string;
  siteTitle?: string;
  baseUrl?: string;
  buildNumber?: string;
  buildDate?: string;
}

// =====================
// Content State Types
// =====================

export interface ContentState {
  name: string;
  id?: string;
  color?: string;
}

// =====================
// Like Types
// =====================

export interface ContentLike {
  id: string;
  user: ConfluenceUser;
  contentId: string;
  createdAt: string;
}
