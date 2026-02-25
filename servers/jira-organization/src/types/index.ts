export interface AuthConfig {
  type: 'basic' | 'oauth';
  baseUrl: string;
  email?: string;
  apiToken?: string;
  orgAdminToken?: string;
  orgId?: string;
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

// Group 3: Cross-Product Analytics & Directory Health Types

// Compass API Types for Cross-Product Metrics
export interface CompassComponentMetric {
  id: string;
  componentId: string;
  componentName: string;
  teamId?: string;
  teamName?: string;
  metricDefinitionId: string;
  metricName: string;
  value: number | string;
  unit?: string;
  timestamp: string;
  period: string;
  trend?: 'up' | 'down' | 'stable';
  status?: 'healthy' | 'warning' | 'critical';
  links?: {
    component: string;
    team?: string;
    details: string;
  };
}

export interface CompassTeamMetric {
  id: string;
  teamId: string;
  teamName: string;
  metricDefinitionId: string;
  metricName: string;
  value: number | string;
  unit?: string;
  timestamp: string;
  period: string;
  componentCount: number;
  trend?: 'up' | 'down' | 'stable';
  status?: 'healthy' | 'warning' | 'critical';
  links?: {
    team: string;
    components: string;
    details: string;
  };
}

export interface CompassMetricsResponse {
  results: (CompassComponentMetric | CompassTeamMetric)[];
  totalCount: number;
  nextPageToken?: string;
  _links: {
    self: string;
    next?: string;
  };
}

export interface CompassSystemEvent {
  id: string;
  type: 'component.created' | 'component.updated' | 'component.deleted' | 
        'team.created' | 'team.updated' | 'team.deleted' |
        'metric.threshold.breached' | 'deployment.started' | 'deployment.completed' |
        'incident.created' | 'incident.resolved';
  timestamp: string;
  source: string;
  actor?: {
    type: 'user' | 'system' | 'service';
    id: string;
    name: string;
  };
  target: {
    type: 'component' | 'team' | 'metric' | 'deployment' | 'incident';
    id: string;
    name: string;
  };
  details: Record<string, any>;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  status?: 'active' | 'resolved' | 'acknowledged';
}

export interface CompassComponentEvent {
  id: string;
  componentId: string;
  componentName: string;
  type: 'deployment' | 'incident' | 'metric_breach' | 'health_check' | 'configuration_change';
  timestamp: string;
  source: string;
  actor?: {
    type: 'user' | 'system' | 'deployment';
    id: string;
    name: string;
  };
  details: Record<string, any>;
  severity?: 'info' | 'warning' | 'error' | 'critical';
  status?: 'active' | 'resolved' | 'investigating';
  links?: {
    component: string;
    details: string;
  };
}

export interface CompassEventsResponse {
  results: (CompassSystemEvent | CompassComponentEvent)[];
  totalCount: number;
  nextPageToken?: string;
  _links: {
    self: string;
    next?: string;
  };
}

// SCIM Directory Types for Directory Integration Health
export interface ScimDirectoryGroup {
  id: string;
  displayName: string;
  externalId?: string;
  members?: ScimDirectoryGroupMember[];
  meta: {
    resourceType: 'Group';
    created: string;
    lastModified: string;
    location: string;
    version: string;
  };
  schemas: string[];
  active?: boolean;
}

export interface ScimDirectoryGroupMember {
  value: string;
  display: string;
  type?: 'User';
  $ref?: string;
}

export interface ScimDirectoryGroupsResponse {
  schemas: string[];
  totalResults: number;
  startIndex: number;
  itemsPerPage: number;
  Resources: ScimDirectoryGroup[];
}

export interface ScimDirectorySchema {
  id: string;
  name: string;
  description?: string;
  attributes: ScimSchemaAttribute[];
  meta: {
    resourceType: 'Schema';
    location: string;
  };
}

export interface ScimSchemaAttribute {
  name: string;
  type: 'string' | 'boolean' | 'decimal' | 'integer' | 'dateTime' | 'reference' | 'complex';
  multiValued: boolean;
  description?: string;
  required: boolean;
  canonicalValues?: string[];
  caseExact?: boolean;
  mutability: 'readOnly' | 'readWrite' | 'immutable' | 'writeOnly';
  returned: 'always' | 'never' | 'default' | 'request';
  uniqueness?: 'none' | 'server' | 'global';
  subAttributes?: ScimSchemaAttribute[];
}

export interface ScimDirectorySchemasResponse {
  schemas: string[];
  totalResults: number;
  startIndex: number;
  itemsPerPage: number;
  Resources: ScimDirectorySchema[];
}

export interface ScimDirectoryResourceType {
  id: string;
  name: string;
  endpoint: string;
  description?: string;
  schema: string;
  schemaExtensions?: ScimSchemaExtension[];
  meta: {
    resourceType: 'ResourceType';
    location: string;
  };
}

export interface ScimSchemaExtension {
  schema: string;
  required: boolean;
}

export interface ScimDirectoryResourceTypesResponse {
  schemas: string[];
  totalResults: number;
  startIndex: number;
  itemsPerPage: number;
  Resources: ScimDirectoryResourceType[];
}

// Organization API Types
export interface AtlassianOrganization {
  id: string;
  name: string;
  slug: string;
  type: 'standard' | 'enterprise';
  status: 'active' | 'suspended' | 'deleted';
  createdAt: string;
  updatedAt: string;
  billing?: {
    planType: string;
    planName: string;
    billingCycle: 'monthly' | 'annual';
    nextBillingDate?: string;
    seats?: {
      total: number;
      used: number;
      available: number;
    };
  };
  domains?: OrganizationDomain[];
  policies?: OrganizationPolicy[];
  features?: string[];
  _links: {
    self: string;
    avatar?: string;
  };
}

export interface OrganizationDomain {
  id: string;
  domain: string;
  verified: boolean;
  verifiedAt?: string;
  status: 'pending' | 'verified' | 'failed' | 'expired';
  type: 'primary' | 'secondary';
}

export interface OrganizationPolicy {
  id: string;
  name: string;
  type: 'sso' | 'user_management' | 'security' | 'data_residency';
  enabled: boolean;
  configuration: Record<string, any>;
  lastModified: string;
  modifiedBy: string;
}

export interface AtlassianOrganizationsResponse {
  data: AtlassianOrganization[];
  links: {
    self: string;
    next?: string;
    prev?: string;
  };
  meta: {
    total: number;
    page: number;
    pageSize: number;
  };
}

export interface OrganizationDetails extends AtlassianOrganization {
  statistics?: {
    totalUsers: number;
    activeUsers: number;
    products: {
      jira: {
        users: number;
        sites: number;
      };
      confluence: {
        users: number;
        sites: number;
      };
      bitbucket: {
        users: number;
        workspaces: number;
      };
    };
  };
  audit?: {
    lastActivity: string;
    eventTypes: string[];
    retentionDays: number;
  };
  compliance?: {
    gdprCompliant: boolean;
    soc2Certified: boolean;
    iso27001Certified: boolean;
    dataResidency: string[];
  };
}