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

export interface RequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  params?: Record<string, any>;
  data?: any;
  headers?: Record<string, string>;
  /** API base path - defaults to '/rest/api/3', use '/rest/agile/1.0' for Agile API */
  apiBase?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
    suggestion?: string;
  };
  metadata?: {
    requestId?: string;
    executionTime?: number;
    rateLimitInfo?: RateLimitInfo;
  };
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  description?: string;
  projectTypeKey: string;
  lead?: {
    accountId: string;
    displayName: string;
  };
  assigneeType?: string;
  style?: string;
  isPrivate?: boolean;
  entityId?: string;
  uuid?: string;
}

export interface JiraIssueTypeScheme {
  id: string;
  name: string;
  description?: string;
  issueTypes?: JiraIssueType[];
  defaultIssueTypeId?: string;
  isDefault?: boolean;
}

export interface JiraIssueType {
  id: string;
  name: string;
  description?: string;
  iconUrl?: string;
  avatarId?: number;
  subtask?: boolean;
}

export interface JiraIssueTypeScreenScheme {
  id: string;
  name: string;
  description?: string;
  issueTypeMappings?: JiraIssueTypeMapping[];
}

export interface JiraIssueTypeMapping {
  issueTypeId: string;
  screenSchemeId: string;
  issueType?: JiraIssueType;
  screenScheme?: JiraScreenScheme;
}

export interface JiraScreenScheme {
  id: string;
  name: string;
  description?: string;
  screens?: {
    default?: string;
    create?: string;
    edit?: string;
    view?: string;
  };
}

export interface CreateProjectInput {
  name: string;
  key: string;
  projectTypeKey: 'business' | 'software' | 'service_desk';
  description?: string;
  leadAccountId: string;
  assigneeType?: 'PROJECT_LEAD' | 'UNASSIGNED';
  url?: string;
  avatarId?: number;
  // Enhanced parameters for project templates and configuration
  projectTemplateKey?: string;
  categoryId?: number;
  notificationScheme?: number;
  permissionScheme?: number;
  issueSecurityScheme?: number;
}

export interface JiraUser {
  accountId: string;
  displayName?: string;
  emailAddress?: string;
}

// Dashboard types
export interface JiraDashboard {
  id: string;
  name: string;
  description?: string;
  owner?: JiraUser;
  sharePermissions?: JiraSharePermission[];
  gadgets?: JiraDashboardGadget[];
  popularity?: number;
  rank?: number;
  isFavourite?: boolean;
  isWritable?: boolean;
  view?: string;
}

export interface JiraSharePermission {
  type: 'global' | 'project' | 'group' | 'authenticated' | 'user';
  project?: {
    id?: string;
    key?: string;
    name?: string;
  };
  group?: {
    name: string;
  };
  user?: {
    accountId: string;
  };
}

export interface JiraDashboardGadget {
  id: string;
  gadgetURI?: string;
  moduleKey?: string;
  title?: string;
  color?: 'blue' | 'red' | 'yellow' | 'green' | 'cyan' | 'purple' | 'gray' | 'white';
  position: JiraGadgetPosition;
  properties?: Record<string, any>;
}

export interface JiraGadgetPosition {
  column: number;
  row: number;
}

// Issue types
export interface JiraIssue {
  id: string;
  key: string;
  self: string;
  fields: JiraIssueFields;
  expand?: string;
  changelog?: JiraChangelog;
  transitions?: JiraTransition[];
  renderedFields?: Record<string, any>;
  editmeta?: JiraEditMeta;
  names?: Record<string, string>;
  schema?: Record<string, any>;
  operations?: JiraOperations;
}

