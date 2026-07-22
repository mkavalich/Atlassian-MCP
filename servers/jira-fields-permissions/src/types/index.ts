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

export interface JiraWorkflow {
  name: string;
  description?: string;
  lastModifiedDate?: string;
  lastModifiedUser?: string;
  steps?: number;
  default?: boolean;
}

export interface JiraPermissionScheme {
  id: number;
  name: string;
  description?: string;
  permissions?: JiraPermission[];
}

export interface JiraPermission {
  id: number;
  permission: string;
  holder: {
    type: string;
    parameter?: string;
  };
}

export interface JiraFieldSchema {
  type: string;
  custom?: string;
  customId?: number;
  system?: string;
}

/**
 * A row from GET /rest/api/3/field. This endpoint DOES return a `custom`
 * boolean, so it is the only shape on which reading `.custom` is meaningful.
 */
export interface JiraFieldListItem {
  id: string;
  key?: string;
  name: string;
  custom: boolean;
  orderable?: boolean;
  navigable?: boolean;
  searchable?: boolean;
  clauseNames?: string[];
  schema?: JiraFieldSchema;
}

/**
 * A row from GET /rest/api/3/field/search.
 *
 * Deliberately has NO `custom` property: that endpoint does not return one.
 * Reading `f.custom` on this shape must fail to COMPILE rather than silently
 * evaluate to `undefined` -- the previous `isCustom: boolean` declaration made
 * every row look system-classified because `!undefined` is `true`.
 */
export interface JiraFieldSearchItem {
  id: string;
  name: string;
  description?: string;
  typeDisplayName?: string;
  areOptionsSupported?: boolean;
  isOptionsCountOverLimit?: boolean;
  schema?: JiraFieldSchema;
}

/**
 * The ONLY custom-field discriminator present on BOTH field shapes.
 *
 * Returns `null` -- never `false` -- when `schema` is absent. Three rows on a
 * real instance (thumbnail/Images, issuekey/Key, parent/Parent) carry no
 * `schema` at all, and an absent discriminator is not a negative answer.
 * Bucketing them as "system" would reintroduce exactly the defect this
 * replaces: a confident, wrong, successful-looking classification.
 */
