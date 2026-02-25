export interface AuthConfig {
  type: 'basic' | 'oauth';
  baseUrl: string;
  email?: string;
  apiToken?: string;
  orgAdminToken?: string;
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

export interface JiraField {
  id: string;
  name: string;
  description?: string;
  type: string;
  isCustom: boolean;
  isArray?: boolean;
  schema?: {
    type: string;
    custom?: string;
    customId?: number;
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

export interface JiraCustomFieldOption {
  id: string;
  value: string;
  disabled?: boolean;
  optionId?: string;
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