export interface JiraIssueFields {
  summary: string;
  description?: any; // Can be string or ADF
  issuetype: JiraIssueType;
  project: JiraProject;
  status: JiraStatus;
  priority?: JiraPriority;
  assignee?: JiraUser | null;
  reporter?: JiraUser;
  creator?: JiraUser;
  created: string;
  updated: string;
  duedate?: string | null;
  labels?: string[];
  components?: JiraComponent[];
  fixVersions?: JiraVersion[];
  versions?: JiraVersion[]; // affectsVersions
  parent?: JiraIssueParent;
  subtasks?: JiraIssueSubtask[];
  resolution?: JiraResolution | null;
  resolutiondate?: string | null;
  comment?: JiraCommentPage;
  worklog?: JiraWorklogPage;
  attachment?: JiraAttachment[];
  issuelinks?: JiraIssueLink[];
  watches?: JiraWatches;
  votes?: JiraVotes;
  timetracking?: JiraTimeTracking;
  [key: string]: any; // Custom fields
}

export interface JiraStatus {
  id: string;
  name: string;
  description?: string;
  iconUrl?: string;
  statusCategory?: {
    id: number;
    key: string;
    name: string;
    colorName: string;
  };
}

export interface JiraPriority {
  id: string;
  name: string;
  iconUrl?: string;
  description?: string;
}

export interface JiraComponent {
  id: string;
  name: string;
  description?: string;
  lead?: JiraUser;
  assigneeType?: string;
}

export interface JiraVersion {
  id: string;
  name: string;
  description?: string;
  released?: boolean;
  archived?: boolean;
  releaseDate?: string;
}

export interface JiraIssueParent {
  id: string;
  key: string;
  fields?: {
    summary: string;
    status: JiraStatus;
    issuetype: JiraIssueType;
  };
}

export interface JiraIssueSubtask {
  id: string;
  key: string;
  fields: {
    summary: string;
    status: JiraStatus;
    issuetype: JiraIssueType;
  };
}

export interface JiraResolution {
  id: string;
  name: string;
  description?: string;
}

export interface JiraTransition {
  id: string;
  name: string;
  to: JiraStatus;
  hasScreen?: boolean;
  isGlobal?: boolean;
  isInitial?: boolean;
  isAvailable?: boolean;
  isConditional?: boolean;
  isLooped?: boolean;
  fields?: Record<string, JiraTransitionField>;
}

export interface JiraTransitionField {
  required: boolean;
  schema: {
    type: string;
    items?: string;
    system?: string;
    custom?: string;
    customId?: number;
  };
  name: string;
  fieldId: string;
  hasDefaultValue: boolean;
  operations: string[];
  allowedValues?: any[];
  defaultValue?: any;
}

export interface JiraChangelog {
  startAt: number;
  maxResults: number;
  total: number;
  histories: JiraChangelogHistory[];
}

export interface JiraChangelogHistory {
  id: string;
  author: JiraUser;
  created: string;
  items: JiraChangelogItem[];
}

export interface JiraChangelogItem {
  field: string;
  fieldtype: string;
  fieldId?: string;
  from?: string;
  fromString?: string;
  to?: string;
  toString?: string;
}

export interface JiraEditMeta {
  fields: Record<string, any>;
}

export interface JiraOperations {
  linkGroups: any[];
}

// Comment types
export interface JiraComment {
  id: string;
  self: string;
  author: JiraUser;
  body: any; // Can be string or ADF
  renderedBody?: string;
  updateAuthor?: JiraUser;
  created: string;
  updated: string;
  visibility?: JiraCommentVisibility;
  jsdPublic?: boolean;
}

export interface JiraCommentVisibility {
  type: 'role' | 'group';
  value: string;
  identifier?: string;
}

export interface JiraCommentPage {
  startAt: number;
  maxResults: number;
  total: number;
  comments: JiraComment[];
}

// Worklog types
export interface JiraWorklog {
  id: string;
  self: string;
  author: JiraUser;
  updateAuthor?: JiraUser;
  comment?: any;
  created: string;
  updated: string;
  started: string;
  timeSpent: string;
  timeSpentSeconds: number;
  visibility?: JiraCommentVisibility;
}

