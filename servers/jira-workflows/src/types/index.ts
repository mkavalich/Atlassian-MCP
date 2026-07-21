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

// Automation Rule Types
//
// Corrected against the live Jira Automation API (GET /rule/summary and
// GET /rule/{uuid}). The previous declaration contradicted the wire format on
// five fields: it declared `id` (the API returns `uuid`), `enabled: boolean`
// (the API returns state:'ENABLED'|'DISABLED'), separate `conditions[]` and
// `actions[]` (the API returns a single `components[]`), `created`/`updated` as
// strings (they are epoch-millisecond numbers) and `projects` (the API returns
// `ruleScopeARIs`). Every one of those reads would have been undefined.
export interface JiraAutomationRule {
  /** Primary identifier. Pass to get_automation_rule_details. There is no `id`. */
  uuid: string;
  name: string;
  description?: string | null;
  state: 'ENABLED' | 'DISABLED';
  /** Epoch milliseconds, not an ISO string. */
  created?: number;
  /** Epoch milliseconds, not an ISO string. */
  updated?: number;
  authorAccountId?: string;
  actorAccountId?: string;
  /** Only returned by GET /rule/{uuid}, never by the listing endpoint. */
  trigger?: JiraAutomationTrigger;
  /** Triggers, conditions and actions arrive as one flat list, not two arrays. */
  components?: JiraAutomationComponent[];
  /** Rule scope as Atlassian Resource Identifiers. */
  ruleScopeARIs?: string[];
}

/** A single entry of a rule's flat `components[]` list. */
export interface JiraAutomationComponent {
  component?: string;
  schemaVersion?: number;
  type?: string;
  value?: Record<string, any> | null;
  children?: JiraAutomationComponent[];
  conditions?: JiraAutomationComponent[];
  [key: string]: any;
}

export interface JiraAutomationTrigger {
  /** Raw API type identifier (e.g., jira.issue.event.trigger:created) or friendly name */
  type: string;
  component?: 'TRIGGER';
  schemaVersion?: number;
  value?: Record<string, any>;
  configuration?: {
    event?: string;
    fields?: string[];
    issueEvent?: string;
    jql?: string;
    cron?: string;
    interval?: number;
    [key: string]: any;
  };
  conditions?: any[];
  children?: any[];
}

export interface JiraAutomationCondition {
  /** Raw API type identifier (e.g., jira.jql.condition) or friendly name */
  type: string;
  component?: 'CONDITION' | 'CONDITION_BLOCK';
  schemaVersion?: number;
  value?: Record<string, any>;
  configuration?: {
    jql?: string;
    fields?: Array<{
      fieldId: string;
      fieldType: string;
      comparison: string;
      value: any;
    }>;
    user?: string;
    project?: string;
    script?: string;
    [key: string]: any;
  };
  children?: any[];
}

export interface JiraAutomationAction {
  /** Raw API type identifier (e.g., jira.issue.assign) or friendly name */
  type: string;
  component?: 'ACTION';
  schemaVersion?: number;
  value?: Record<string, any>;
  configuration?: {
    assignee?: string;
    transitionId?: string;
    fields?: Record<string, any>;
    comment?: string;
    message?: string;
    webhookUrl?: string;
    headers?: Record<string, string>;
    body?: string;
    linkType?: string;
    targetIssue?: string;
    [key: string]: any;
  };
  conditions?: any[];
  children?: any[];
}

export interface JiraAutomationTemplate {
  id: string;
  name: string;
  description?: string;
  category: string;
  trigger: JiraAutomationTrigger;
  conditions?: JiraAutomationCondition[];
  actions: JiraAutomationAction[];
  tags?: string[];
}

export interface JiraAutomationExecution {
  id: string;
  ruleId: string;
  ruleName: string;
  triggered: string;
  completed?: string;
  status: 'SUCCESS' | 'FAILED' | 'RUNNING' | 'CANCELLED';
  executionTime?: number;
  logs?: JiraAutomationExecutionLog[];
  context?: {
    issueId?: string;
    projectId?: string;
    userId?: string;
    [key: string]: any;
  };
}

export interface JiraAutomationExecutionLog {
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  message: string;
  component?: string;
  details?: any;
}

export interface CreateAutomationRuleRequest {
  name: string;
  description?: string;
  enabled?: boolean;
  trigger: JiraAutomationTrigger;
  conditions?: JiraAutomationCondition[];
  actions: JiraAutomationAction[];
  projects?: string[];
  tags?: string[];
}

export interface UpdateAutomationRuleRequest {
  name?: string;
  description?: string;
  enabled?: boolean;
  trigger?: JiraAutomationTrigger;
  conditions?: JiraAutomationCondition[];
  actions?: JiraAutomationAction[];
  projects?: string[];
  tags?: string[];
}