export function isCustomField(
  f: { schema?: { customId?: number } } | null | undefined
): boolean | null {
  if (!f || !f.schema) return null;
  return f.schema.customId !== undefined;
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

export interface JiraScreen {
  id: string;
  name: string;
  description?: string;
}

// Field Context types
export interface JiraCustomFieldContext {
  id: string;
  name: string;
  description?: string;
  isGlobalContext?: boolean;
  projectIds?: string[];
  issueTypeIds?: string[];
}

/**
 * A row from GET /rest/api/3/field/{fieldId}/context/projectmapping.
 *
 * A GLOBAL context row carries `isGlobalContext: true` and NO `projectId` --
 * that means the field applies to every project, emphatically NOT to zero
 * projects. Reading `row.projectId` and counting the misses would report
 * "0 projects" for every global field under success:true.
 *
 * A genuinely project-scoped context row carries a usable `projectId`. Any row
 * that is neither global nor carries a usable projectId is counted as
 * unresolved rather than assumed empty.
 */
export interface JiraFieldContextProjectMappingRow {
  contextId: string;
  projectId?: string;
  isGlobalContext?: boolean;
}

/**
 * The classified scope of a custom field's project association.
 *
 *   - `global`                       — a global context: applies to EVERY project.
 *   - `project-scoped`               — real project ids returned by a 200.
 *   - `unknown`                      — a 200 whose rows could not be classified.
 *   - `project-scoped-jpd`           — a JPD field (`schema.custom` starts
 *                                      `jira.polaris:`) whose mapping endpoint
 *                                      returns a byte-identical 404; UNVERIFIABLE.
 *   - `project-scoped-unverifiable`  — a non-JPD field whose mapping endpoint
 *                                      returns a byte-identical 404; UNVERIFIABLE.
 */
export type FieldProjectScope =
  | 'global'
  | 'project-scoped'
  | 'unknown'
  | 'project-scoped-jpd'
  | 'project-scoped-unverifiable';

export interface JiraFieldProjectMapping {
  fieldId: string;
  scope: FieldProjectScope;
  /** True when the field applies to every project via a global context. */
  allProjects: boolean;
  /**
   * True only when the endpoint yielded a definitive answer about the field's
   * projects (a resolvable 200). A byte-identical 404, or a 200 whose rows
   * cannot be classified, is `false` — never a confident negative.
   */
  verifiable: boolean;
  /** Explicit project ids when project-scoped; null when global or unresolved. */
  projects: string[] | null;
  /** null when the count cannot be determined. NEVER 0 for a global context. */
  projectCount: number | null;
  /**
   * The advisory project id(s) from `/field` `scope.project.id`. Present even
   * when the mapping endpoint is unverifiable, so an UNVERIFIABLE JPD field
   * still surfaces its scope hint rather than an empty/zero answer.
   */
  projectsFromScope: { id: string }[];
  /** Rows whose shape could not be classified. */
  unresolvedRows: number;
  contextCount: number;
  /** Populated only for the two unverifiable (404) scopes. */
  unverifiableReason?: string;
}

export interface JiraCustomFieldOption {
  id: string;
  value: string;
  disabled?: boolean;
  optionId?: string;
}

/** A screen a field appears on, from GET /rest/api/3/field/{fieldId}/screens. */
export interface JiraFieldScreenRef {
  id: string;
  name?: string;
  description?: string;
}

/**
 * The result of resolving a field's screens.
 *
 * `screens: []` with `onNoScreens: true` is reachable ONLY from a real 200
 * total:0 (a genuine "on no screens"). A known-custom field whose /screens
 * endpoint 404s is `verifiable: false` with `screens: null` and code
 * SCREENS_UNAVAILABLE — never an empty screens list.
 */
export interface JiraFieldScreensResult {
  fieldId: string;
  screens: JiraFieldScreenRef[] | null;
  total: number | null;
  onNoScreens: boolean;
  verifiable: boolean;
  code?: string;
}

// Field Configuration types
export interface JiraFieldConfiguration {
  id: number;
  name: string;
  description?: string;
  fieldConfigItems?: JiraFieldConfigItem[];
}

export interface JiraFieldConfigItem {
  fieldId: string;
  isHidden?: boolean;
  isRequired?: boolean;
  renderer?: string;
}

export interface JiraFieldConfigurationScheme {
  id: number;
  name: string;
  description?: string;
  fieldConfigurations?: JiraFieldConfigurationSchemeItem[];
}

export interface JiraFieldConfigurationSchemeItem {
  issueTypeId: string;
  fieldConfigurationId: number;
}

// Notification Scheme types
export interface JiraNotificationScheme {
  id: string;
  name: string;
  description?: string;
  notificationSchemeEvents?: JiraNotificationSchemeEvent[];
}

export interface JiraNotificationSchemeEvent {
  event: JiraEvent;
  notifications: JiraNotification[];
}

export interface JiraEvent {
  id: string;
  name?: string;
  description?: string;
}

export interface JiraNotification {
  type: 'CurrentAssignee' | 'Reporter' | 'CurrentUser' | 'ProjectLead' | 'ComponentLead' | 'User' | 'Group' | 'ProjectRole' | 'EmailAddress';
  parameter?: string;
  user?: JiraUser;
  group?: JiraGroup;
  projectRole?: JiraProjectRole;
  emailAddress?: string;
}

export interface JiraUser {
  accountId: string;
  displayName?: string;
  emailAddress?: string;
}

export interface JiraGroup {
  name: string;
  displayName?: string;
}

export interface JiraProjectRole {
  id: string;
  name: string;
  description?: string;
}

// Extended Screen types
export interface JiraScreenDetailed extends JiraScreen {
  tabs?: JiraScreenTab[];
}

export interface JiraScreenTab {
  id: string;
  name: string;
  fields?: JiraScreenField[];
}

export interface JiraScreenField {
  id: string;
  name?: string;
  type?: string;
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

// Jira Service Management (JSM) Types

export interface JiraServiceDesk {
  id: string;
  projectId: string;
  projectName: string;
  projectKey: string;
  _links: {
    self: string;
  };
}

export interface JiraRequestType {
  id: string;
  name: string;
  description?: string;
  helpText?: string;
  issueTypeId: string;
  serviceDeskId: string;
  groupIds?: string[];
  icon: {
    id: string;
    _links: {
      iconUrls: {
        '48x48': string;
        '24x24': string;
        '16x16': string;
        '32x32': string;
      };
    };
  };
  _links: {
    self: string;
  };
  _expands?: string[];
  fields?: JiraRequestTypeField[];
  practice?: string;
  currentStatus?: {
    status: string;
    statusDate: string;
  };
}

export interface JiraRequestTypeField {
  fieldId: string;
  name: string;
  description?: string;
  type: string;
  jiraSchema: {
    type: string;
    items?: string;
    system?: string;
    custom?: string;
    customId?: number;
  };
  required: boolean;
  defaultValues?: any[];
  validValues?: any[];
  presetValues?: any[];
  visible: boolean;
  _links?: {
    self: string;
  };
}

export interface JiraRequestTypeCreateRequest {
  name: string;
  description?: string;
  helpText?: string;
  issueTypeId: string;
  groupIds?: string[];
}


export interface JiraRequestTypeGroup {
  name: string;
  displayName?: string;
}

export interface JiraServiceDeskInfo extends JiraServiceDesk {
  _expands?: string[];
  requestTypeGroups?: JiraRequestTypeGroup[];
}

// JSM Customer Group types
export interface JiraCustomerGroup {
  name: string;
  displayName?: string;
  users?: JiraUser[];
}

// JSM Portal Settings
export interface JiraPortalSettings {
  enabled: boolean;
  name?: string;
  description?: string;
  signupMode?: 'public' | 'private';
}