export interface JiraWorklogPage {
  startAt: number;
  maxResults: number;
  total: number;
  worklogs: JiraWorklog[];
}

// Attachment types
export interface JiraAttachment {
  id: string;
  self: string;
  filename: string;
  author: JiraUser;
  created: string;
  size: number;
  mimeType: string;
  content: string;
  thumbnail?: string;
}

// Issue Link types
export interface JiraIssueLink {
  id: string;
  self: string;
  type: JiraIssueLinkType;
  inwardIssue?: JiraLinkedIssue;
  outwardIssue?: JiraLinkedIssue;
}

export interface JiraIssueLinkType {
  id: string;
  name: string;
  inward: string;
  outward: string;
  self: string;
}

export interface JiraLinkedIssue {
  id: string;
  key: string;
  self: string;
  fields: {
    summary: string;
    status: JiraStatus;
    priority?: JiraPriority;
    issuetype: JiraIssueType;
  };
}

// Watches & Votes
export interface JiraWatches {
  self: string;
  watchCount: number;
  isWatching: boolean;
  watchers?: JiraUser[];
}

export interface JiraVotes {
  self: string;
  votes: number;
  hasVoted: boolean;
  voters?: JiraUser[];
}

// Time tracking
export interface JiraTimeTracking {
  originalEstimate?: string;
  remainingEstimate?: string;
  timeSpent?: string;
  originalEstimateSeconds?: number;
  remainingEstimateSeconds?: number;
  timeSpentSeconds?: number;
}

// Create issue response
export interface JiraCreateIssueResponse {
  id: string;
  key: string;
  self: string;
}

// ============================================================================
// Agile API Types (Jira Software)
// ============================================================================

/** Sprint state enum */
export type SprintState = 'future' | 'active' | 'closed';

/** Sprint from Jira Software Agile API */
export interface JiraSprint {
  id: number;
  self: string;
  state: SprintState;
  name: string;
  startDate?: string;
  endDate?: string;
  completeDate?: string;
  createdDate?: string;
  originBoardId?: number;
  goal?: string;
}

/** Board type enum */
export type BoardType = 'scrum' | 'kanban' | 'simple';

/** Board from Jira Software Agile API */
export interface JiraBoard {
  id: number;
  self: string;
  name: string;
  type: BoardType;
  location?: {
    projectId?: number;
    displayName?: string;
    projectName?: string;
    projectKey?: string;
    projectTypeKey?: string;
    avatarURI?: string;
    name?: string;
  };
}

/** Board configuration */
export interface JiraBoardConfiguration {
  id: number;
  name: string;
  type: BoardType;
  self: string;
  filter?: {
    id: string;
    self: string;
  };
  columnConfig?: {
    columns: JiraBoardColumn[];
    constraintType?: string;
  };
  estimation?: {
    type: string;
    field?: {
      fieldId: string;
      displayName: string;
    };
  };
  ranking?: {
    rankCustomFieldId: number;
  };
}

/** Board column */
export interface JiraBoardColumn {
  name: string;
  statuses: Array<{
    id: string;
    self: string;
  }>;
  min?: number;
  max?: number;
}

/** Paginated response for sprints */
export interface JiraSprintPage {
  maxResults: number;
  startAt: number;
  total?: number;
  isLast: boolean;
  values: JiraSprint[];
}

/** Paginated response for boards */
export interface JiraBoardPage {
  maxResults: number;
  startAt: number;
  total: number;
  isLast: boolean;
  values: JiraBoard[];
}

/** Paginated response for issues in sprint/board */
export interface JiraAgileIssuePage {
  maxResults: number;
  startAt: number;
  total: number;
  issues: JiraIssue[];
}

/** Move issues to sprint response */
export interface JiraMoveIssuesResult {
  success: boolean;
  movedIssues?: string[];
  errors?: Array<{
    issueKey: string;
    error: string;
  }>;
}