import { z } from 'zod';

// Project schemas
export const createProjectSchema = z.object({
  name: z.string().min(1).max(255).describe('The name of the project'),
  key: z.string().max(255)
    .min(2)
    .max(10)
    .regex(/^[A-Z][A-Z0-9]*$/, 'Project key must start with a letter and contain only uppercase letters and numbers')
    .describe('The project key (2-10 uppercase letters/numbers)'),
  projectTypeKey: z.enum(['business', 'software', 'service_desk'])
    .describe('The type of project to create'),
  description: z.string().max(32768).optional().describe('The description of the project'),
  leadAccountId: z.string().max(10000).describe('The account ID of the project lead'),
  assigneeType: z.enum(['PROJECT_LEAD', 'UNASSIGNED']).optional()
    .describe('The default assignee for issues created in this project'),
  url: z.string().url().optional().describe('A URL for the project'),
  avatarId: z.number().optional().describe('The ID of the project avatar'),
  // Enhanced parameters for project templates and configuration
  projectTemplateKey: z.string().max(10000).optional()
    .describe('The template key to use for project creation (e.g., com.pyxis.greenhopper.jira:gh-simplified-agility-kanban, com.pyxis.greenhopper.jira:gh-simplified-agility-scrum)'),
  categoryId: z.number().optional()
    .describe('The ID of the project category to assign'),
  notificationScheme: z.number().optional()
    .describe('The ID of the notification scheme to apply'),
  permissionScheme: z.number().optional()
    .describe('The ID of the permission scheme to apply'),
  issueSecurityScheme: z.number().optional()
    .describe('The ID of the issue security scheme to apply'),
}).strict();

export const updateProjectSchema = z.object({
  projectIdOrKey: z.string().max(10000).describe('The project ID or key'),
  name: z.string().min(1).max(255).optional().describe('The new name of the project'),
  key: z.string().max(255)
    .min(2)
    .max(10)
    .regex(/^[A-Z][A-Z0-9]*$/)
    .optional()
    .describe('The new project key'),
  description: z.string().max(32768).optional().describe('The new description of the project'),
  leadAccountId: z.string().max(10000).optional().describe('The new project lead account ID'),
  assigneeType: z.enum(['PROJECT_LEAD', 'UNASSIGNED']).optional()
    .describe('The new default assignee type'),
  url: z.string().url().optional().describe('The new project URL'),
  avatarId: z.number().optional().describe('The new avatar ID'),
  // Enhanced parameters for project configuration updates
  categoryId: z.number().optional()
    .describe('The ID of the project category to assign'),
  notificationScheme: z.number().optional()
    .describe('The ID of the notification scheme to apply'),
  permissionScheme: z.number().optional()
    .describe('The ID of the permission scheme to apply'),
  issueSecurityScheme: z.number().optional()
    .describe('The ID of the issue security scheme to apply'),
}).strict();

export const getProjectSchema = z.object({
  projectIdOrKey: z.string().max(10000).describe('The project ID or key'),
  expand: z.string().max(10000).optional()
    .describe('Comma-separated list of fields to expand (e.g., description,lead,url,projectKeys,permissions,issueTypes,issueTypeHierarchy)'),
}).strict();

export const deleteProjectSchema = z.object({
  projectIdOrKey: z.string().max(10000).describe('The project ID or key'),
  enableUndo: z.boolean().optional().default(false)
    .describe('Whether to enable undo for this deletion'),
}).strict();

export const searchProjectsSchema = z.object({
  query: z.string().max(10000).optional().describe('Filter projects by name or key (partial matches supported)'),
  typeKey: z.string().max(10000).optional().describe('Filter projects by project type key (business, software, service_desk)'),
  categoryId: z.number().optional().describe('Filter projects by project category ID'),
  action: z.enum(['view', 'browse', 'edit']).optional().describe('Filter projects by the actions you can perform'),
  expand: z.string().max(10000).optional().describe('Comma-separated list of fields to expand (e.g., description,lead,url,projectKeys,permissions)'),
  orderBy: z.enum(['category', 'issueCount', 'key', 'lastIssueUpdatedTime', 'name', 'owner', 'archivedDate', 'deletedDate'])
    .optional().describe('Sort the results by the specified field'),
  startAt: z.number().min(0).optional().default(0).describe('The starting index for results (pagination)'),
  maxResults: z.number().min(1).max(100).optional().default(50).describe('The maximum number of results to return (max 100)'),
}).strict();

// Status schemas (Discovery tool for workflow creation)
export const getStatusesSchema = z.object({
  expand: z.string().max(10000).optional()
    .describe('Comma-separated list of fields to expand (e.g., usages)'),
}).strict();

// Workflow schemas
export const getWorkflowsSchema = z.object({
  workflowName: z.string().max(255).optional().describe('Filter by workflow name'),
  expand: z.string().max(10000).optional()
    .describe('Comma-separated list of fields to expand (e.g., transitions,statuses)'),
}).strict();

export const createWorkflowSchema = z.object({
  name: z.string().min(1).max(255).describe('The name of the workflow'),
  description: z.string().max(32768).optional().describe('The description of the workflow'),
  transitions: z.array(z.object({
    name: z.string().max(255).describe('The name of the transition'),
    from: z.array(z.string()).describe('Status IDs this transition can start from (use empty array [] for initial transition)'),
    to: z.string().max(10000).describe('The status ID this transition leads to'),
    conditions: z.array(z.unknown()).optional().describe('Conditions that must be met'),
    validators: z.array(z.unknown()).optional().describe('Validators for the transition'),
    postFunctions: z.array(z.unknown()).optional().describe('Post functions to execute'),
  }).strict()).min(1).describe('The transitions in the workflow'),
  statuses: z.array(z.object({
    id: z.string().max(10000).describe('Unique reference ID for this status (used in transitions)'),
    name: z.string().max(255).describe('Display name of the status'),
    statusCategory: z.enum(['TODO', 'IN_PROGRESS', 'DONE']).describe('Status category: TODO, IN_PROGRESS, or DONE'),
  }).strict()).min(1).describe('The statuses used in the workflow'),
}).strict();

export const deleteWorkflowSchema = z.object({
  entityId: z.string().max(255).describe('The entity ID of the workflow to delete (UUID format). Use get_workflows to find this.'),
}).strict();

// Guided Workflow setup schema (strict validation for setup_workflow_guided)
export const setupWorkflowGuidedSchema = z.object({
  name: z.string().min(1).max(255).describe('Name for the new workflow (must be unique)'),
  description: z.string().max(1000).describe('Description of what this workflow will do'),
  projectKey: z.string().max(10000)
    .regex(/^[A-Za-z][A-Za-z0-9_]{1,255}$/, 'invalid project key')
    .optional()
    .describe('Project key where this workflow will be used (optional - for validation)'),
  workflowType: z.enum(['simple', 'development', 'sdlc', 'support', 'custom'])
    .describe('Workflow template type'),
  customStatuses: z.array(z.object({
    name: z.string().min(1).max(255).describe('Status name'),
    category: z.enum(['TODO', 'IN_PROGRESS', 'DONE']).describe('Status category'),
  }).strict()).max(100).optional().describe('Custom status list (required if workflowType is "custom")'),
  issueTypes: z.array(z.string().max(255)).max(100).optional()
    .describe('Issue type names that should use this workflow (optional - for scheme creation)'),
}).strict();

// Permission scheme schemas
export const getPermissionSchemesSchema = z.object({
  expand: z.string().max(10000).optional()
    .describe('Comma-separated list of fields to expand (e.g., permissions,user,group,projectRole,field,all)'),
}).strict();

export const createPermissionSchemeSchema = z.object({
  name: z.string().min(1).max(255).describe('The name of the permission scheme'),
  description: z.string().max(32768).optional().describe('The description of the permission scheme'),
  permissions: z.array(z.object({
    permission: z.string().max(10000).describe('The permission key'),
    holder: z.object({
      type: z.enum(['anyone', 'assignee', 'reporter', 'group', 'projectRole', 'user', 'applicationRole'])
        .describe('The type of permission holder'),
      parameter: z.string().max(10000).optional()
        .describe('The parameter for the holder type (e.g., group name, role ID)'),
    }).strict(),
  }).strict()).optional().describe('The permissions to grant in this scheme'),
}).strict();

export const assignPermissionSchemeToProjectSchema = z.object({
  projectIdOrKey: z.string().max(10000).describe('The project ID or key'),
  schemeId: z.coerce.number().describe('The ID of the permission scheme to assign'),
}).strict();

export const updatePermissionSchemeSchema = z.object({
  schemeId: z.coerce.number().describe('The ID of the permission scheme to update'),
  name: z.string().min(1).max(255).optional().describe('The new name of the permission scheme'),
  description: z.string().max(32768).optional().describe('The new description of the permission scheme'),
}).strict();

export const deletePermissionSchemeSchema = z.object({
  schemeId: z.coerce.number().describe('The ID of the permission scheme to delete'),
}).strict();

export const getPermissionGrantsSchema = z.object({
  schemeId: z.coerce.number().describe('The ID of the permission scheme'),
  expand: z.string().max(10000).optional()
    .describe('Comma-separated list of fields to expand'),
}).strict();

export const createPermissionGrantSchema = z.object({
  schemeId: z.coerce.number().describe('The ID of the permission scheme'),
  permission: z.string().max(10000).describe('The permission key (e.g., BROWSE_PROJECTS, CREATE_ISSUES, etc.)'),
  holder: z.object({
    type: z.enum(['anyone', 'assignee', 'reporter', 'group', 'projectRole', 'user', 'applicationRole'])
      .describe('The type of permission holder'),
    parameter: z.string().max(10000).optional()
      .describe('The parameter for the holder type (e.g., group name, role ID)'),
  }).strict(),
}).strict();

export const deletePermissionGrantSchema = z.object({
  schemeId: z.coerce.number().describe('The ID of the permission scheme'),
  permissionId: z.coerce.number().describe('The ID of the permission grant to delete'),
}).strict();

// Field schemas
export const getFieldsSchema = z.object({
  type: z.enum(['custom', 'system', 'all']).optional().default('all')
    .describe('Filter fields by type'),
}).strict();

export const getFieldsInputSchema = {
  type: z.enum(['custom', 'system', 'all']).optional().default('all')
    .describe('Filter fields by type'),
};

export const createCustomFieldSchema = z.object({
  name: z.string().min(1).max(255).describe('The name of the custom field'),
  description: z.string().max(32768).optional().describe('The description of the custom field'),
  type: z.string().max(10000).describe('The type of the custom field (e.g., com.atlassian.jira.plugin.system.customfieldtypes:textfield)'),
  searcherKey: z.string().max(10000).optional()
    .describe('The searcher key for the custom field (e.g., com.atlassian.jira.plugin.system.customfieldtypes:textsearcher)'),
}).strict();

export const updateCustomFieldSchema = z.object({
  fieldId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the custom field'),
  name: z.string().min(1).max(255).optional().describe('The new name of the field'),
  description: z.string().max(32768).optional().describe('The new description of the field'),
}).strict();

export const deleteCustomFieldSchema = z.object({
  fieldId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the custom field to delete'),
}).strict();

export const deleteCustomFieldInputSchema = {
  fieldId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the custom field to delete'),
};

// Search schemas
export const searchJQLSchema = z.object({
  jql: z.string().max(10000).describe('The JQL query string'),
  startAt: z.number().optional().default(0).describe('The starting index for results'),
  maxResults: z.number().max(100).optional().default(50)
    .describe('The maximum number of results to return'),
  fields: z.array(z.string()).optional()
    .describe('The list of fields to return for each issue'),
  expand: z.string().max(10000).optional()
    .describe('Comma-separated list of fields to expand'),
  validateQuery: z.enum(['strict', 'warn', 'none']).optional().default('strict')
    .describe('How to validate the JQL query'),
}).strict();

// Filter schemas
export const createFilterSchema = z.object({
  name: z.string().min(1).max(255).describe('The name of the filter'),
  description: z.string().max(32768).optional().describe('The description of the filter'),
  jql: z.string().max(10000).describe('The JQL query for the filter'),
  favourite: z.boolean().optional().default(false).describe('Whether the filter is marked as favourite'),
  sharePermissions: z.array(z.object({
    type: z.enum(['global', 'project', 'group', 'authenticated', 'user'])
      .describe('The type of share permission'),
    project: z.object({
      id: z.string().max(10000).optional(),
      key: z.string().max(255).optional(),
    }).strict().optional().describe('Project details for project type permissions'),
    group: z.object({
      name: z.string().max(255),
    }).strict().optional().describe('Group details for group type permissions'),
    user: z.object({
      accountId: z.string().max(10000),
    }).strict().optional().describe('User details for user type permissions'),
  }).strict()).optional().describe('Share permissions for the filter'),
}).strict();

// Issue Type Scheme schemas
export const getIssueTypeSchemesSchema = z.object({
  startAt: z.number().optional().default(0).describe('The starting index for results'),
  maxResults: z.number().max(100).optional().default(50)
    .describe('The maximum number of results to return'),
  expand: z.string().max(10000).optional()
    .describe('Comma-separated list of fields to expand (e.g., issueTypes)'),
}).strict();

export const createIssueTypeSchemeSchema = z.object({
  name: z.string().min(1).max(255).describe('The name of the issue type scheme'),
  description: z.string().max(32768).optional().describe('The description of the issue type scheme'),
  issueTypeIds: z.array(z.string()).describe('Array of issue type IDs to include in the scheme'),
  defaultIssueTypeId: z.string().max(10000).describe('The ID of the default issue type for this scheme'),
}).strict();

export const updateIssueTypeSchemeSchema = z.object({
  schemeId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the issue type scheme to update'),
  name: z.string().min(1).max(255).optional().describe('The new name of the issue type scheme'),
  description: z.string().max(32768).optional().describe('The new description of the issue type scheme'),
}).strict();

export const deleteIssueTypeSchemeSchema = z.object({
  schemeId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the issue type scheme to delete'),
}).strict();

// Issue Type Screen Scheme schemas
export const getIssueTypeScreenSchemesSchema = z.object({
  startAt: z.number().optional().default(0).describe('The starting index for results'),
  maxResults: z.number().max(100).optional().default(50)
    .describe('The maximum number of results to return'),
  expand: z.string().max(10000).optional()
    .describe('Comma-separated list of fields to expand (e.g., issueTypeMappings)'),
}).strict();

export const createIssueTypeScreenSchemeSchema = z.object({
  name: z.string().min(1).max(255).describe('The name of the issue type screen scheme'),
  description: z.string().max(32768).optional().describe('The description of the issue type screen scheme'),
  issueTypeMappings: z.array(z.object({
    issueTypeId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the issue type'),
    screenSchemeId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the screen scheme to associate'),
  }).strict()).describe('Mappings between issue types and screen schemes'),
}).strict();

// Screen Scheme schemas
export const getScreenSchemesSchema = z.object({
  startAt: z.number().optional().default(0).describe('The starting index for results'),
  maxResults: z.number().max(100).optional().default(50)
    .describe('The maximum number of results to return'),
  expand: z.string().max(10000).optional()
    .describe('Comma-separated list of fields to expand (e.g., screens)'),
}).strict();

export const createScreenSchemeSchema = z.object({
  name: z.string().min(1).max(255).describe('The name of the screen scheme'),
  description: z.string().max(32768).optional().describe('The description of the screen scheme'),
  screens: z.object({
    default: z.string().max(10000).describe('The ID of the default screen'),
    create: z.string().max(10000).optional().describe('The ID of the create screen'),
    edit: z.string().max(10000).optional().describe('The ID of the edit screen'),
    view: z.string().max(10000).optional().describe('The ID of the view screen'),
  }).strict().describe('Screen mappings for different operations'),
}).strict();

export const updateScreenSchemeSchema = z.object({
  screenSchemeId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the screen scheme to update'),
  name: z.string().min(1).max(255).optional().describe('The new name of the screen scheme'),
  description: z.string().max(32768).optional().describe('The new description of the screen scheme'),
  screens: z.object({
    default: z.string().max(10000).optional().describe('The ID of the default screen'),
    create: z.string().max(10000).optional().describe('The ID of the create screen'),
    edit: z.string().max(10000).optional().describe('The ID of the edit screen'),
    view: z.string().max(10000).optional().describe('The ID of the view screen'),
  }).strict().optional().describe('Screen mappings for different operations'),
}).strict();

// Audit schemas
export const getAuditRecordsSchema = z.object({
  offset: z.number().optional().default(0).describe('The starting index for results'),
  limit: z.number().max(1000).optional().default(100)
    .describe('The maximum number of audit records to return'),
  filter: z.string().max(10000).optional()
    .describe('The filter for audit records (e.g., created > -1d)'),
  from: z.string().max(10000).optional()
    .describe('The start date for audit records (ISO 8601 format)'),
  to: z.string().max(10000).optional()
    .describe('The end date for audit records (ISO 8601 format)'),
}).strict();

// Custom Field Context schemas
export const getCustomFieldContextsSchema = z.object({
  fieldId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the custom field'),
  startAt: z.number().optional().default(0).describe('The starting index for results'),
  maxResults: z.number().max(100).optional().default(50)
    .describe('The maximum number of results to return'),
}).strict();

export const createCustomFieldContextSchema = z.object({
  fieldId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the custom field'),
  name: z.string().min(1).max(255).describe('The name of the context'),
  description: z.string().max(32768).optional().describe('The description of the context'),
  projectIds: z.array(z.string()).optional()
    .describe('Array of project IDs to scope this context to (empty for global)'),
  issueTypeIds: z.array(z.string()).optional()
    .describe('Array of issue type IDs to scope this context to (empty for all issue types)'),
}).strict();

export const updateCustomFieldContextSchema = z.object({
  fieldId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the custom field'),
  contextId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the context to update'),
  name: z.string().min(1).max(255).optional().describe('The new name of the context'),
  description: z.string().max(32768).optional().describe('The new description of the context'),
}).strict();

export const deleteCustomFieldContextSchema = z.object({
  fieldId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the custom field'),
  contextId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the context to delete'),
}).strict();

export const getCustomFieldOptionsSchema = z.object({
  fieldId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the custom field'),
  contextId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the context'),
  startAt: z.number().optional().default(0).describe('The starting index for results'),
  maxResults: z.number().max(100).optional().default(50)
    .describe('The maximum number of results to return'),
}).strict();

export const createCustomFieldOptionsSchema = z.object({
  fieldId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the custom field'),
  contextId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the context'),
  options: z.array(z.object({
    value: z.string().min(1).max(32768).describe('The value of the option'),
    disabled: z.boolean().optional().default(false).describe('Whether the option is disabled'),
  }).strict()).min(1).describe('Array of options to create'),
}).strict();

// Field Configuration schemas
export const getFieldConfigurationsSchema = z.object({
  startAt: z.number().optional().default(0).describe('The starting index for results'),
  maxResults: z.number().max(100).optional().default(50)
    .describe('The maximum number of results to return'),
}).strict();

export const createFieldConfigurationSchema = z.object({
  name: z.string().min(1).max(255).describe('The name of the field configuration'),
  description: z.string().max(32768).optional().describe('The description of the field configuration'),
}).strict();

export const updateFieldConfigurationSchema = z.object({
  id: z.coerce.number().describe('The ID of the field configuration to update'),
  name: z.string().min(1).max(255).optional().describe('The new name of the field configuration'),
  description: z.string().max(32768).optional().describe('The new description of the field configuration'),
}).strict();

export const getFieldConfigurationSchemesSchema = z.object({
  startAt: z.number().optional().default(0).describe('The starting index for results'),
  maxResults: z.number().max(100).optional().default(50)
    .describe('The maximum number of results to return'),
}).strict();

export const createFieldConfigurationSchemeSchema = z.object({
  name: z.string().min(1).max(255).describe('The name of the field configuration scheme'),
  description: z.string().max(32768).optional().describe('The description of the field configuration scheme'),
  fieldConfigurationMappings: z.array(z.object({
    issueTypeId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the issue type'),
    fieldConfigurationId: z.coerce.number().describe('The ID of the field configuration'),
  }).strict()).optional().describe('Mappings between issue types and field configurations'),
}).strict();

// Notification Scheme schemas
export const getNotificationSchemesSchema = z.object({
  startAt: z.number().optional().default(0).describe('The starting index for results'),
  maxResults: z.number().max(100).optional().default(50)
    .describe('The maximum number of results to return'),
  expand: z.string().max(10000).optional()
    .describe('Comma-separated list of fields to expand (e.g., notificationSchemeEvents)'),
}).strict();

export const createNotificationSchemeSchema = z.object({
  name: z.string().min(1).max(255).describe('The name of the notification scheme'),
  description: z.string().max(32768).optional().describe('The description of the notification scheme'),
  notificationSchemeEvents: z.array(z.object({
    event: z.object({
      id: z.string().max(10000).describe('The ID of the event'),
    }).strict().describe('The event details'),
    notifications: z.array(z.object({
      type: z.enum(['CurrentAssignee', 'Reporter', 'CurrentUser', 'ProjectLead', 'ComponentLead', 'User', 'Group', 'ProjectRole', 'EmailAddress'])
        .describe('The type of notification'),
      parameter: z.string().max(10000).optional()
        .describe('The parameter for the notification type (e.g., user ID, group name, role ID, email address)'),
    }).strict()).describe('Array of notifications for this event'),
  }).strict()).optional().describe('Array of event notifications for the scheme'),
}).strict();

// Screen schemas
export const getScreensSchema = z.object({
  startAt: z.number().optional().default(0).describe('The starting index for results'),
  maxResults: z.number().max(100).optional().default(50)
    .describe('The maximum number of results to return'),
  expand: z.string().max(10000).optional()
    .describe('Comma-separated list of fields to expand (e.g., tabs)'),
}).strict();

export const createScreenSchema = z.object({
  name: z.string().min(1).max(255).describe('The name of the screen'),
  description: z.string().max(32768).optional().describe('The description of the screen'),
  tabs: z.array(z.object({
    name: z.string().min(1).max(255).describe('The name of the tab'),
    fields: z.array(z.object({
      id: z.string().max(10000).describe('The ID of the field to add to the tab'),
    }).strict()).optional().describe('Array of fields for this tab'),
  }).strict()).optional().describe('Array of tabs for the screen'),
}).strict();

export const addFieldToScreenSchema = z.object({
  screenId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the screen'),
  tabId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the tab'),
  fieldId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the field to add'),
}).strict();

// Dashboard schemas
export const getDashboardsSchema = z.object({
  startAt: z.number().optional().default(0).describe('The starting index for results'),
  maxResults: z.number().max(100).optional().default(50)
    .describe('The maximum number of results to return'),
  filter: z.enum(['favourite', 'my', 'all']).optional().default('all')
    .describe('Filter dashboards by type'),
}).strict();

export const createDashboardSchema = z.object({
  name: z.string().min(1).max(255).describe('The name of the dashboard'),
  description: z.string().max(32768).optional().describe('The description of the dashboard'),
  sharePermissions: z.array(z.object({
    type: z.enum(['global', 'project', 'group', 'authenticated', 'user'])
      .describe('The type of share permission'),
    project: z.object({
      id: z.string().max(10000).optional(),
      key: z.string().max(255).optional(),
    }).strict().optional().describe('Project details for project type permissions'),
    group: z.object({
      name: z.string().max(255),
    }).strict().optional().describe('Group details for group type permissions'),
    user: z.object({
      accountId: z.string().max(10000),
    }).strict().optional().describe('User details for user type permissions'),
  }).strict()).optional().describe('Share permissions for the dashboard'),
}).strict();

export const getDashboardGadgetsSchema = z.object({
  dashboardId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the dashboard'),
  moduleKey: z.string().max(10000).optional()
    .describe('Filter gadgets by module key'),
  uri: z.string().max(10000).optional()
    .describe('Filter gadgets by URI'),
  gadgetId: z.array(z.string()).optional()
    .describe('Filter gadgets by gadget IDs'),
}).strict();

export const addGadgetToDashboardSchema = z.object({
  dashboardId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the dashboard'),
  title: z.string().max(255).optional().describe('The title of the gadget'),
  color: z.enum(['blue', 'red', 'yellow', 'green', 'cyan', 'purple', 'gray', 'white'])
    .optional().default('blue').describe('The color of the gadget'),
  position: z.object({
    column: z.number().min(0).max(1).describe('The column position (0 for left, 1 for right)'),
    row: z.number().min(0).describe('The row position within the column'),
  }).strict().describe('The position of the gadget on the dashboard'),
  gadgetURI: z.string().max(10000).describe('The URI of the gadget module'),
  properties: z.record(z.string(), z.unknown()).optional()
    .describe('Properties and configuration for the gadget'),
}).strict();

// Workflow Scheme schemas
export const getWorkflowSchemesSchema = z.object({
  startAt: z.number().optional().default(0).describe('The starting index for results'),
  maxResults: z.number().max(100).optional().default(50)
    .describe('The maximum number of results to return'),
  expand: z.string().max(10000).optional()
    .describe('Comma-separated list of fields to expand (e.g., workflows,projects)'),
}).strict();

export const createWorkflowSchemeSchema = z.object({
  name: z.string().min(1).max(255).describe('The name of the workflow scheme'),
  description: z.string().max(32768).optional().describe('The description of the workflow scheme'),
  defaultWorkflow: z.string().max(10000).optional()
    .describe('The name of the default workflow for this scheme'),
  issueTypeMappings: z.array(z.object({
    issueType: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the issue type'),
    workflow: z.string().max(10000).describe('The name of the workflow to map to this issue type'),
  }).strict()).optional().describe('Mappings between issue types and workflows'),
}).strict();

export const updateWorkflowSchemeSchema = z.object({
  schemeId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the workflow scheme to update'),
  name: z.string().min(1).max(255).optional().describe('The new name of the workflow scheme'),
  description: z.string().max(32768).optional().describe('The new description of the workflow scheme'),
  defaultWorkflow: z.string().max(10000).optional()
    .describe('The name of the new default workflow for this scheme'),
}).strict();

export const deleteWorkflowSchemeSchema = z.object({
  schemeId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the workflow scheme to delete'),
}).strict();

export const assignWorkflowSchemeToProjectSchema = z.object({
  projectIdOrKey: z.string().max(10000).describe('The project ID or key'),
  schemeId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the workflow scheme to assign'),
}).strict();

export const getWorkflowSchemeProjectsSchema = z.object({
  schemeId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the workflow scheme'),
}).strict();

export const getWorkflowSchemeIssueTypesSchema = z.object({
  schemeId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the workflow scheme'),
}).strict();

export const setWorkflowSchemeIssueTypeSchema = z.object({
  schemeId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the workflow scheme'),
  issueType: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the issue type'),
  workflow: z.string().max(10000).describe('The name of the workflow to assign to this issue type'),
}).strict();

export const deleteWorkflowSchemeIssueTypeSchema = z.object({
  schemeId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the workflow scheme'),
  issueType: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the issue type to remove from the scheme'),
}).strict();

// Individual Issue Type schemas
export const getIssueTypesSchema = z.object({
  expand: z.string().max(10000).optional()
    .describe('Comma-separated list of fields to expand'),
}).strict();

export const createIssueTypeSchema = z.object({
  name: z.string().min(1).max(255).describe('The name of the issue type'),
  description: z.string().max(32768).optional().describe('The description of the issue type'),
  type: z.enum(['subtask', 'standard']).optional().default('standard')
    .describe('The type of issue type'),
  avatarId: z.number().optional().describe('The ID of the avatar for the issue type'),
}).strict();

export const updateIssueTypeSchema = z.object({
  issueTypeId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the issue type to update'),
  name: z.string().min(1).max(255).optional().describe('The new name of the issue type'),
  description: z.string().max(32768).optional().describe('The new description of the issue type'),
  avatarId: z.number().optional().describe('The new avatar ID for the issue type'),
}).strict();

export const deleteIssueTypeSchema = z.object({
  issueTypeId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the issue type to delete'),
  alternativeIssueTypeId: z.string().max(10000).optional()
    .describe('The ID of the issue type to replace issues with (if any exist)'),
}).strict();

// Enhanced Issue Type Screen Scheme schemas
export const updateIssueTypeScreenSchemeSchema = z.object({
  schemeId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the issue type screen scheme to update'),
  name: z.string().min(1).max(255).optional().describe('The new name of the scheme'),
  description: z.string().max(32768).optional().describe('The new description of the scheme'),
}).strict();

export const deleteIssueTypeScreenSchemeSchema = z.object({
  schemeId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the issue type screen scheme to delete'),
}).strict();

export const getIssueTypeScreenSchemeProjectsSchema = z.object({
  schemeId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the issue type screen scheme'),
  startAt: z.number().optional().default(0).describe('The starting index for results'),
  maxResults: z.number().max(100).optional().default(50)
    .describe('The maximum number of results to return'),
}).strict();

export const assignIssueTypeScreenSchemeToProjectSchema = z.object({
  projectIdOrKey: z.string().max(10000).describe('The project ID or key'),
  schemeId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the issue type screen scheme to assign'),
}).strict();

// Issue Type Screen Scheme Mapping schemas
export const addIssueTypeScreenSchemeMappingsSchema = z.object({
  schemeId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the issue type screen scheme'),
  issueTypeMappings: z.array(z.object({
    issueTypeId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the issue type'),
    screenSchemeId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the screen scheme to associate'),
  }).strict()).min(1).describe('Array of new issue type to screen scheme mappings to add'),
}).strict();

export const removeIssueTypeScreenSchemeMappingsSchema = z.object({
  schemeId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the issue type screen scheme'),
  issueTypeIds: z.array(z.string()).min(1).describe('Array of issue type IDs to remove mappings for'),
}).strict();

export const updateIssueTypeScreenSchemeDefaultSchema = z.object({
  schemeId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the issue type screen scheme'),
  screenSchemeId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the screen scheme to set as default'),
}).strict();

export const updateIssueTypeScreenSchemeMappingSchema = z.object({
  schemeId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the issue type screen scheme'),
  issueTypeId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the issue type to update mapping for'),
  screenSchemeId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the screen scheme to associate with this issue type'),
}).strict();

// Enhanced Screen schemas
export const deleteScreenSchemeSchema = z.object({
  screenSchemeId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the screen scheme to delete'),
}).strict();

export const updateScreenSchema = z.object({
  screenId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the screen to update'),
  name: z.string().min(1).max(255).optional().describe('The new name of the screen'),
  description: z.string().max(32768).optional().describe('The new description of the screen'),
}).strict();

export const deleteScreenSchema = z.object({
  screenId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the screen to delete'),
}).strict();

export const getScreenTabsSchema = z.object({
  screenId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the screen'),
  projectKey: z.string().max(10000).optional().describe('The project key for context'),
}).strict();

export const createScreenTabSchema = z.object({
  screenId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the screen'),
  name: z.string().min(1).max(255).describe('The name of the tab'),
}).strict();

export const updateScreenTabSchema = z.object({
  screenId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the screen'),
  tabId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the tab to update'),
  name: z.string().min(1).max(255).describe('The new name of the tab'),
}).strict();

export const deleteScreenTabSchema = z.object({
  screenId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the screen'),
  tabId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the tab to delete'),
}).strict();

export const getScreenTabFieldsSchema = z.object({
  screenId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the screen'),
  tabId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the tab'),
  projectKey: z.string().max(10000).optional().describe('The project key for context'),
}).strict();

export const removeFieldFromScreenTabSchema = z.object({
  screenId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the screen'),
  tabId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the tab'),
  fieldId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the field to remove'),
}).strict();

export const moveScreenTabFieldSchema = z.object({
  screenId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the screen'),
  tabId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the tab'),
  fieldId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the field to move'),
  after: z.string().max(10000).optional().describe('The ID of the field to move after (if not specified, moves to beginning)'),
  position: z.enum(['Earlier', 'Later', 'First', 'Last']).optional()
    .describe('The position to move the field to'),
}).strict();

export const addFieldToDefaultScreenSchema = z.object({
  fieldId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the field to add to the default screen'),
}).strict();

export const getScreenAvailableFieldsSchema = z.object({
  screenId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the screen'),
}).strict();

// Enhanced Dashboard schemas
export const getDashboardSchema = z.object({
  dashboardId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the dashboard'),
}).strict();

export const updateDashboardSchema = z.object({
  dashboardId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the dashboard to update'),
  name: z.string().min(1).max(255).optional().describe('The new name of the dashboard'),
  description: z.string().max(32768).optional().describe('The new description of the dashboard'),
  sharePermissions: z.array(z.object({
    type: z.enum(['global', 'project', 'group', 'authenticated', 'user'])
      .describe('The type of share permission'),
    project: z.object({
      id: z.string().max(10000).optional(),
      key: z.string().max(255).optional(),
    }).strict().optional().describe('Project details for project type permissions'),
    group: z.object({
      name: z.string().max(255),
    }).strict().optional().describe('Group details for group type permissions'),
    user: z.object({
      accountId: z.string().max(10000),
    }).strict().optional().describe('User details for user type permissions'),
  }).strict()).optional().describe('Share permissions for the dashboard'),
}).strict();

export const deleteDashboardSchema = z.object({
  dashboardId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the dashboard to delete'),
}).strict();

export const copyDashboardSchema = z.object({
  dashboardId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the dashboard to copy'),
  name: z.string().min(1).max(255).describe('The name for the new dashboard copy'),
  description: z.string().max(32768).optional().describe('The description for the new dashboard copy'),
  sharePermissions: z.array(z.object({
    type: z.enum(['global', 'project', 'group', 'authenticated', 'user'])
      .describe('The type of share permission'),
    project: z.object({
      id: z.string().max(10000).optional(),
      key: z.string().max(255).optional(),
    }).strict().optional().describe('Project details for project type permissions'),
    group: z.object({
      name: z.string().max(255),
    }).strict().optional().describe('Group details for group type permissions'),
    user: z.object({
      accountId: z.string().max(10000),
    }).strict().optional().describe('User details for user type permissions'),
  }).strict()).optional().describe('Share permissions for the new dashboard'),
}).strict();

export const updateDashboardGadgetSchema = z.object({
  dashboardId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the dashboard'),
  gadgetId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the gadget to update'),
  title: z.string().max(255).optional().describe('The new title of the gadget'),
  color: z.enum(['blue', 'red', 'yellow', 'green', 'cyan', 'purple', 'gray', 'white'])
    .optional().describe('The new color of the gadget'),
  position: z.object({
    column: z.number().min(0).max(1).describe('The column position (0 for left, 1 for right)'),
    row: z.number().min(0).describe('The row position within the column'),
  }).strict().optional().describe('The new position of the gadget on the dashboard'),
  properties: z.record(z.string(), z.unknown()).optional()
    .describe('Properties and configuration for the gadget'),
}).strict();

export const deleteDashboardGadgetSchema = z.object({
  dashboardId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the dashboard'),
  gadgetId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the gadget to delete'),
}).strict();

export const getDashboardSharePermissionsSchema = z.object({
  dashboardId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the dashboard'),
}).strict();

export const updateDashboardSharePermissionsSchema = z.object({
  dashboardId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the dashboard'),
  sharePermissions: z.array(z.object({
    type: z.enum(['global', 'project', 'group', 'authenticated', 'user'])
      .describe('The type of share permission'),
    project: z.object({
      id: z.string().max(10000).optional(),
      key: z.string().max(255).optional(),
    }).strict().optional().describe('Project details for project type permissions'),
    group: z.object({
      name: z.string().max(255),
    }).strict().optional().describe('Group details for group type permissions'),
    user: z.object({
      accountId: z.string().max(10000),
    }).strict().optional().describe('User details for user type permissions'),
  }).strict()).describe('The new share permissions for the dashboard'),
}).strict();

// Advanced Permission Validation schemas
export const getGlobalPermissionsSchema = z.object({
  expand: z.string().max(10000).optional()
    .describe('Comma-separated list of fields to expand (e.g., permissions,user,group,projectRole,field,all)'),
}).strict();

export const getMyPermissionsSchema = z.object({
  projectKey: z.string().max(10000).optional().describe('The project key to check permissions for'),
  projectId: z.string().max(10000).optional().describe('The project ID to check permissions for'),
  issueKey: z.string().max(10000).optional().describe('The issue key to check permissions for'),
  issueId: z.string().max(10000).optional().describe('The issue ID to check permissions for'),
  permissions: z.string().max(10000).optional()
    .describe('Comma-separated list of permission keys to check (e.g., BROWSE_PROJECTS,CREATE_ISSUES)'),
}).strict();

export const getUserPermissionsSchema = z.object({
  accountId: z.string().max(10000).describe('The account ID of the user to check permissions for'),
  projectKey: z.string().max(10000).optional().describe('The project key to check permissions for'),
  projectId: z.string().max(10000).optional().describe('The project ID to check permissions for'),
  issueKey: z.string().max(10000).optional().describe('The issue key to check permissions for'),
  issueId: z.string().max(10000).optional().describe('The issue ID to check permissions for'),
  permissions: z.string().max(10000).optional()
    .describe('Comma-separated list of permission keys to check'),
}).strict();

export const validatePermissionsSchema = z.object({
  permissions: z.array(z.object({
    key: z.string().max(255).describe('The permission key to validate'),
    subject: z.object({
      type: z.enum(['user', 'group', 'projectRole', 'applicationRole']).describe('The type of subject'),
      id: z.string().max(10000).optional().describe('The ID of the subject (user accountId, group name, role ID)'),
      name: z.string().max(255).optional().describe('The name of the subject'),
    }).strict().optional().describe('The subject to validate permissions for'),
    context: z.object({
      project: z.object({
        key: z.string().max(255).optional(),
        id: z.string().max(10000).optional(),
      }).strict().optional().describe('Project context for validation'),
      issue: z.object({
        key: z.string().max(255).optional(),
        id: z.string().max(10000).optional(),
      }).strict().optional().describe('Issue context for validation'),
    }).strict().optional().describe('The context to validate permissions in'),
  }).strict()).min(1).describe('Array of permissions to validate'),
}).strict();

export const getPermissionSchemeUsersSchema = z.object({
  schemeId: z.coerce.number().describe('The ID of the permission scheme'),
  startAt: z.number().optional().default(0).describe('The starting index for results'),
  maxResults: z.number().max(200).optional().default(50)
    .describe('The maximum number of results to return'),
  permission: z.string().max(10000).optional()
    .describe('Filter users by specific permission key'),
}).strict();

export const getProjectPermissionsSchema = z.object({
  projectKey: z.string().max(10000).describe('The project key to get permissions for'),
  permissions: z.string().max(10000).optional()
    .describe('Comma-separated list of permission keys to check'),
  expand: z.string().max(10000).optional()
    .describe('Comma-separated list of fields to expand'),
}).strict();

// Advanced Search & Lookup schemas
export const searchUsersSchema = z.object({
  query: z.string().max(10000).optional().describe('Search query for users (name, email, or username)'),
  username: z.string().max(255).optional().describe('Exact username to search for'),
  accountId: z.string().max(10000).optional().describe('Specific account ID to search for'),
  startAt: z.number().optional().default(0).describe('The starting index for results'),
  maxResults: z.number().max(1000).optional().default(50)
    .describe('The maximum number of results to return'),
  includeActive: z.boolean().optional().default(true).describe('Include active users'),
  includeInactive: z.boolean().optional().default(false).describe('Include inactive users'),
}).strict();

export const searchGroupsSchema = z.object({
  query: z.string().max(10000).optional().describe('Search query for groups (group name)'),
  exclude: z.array(z.string()).optional().describe('Group names to exclude from results'),
  maxResults: z.number().max(1000).optional().default(20)
    .describe('The maximum number of results to return'),
}).strict();

export const getUserGroupsSchema = z.object({
  accountId: z.string().max(10000).describe('The account ID of the user'),
}).strict();

export const getApplicationRolesSchema = z.object({
  key: z.string().max(255).optional().describe('Specific application role key to retrieve'),
}).strict();

export const getBulkPermissionsSchema = z.object({
  projectKeys: z.array(z.string()).min(1).max(100)
    .describe('Array of project keys to check permissions for'),
  permissions: z.array(z.string()).min(1)
    .describe('Array of permission keys to check'),
}).strict();

// System Configuration schemas
export const getApplicationPropertiesSchema = z.object({
  key: z.string().max(255).optional().describe('Specific property key to retrieve'),
  keyFilter: z.string().max(10000).optional().describe('Filter properties by key pattern'),
}).strict();

export const setApplicationPropertySchema = z.object({
  id: z.string().max(10000).describe('The property key/ID'),
  value: z.string().max(32768).describe('The property value to set'),
}).strict();

export const getSystemAvatarsSchema = z.object({
  type: z.enum(['project', 'issuetype', 'user']).describe('The type of avatar'),
}).strict();

export const getTimeTrackingSettingsSchema = z.object({
  // No parameters - returns current time tracking configuration
}).strict();

export const updateTimeTrackingSettingsSchema = z.object({
  workingHoursPerDay: z.number().min(1).max(24).describe('Working hours per day'),
  workingDaysPerWeek: z.number().min(1).max(7).describe('Working days per week'),
  timeFormat: z.enum(['pretty', 'days', 'hours']).describe('Time display format'),
  defaultUnit: z.enum(['minute', 'hour', 'day', 'week']).describe('Default time unit'),
}).strict();

export const getJiraLicenseSchema = z.object({
  // No parameters - returns current license information
}).strict();

export const getSystemWebhooksSchema = z.object({
  startAt: z.number().optional().default(0).describe('The starting index for results'),
  maxResults: z.number().max(100).optional().default(25)
    .describe('The maximum number of results to return'),
}).strict();

// Integration & Migration schemas
export const exportProjectDataSchema = z.object({
  projectKey: z.string().max(10000).describe('The project key to export data for'),
  includeIssues: z.boolean().optional().default(true).describe('Include issues in export'),
  includeWorkflows: z.boolean().optional().default(true).describe('Include workflow configurations'),
  includePermissions: z.boolean().optional().default(true).describe('Include permission schemes'),
  includeCustomFields: z.boolean().optional().default(true).describe('Include custom field configurations'),
  maxIssues: z.number().max(10000).optional().default(1000).describe('Maximum number of issues to export'),
}).strict();

export const exportUserDataSchema = z.object({
  accountId: z.string().max(10000).describe('The account ID of the user to export data for'),
  includeGroups: z.boolean().optional().default(true).describe('Include user group memberships'),
  includePermissions: z.boolean().optional().default(true).describe('Include user permissions'),
  includeActivity: z.boolean().optional().default(false).describe('Include user activity and issue history'),
}).strict();

export const importProjectDataSchema = z.object({
  projectData: z.object({
    key: z.string().max(255).describe('Project key'),
    name: z.string().max(255).describe('Project name'),
    projectTypeKey: z.enum(['business', 'software', 'service_desk']).describe('Project type'),
    leadAccountId: z.string().max(10000).describe('Project lead account ID'),
  }).strict().describe('Project data to import'),
  includeIssues: z.boolean().optional().default(false).describe('Import issues (requires issue data)'),
  includeWorkflows: z.boolean().optional().default(false).describe('Import workflow configurations'),
  overwriteExisting: z.boolean().optional().default(false).describe('Overwrite existing configurations'),
}).strict();

export const importUserDataSchema = z.object({
  userData: z.object({
    accountId: z.string().max(10000).describe('User account ID'),
    emailAddress: z.string().email().describe('User email address'),
    displayName: z.string().max(255).describe('User display name'),
  }).strict().describe('User data to import'),
  includeGroups: z.boolean().optional().default(false).describe('Import group memberships'),
  createMissingGroups: z.boolean().optional().default(false).describe('Create groups that do not exist'),
}).strict();

// Reporting & Analytics schemas
export const generateSystemReportSchema = z.object({
  reportType: z.enum(['basic', 'full', 'custom']).describe('Type of system report to generate'),
  sections: z.array(z.enum(['system', 'license', 'usage', 'security', 'performance']))
    .optional().describe('Specific sections to include (for custom reports)'),
}).strict();

export const generateUsageAnalyticsSchema = z.object({
  period: z.enum(['week', 'month', 'quarter', 'year']).optional()
    .describe('Predefined time period for analytics'),
  startDate: z.string().max(10000).optional().describe('Start date for custom period (ISO 8601)'),
  endDate: z.string().max(10000).optional().describe('End date for custom period (ISO 8601)'),
  includeAuditData: z.boolean().optional().default(false)
    .describe('Include audit log data in analytics'),
}).strict();

export const exportSystemConfigurationSchema = z.object({
  includePermissionSchemes: z.boolean().optional().default(true)
    .describe('Include permission schemes in export'),
  includeWorkflowSchemes: z.boolean().optional().default(true)
    .describe('Include workflow schemes in export'),
  includeFieldConfigurations: z.boolean().optional().default(true)
    .describe('Include field configurations in export'),
  includeScreenSchemes: z.boolean().optional().default(true)
    .describe('Include screen schemes in export'),
  includeNotificationSchemes: z.boolean().optional().default(true)
    .describe('Include notification schemes in export'),
}).strict();

export const importSystemConfigurationSchema = z.object({
  configurationData: z.object({
    permissionSchemes: z.array(z.unknown()).optional().describe('Permission schemes to import'),
    workflowSchemes: z.array(z.unknown()).optional().describe('Workflow schemes to import'),
    fieldConfigurations: z.array(z.unknown()).optional().describe('Field configurations to import'),
  }).strict().describe('System configuration data to import'),
  overwriteExisting: z.boolean().optional().default(false)
    .describe('Overwrite existing configurations'),
  validateOnly: z.boolean().optional().default(false)
    .describe('Only validate import data without applying changes'),
}).strict();

export const generateComplianceReportSchema = z.object({
  reportType: z.enum(['gdpr', 'sox', 'security', 'audit']).describe('Type of compliance report'),
  startDate: z.string().max(10000).optional().describe('Start date for compliance period (ISO 8601)'),
  endDate: z.string().max(10000).optional().describe('End date for compliance period (ISO 8601)'),
  includeUserData: z.boolean().optional().default(true)
    .describe('Include user data in compliance report'),
  includeAuditLogs: z.boolean().optional().default(true)
    .describe('Include audit logs in compliance report'),
}).strict();

export const getDataRetentionPoliciesSchema = z.object({
  policyType: z.enum(['issues', 'attachments', 'audit', 'all']).optional().default('all')
    .describe('Type of retention policies to retrieve'),
}).strict();

export const bulkDataExportSchema = z.object({
  exportType: z.enum(['all', 'projects', 'users', 'system']).describe('Type of bulk export'),
  projectKeys: z.array(z.string()).optional()
    .describe('Specific project keys to export (for project export)'),
  includeAttachments: z.boolean().optional().default(false)
    .describe('Include file attachments in export'),
  compressionFormat: z.enum(['zip', 'tar', 'none']).optional().default('zip')
    .describe('Compression format for export'),
}).strict();

export const bulkDataImportSchema = z.object({
  importType: z.enum(['projects', 'users', 'system']).describe('Type of bulk import'),
  importData: z.unknown().describe('Import data payload'),
  validateOnly: z.boolean().optional().default(false)
    .describe('Only validate import data without applying changes'),
  batchSize: z.number().min(1).max(100).optional().default(10)
    .describe('Number of items to process in each batch'),
}).strict();

export const generateHealthCheckReportSchema = z.object({
  checkLevel: z.enum(['basic', 'comprehensive']).optional().default('basic')
    .describe('Level of health checks to perform'),
  checks: z.array(z.enum(['system', 'license', 'performance', 'security', 'integrations']))
    .optional().describe('Specific health checks to perform'),
}).strict();

export const getSystemStatisticsSchema = z.object({
  period: z.enum(['week', 'month', 'quarter', 'year']).optional().default('month')
    .describe('Time period for statistics'),
  includeProjectStats: z.boolean().optional().default(true)
    .describe('Include project-level statistics'),
  includeUserStats: z.boolean().optional().default(true)
    .describe('Include user activity statistics'),
}).strict();

export const generateCustomReportSchema = z.object({
  reportName: z.string().min(1).max(255).describe('Name for the custom report'),
  jqlQuery: z.string().max(10000).describe('JQL query to define report data'),
  fields: z.array(z.string()).describe('Fields to include in the report'),
  groupBy: z.string().max(10000).optional().describe('Field to group results by'),
  aggregations: z.array(z.enum(['count', 'sum', 'avg', 'min', 'max'])).optional()
    .describe('Aggregation functions to apply'),
  format: z.enum(['json', 'csv', 'xlsx']).optional().default('json')
    .describe('Output format for the report'),
}).strict();

export const generatePerformanceReportSchema = z.object({
  period: z.enum(['week', 'month', 'quarter']).optional().default('month')
    .describe('Time period for performance analysis'),
  includeSystemMetrics: z.boolean().optional().default(true)
    .describe('Include system performance metrics'),
  includeUsageMetrics: z.boolean().optional().default(true)
    .describe('Include usage performance metrics'),
  includeResponseTimes: z.boolean().optional().default(false)
    .describe('Include API response time analysis'),
}).strict();

// Jira Service Management (JSM) validation schemas

export const getServiceDesksSchema = z.object({
  start: z.number().optional().default(0).describe('The starting index for results'),
  limit: z.number().max(100).optional().default(50)
    .describe('The maximum number of results to return'),
}).strict();

export const getServiceDeskSchema = z.object({
  serviceDeskId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the service desk'),
}).strict();

export const getRequestTypesSchema = z.object({
  serviceDeskId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the service desk'),
  start: z.number().optional().default(0).describe('The starting index for results'),
  limit: z.number().max(100).optional().default(50)
    .describe('The maximum number of results to return'),
  expand: z.string().max(10000).optional()
    .describe('Comma-separated list of fields to expand (e.g., field)'),
}).strict();

export const createRequestTypeSchema = z.object({
  serviceDeskId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the service desk'),
  name: z.string().min(1).max(255).describe('The name of the request type'),
  description: z.string().max(32768).optional().describe('The description of the request type'),
  helpText: z.string().max(32768).optional().describe('The help text for the request type'),
  issueTypeId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the issue type to use for this request type'),
  groupIds: z.array(z.string()).optional()
    .describe('Array of customer group names that can access this request type'),
}).strict();


export const deleteRequestTypeSchema = z.object({
  serviceDeskId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the service desk'),
  requestTypeId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the request type to delete'),
}).strict();

export const getRequestTypeFieldsSchema = z.object({
  serviceDeskId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the service desk'),
  requestTypeId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the request type'),
}).strict();

export const updateRequestTypeFieldsSchema = z.object({
  serviceDeskId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the service desk'),
  requestTypeId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the request type'),
  requestTypeFields: z.array(z.object({
    fieldId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the field'),
    required: z.boolean().optional().describe('Whether the field is required'),
    visible: z.boolean().optional().describe('Whether the field is visible'),
    defaultValues: z.array(z.unknown()).optional().describe('Default values for the field'),
    presetValues: z.array(z.unknown()).optional().describe('Preset values for the field'),
  }).strict()).describe('Array of field configurations for the request type'),
}).strict();

export const getRequestTypeGroupsSchema = z.object({
  serviceDeskId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the service desk'),
  requestTypeId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the request type'),
  start: z.number().optional().default(0).describe('The starting index for results'),
  limit: z.number().max(100).optional().default(50)
    .describe('The maximum number of results to return'),
}).strict();

export const updateRequestTypeGroupsSchema = z.object({
  serviceDeskId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the service desk'),
  requestTypeId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the request type'),
  groupNames: z.array(z.string()).describe('Array of customer group names to grant access to this request type'),
}).strict();

// Automation Rule schemas
/**
 * Parameters the Jira Automation API actually honours on GET /rule/summary are
 * `limit` and an opaque `cursor`. Verified against the live API: name, enabled,
 * authorAccountId, projects, expand, startAt, maxResults and even a nonsense
 * parameter all return HTTP 200 with the byte-identical full rule set.
 *
 * The unsupported keys are RETAINED here rather than removed so they can be
 * rejected with a message that names the working alternative. Removing them
 * from a .strict() object would emit a generic "unrecognized key" error, and
 * silently accepting them is what previously let `enabled:true` return every
 * rule on a 5-enabled/3-disabled instance under success:true.
 */
const AUTOMATION_LIST_UNSUPPORTED = [
  'name',
  'enabled',
  'authorAccountId',
  'projects',
  'expand',
  'startAt',
  'maxResults',
] as const;

export const getAutomationRulesSchema = z.object({
  name: z.string().max(255).optional().describe('NOT SUPPORTED by the Automation API - rejected'),
  enabled: z.boolean().optional().describe('NOT SUPPORTED by the Automation API - rejected'),
  authorAccountId: z.string().max(10000).optional().describe('NOT SUPPORTED by the Automation API - rejected'),
  projects: z.array(z.string()).optional().describe('NOT SUPPORTED by the Automation API - rejected'),
  expand: z.string().max(10000).optional().describe('NOT SUPPORTED by the Automation API - rejected'),
  includeDetails: z.boolean().optional().default(false).describe('Rejected: there is no listing endpoint that returns full rule configurations. Use get_automation_rule_details with a uuid from this tool.'),
  startAt: z.number().min(0).optional().describe('NOT SUPPORTED - the Automation API uses opaque cursor pagination, not offsets'),
  maxResults: z.number().min(1).max(100).optional().describe('NOT SUPPORTED - use `limit`'),
  limit: z.number().min(1).max(100).optional().describe('Page size. The only size parameter the Automation API honours.'),
  cursor: z.string().max(10000).optional().describe('Opaque continuation token taken from `nextCursor` of a previous response.'),
}).strict().superRefine((val, ctx) => {
  const supplied = AUTOMATION_LIST_UNSUPPORTED.filter(
    (k) => (val as Record<string, unknown>)[k] !== undefined
  );
  if (supplied.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [supplied[0]!],
      message:
        `The Jira Automation API does not support these parameters: ${supplied.join(', ')}. ` +
        'It returns the full rule set regardless of them, so honouring them would ' +
        'silently return unfiltered results. Supported parameters are `limit` and ' +
        '`cursor` (from nextCursor). Filter client-side on the returned rules.',
    });
  }
  if (val.includeDetails === true) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['includeDetails'],
      message:
        'includeDetails is not obtainable: GET /rule returns HTTP 404 with an empty ' +
        'body and no listing endpoint accepts expand. Call get_automation_rules to ' +
        'list rules, then get_automation_rule_details with a `uuid` from the result ' +
        'to retrieve the full trigger and components for a specific rule.',
    });
  }
});

export const getAutomationRuleDetailsSchema = z.object({
  ruleId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the automation rule to get details for'),
  expand: z.string().max(10000).optional().describe('Comma-separated list of fields to expand (e.g., trigger,conditions,actions,executions)'),
}).strict();

/**
 * get_automation_templates
 *
 * Two parameters were advertised and silently discarded or ignored.
 *
 * `startAt` was forwarded nowhere at all, and because it carried .default(0) it
 * was ALWAYS defined after parse -- so a caller passing startAt:25 validated
 * cleanly and the value simply vanished. Forwarding it instead would not help:
 * the API ignores it too (verified live -- limit=5 and limit=5&startAt=25
 * return byte-identical rows). /template/search is cursor-paginated with an
 * opaque token, which cannot express an arbitrary offset. Honouring startAt is
 * therefore impossible, and forwarding it would only move the same silent
 * discard one layer down where it is harder to find. It is rejected instead,
 * and `cursor` is offered as the working alternative.
 *
 * `category` (singular) WAS forwarded, and is inert: verified live, a real
 * category key, a display name and pure nonsense all return the identical
 * 281-template id list, byte-identical to an unfiltered walk and to a
 * `bogusParam=1` control. The tool advertised a filter, got HTTP 200, and
 * returned the entire catalogue as though it had been filtered.
 *
 * The API's real filter is `categories` (plural), matched on the category KEY.
 * Verified live: categories=jsm.team-type.information-technology returns 39 of
 * 281, exactly equal to the client-side match set.
 *
 * `categories` is a single string, NOT an array, deliberately. The API does
 * support OR via repeated query params, but the shared axios instance sets no
 * paramsSerializer, so axios v1 emits an array as `categories[]=a&categories[]=b`
 * -- and the API SILENTLY IGNORES the bracket form, returning 200 with the
 * unfiltered page (verified live: bracket 50 rows vs bare 39). Accepting an
 * array here would produce confidently unfiltered results under success:true.
 * Enabling it needs a paramsSerializer on a shared client method used by six
 * tools, which is out of scope for this repair.
 *
 * The unsupported keys are RETAINED in this .strict() object rather than
 * removed, so they can be rejected by NAME with a message that points at the
 * working alternative. Removing them would emit a generic "unrecognized key"
 * error, which was already learned to be unhelpful when get_automation_rules
 * was fixed.
 */
const AUTOMATION_TEMPLATES_UNSUPPORTED = ['startAt', 'category'] as const;

export const getAutomationTemplatesSchema = z.object({
  category: z.string().max(10000).optional().describe('NOT SUPPORTED - the API ignores it and returns the full catalogue. Use `categories` with a category key.'),
  startAt: z.number().min(0).optional().describe('NOT SUPPORTED - /template/search is cursor-paginated and ignores offsets. Use `cursor`.'),
  categories: z.union([z.string().max(255), z.array(z.string().max(255))]).optional()
    .describe('Filter by a single category KEY (e.g. "jira.rovo"), not a display name. One key per call.'),
  maxResults: z.number().min(1).max(100).optional().default(50).describe('Page size, sent to the API as `limit`.'),
  cursor: z.string().max(10000).optional().describe('Opaque continuation token taken from `nextCursor` of a previous response.'),
}).strict().superRefine((val, ctx) => {
  const supplied = AUTOMATION_TEMPLATES_UNSUPPORTED.filter(
    (k) => (val as Record<string, unknown>)[k] !== undefined
  );
  for (const key of supplied) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [key],
      message:
        key === 'startAt'
          ? 'startAt is not supported. /template/search uses opaque cursor pagination, ' +
            'which cannot express an arbitrary offset, and the API ignores startAt when ' +
            'sent. Page through results with `cursor`, using the `nextCursor` value from ' +
            'the previous response.'
          : 'category is not supported: the Automation API ignores it and returns the ' +
            'full unfiltered catalogue, so honouring it would silently return every ' +
            'template as though it had been filtered. Use `categories` instead, with a ' +
            'category KEY such as "jira.rovo" (not a display name), one key per call.',
    });
  }
  if (Array.isArray(val.categories)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['categories'],
      message:
        'categories must be a single category key, not an array. The API expresses OR ' +
        'via repeated query parameters, but this client has no paramsSerializer and ' +
        'axios emits arrays as `categories[]=`, which the API silently ignores -- ' +
        'returning unfiltered results under HTTP 200. Issue one call per category key.',
    });
  }
});

export const getRuleExecutionsSchema = z.object({
  ruleId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the automation rule'),
  status: z.enum(['SUCCESS', 'FAILED', 'RUNNING', 'CANCELLED']).optional().describe('Filter by execution status'),
  fromDate: z.string().max(10000).optional().describe('Start date for execution history (ISO 8601 format)'),
  toDate: z.string().max(10000).optional().describe('End date for execution history (ISO 8601 format)'),
  startAt: z.number().min(0).optional().default(0).describe('The starting index for results'),
  maxResults: z.number().min(1).max(100).optional().default(50).describe('The maximum number of results to return'),
}).strict();

// Raw automation rule schemas - passthrough to Atlassian API
// Component type identifiers must be discovered by exporting existing rules from Jira UI
const rawAutomationTriggerSchema = z.object({
  component: z.literal('TRIGGER').optional().default('TRIGGER'),
  schemaVersion: z.number().optional().default(1),
  type: z.string().max(10000).describe('Component type identifier (e.g., jira.issue.event.trigger:created)'),
  value: z.union([z.record(z.unknown()), z.string()]).optional().describe('Trigger configuration - structure varies by type'),
  conditions: z.array(z.unknown()).optional().default([]),
  connectionId: z.string().max(10000).nullable().optional(),
}).passthrough();

const rawAutomationActionSchema = z.object({
  component: z.literal('ACTION').optional().default('ACTION'),
  schemaVersion: z.number().optional().default(1),
  type: z.string().max(10000).describe('Component type identifier (e.g., jira.issue.assign)'),
  value: z.union([z.record(z.unknown()), z.string()]).optional().describe('Action configuration - structure varies by type'),
  conditions: z.array(z.unknown()).optional().default([]),
  children: z.array(z.unknown()).optional().default([]),
  connectionId: z.string().max(10000).nullable().optional(),
}).passthrough();

const rawAutomationConditionSchema = z.object({
  component: z.literal('CONDITION').optional().default('CONDITION'),
  schemaVersion: z.number().optional().default(1),
  type: z.string().max(10000).describe('Component type identifier'),
  value: z.union([z.record(z.unknown()), z.string()]).optional(),
  children: z.array(z.unknown()).optional().default([]),
  connectionId: z.string().max(10000).nullable().optional(),
}).passthrough();

export const createAutomationRuleSchema = z.object({
  name: z.string().min(1).max(255).describe('The name of the automation rule'),
  description: z.string().max(32768).optional().describe('The description of the automation rule'),
  state: z.enum(['ENABLED', 'DISABLED']).optional().default('ENABLED').describe('Rule state'),
  // REQUIRED: Author account ID (discovered via API testing - CREATE fails without this)
  authorAccountId: z.string().max(10000).describe('REQUIRED: Account ID of the rule author'),
  // Optional actor configuration (defaults based on authorAccountId if not provided)
  actor: z.object({
    type: z.enum(['ACCOUNT_ID']).optional().default('ACCOUNT_ID'),
    actor: z.string().max(10000).describe('Account ID of the actor who will execute rule actions'),
  }).strict().optional().describe('Actor configuration for rule execution'),
  trigger: rawAutomationTriggerSchema.describe('Trigger configuration with raw Atlassian format'),
  components: z.array(rawAutomationActionSchema).min(1).describe('Actions (Atlassian calls these "components")'),
  conditions: z.array(rawAutomationConditionSchema).optional(),
  ruleScopeARIs: z.array(z.string()).optional().describe('Project scope ARIs'),
  canOtherRuleTrigger: z.boolean().optional().default(false),
  notifyOnError: z.enum(['FIRSTERROR', 'EVERYERROR', 'NEVER']).optional().default('FIRSTERROR'),
  labels: z.array(z.string()).optional().default([]),
  // Legacy fields (deprecated but kept for compatibility)
  projects: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  enabled: z.boolean().optional(),
  actions: z.array(z.unknown()).optional(),
}).strict();

export const updateAutomationRuleSchema = z.object({
  ruleId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the automation rule to update'),
  name: z.string().min(1).max(255).optional().describe('The new name of the automation rule'),
  description: z.string().max(32768).optional().describe('The new description of the automation rule'),
  enabled: z.boolean().optional().describe('Whether the rule is enabled'),
  trigger: rawAutomationTriggerSchema.optional().describe('The new trigger for the rule'),
  conditions: z.array(rawAutomationConditionSchema).optional().describe('New conditions for the rule'),
  actions: z.array(rawAutomationActionSchema).optional().describe('New actions for the rule'),
  projects: z.array(z.string()).optional().describe('New project IDs for the rule'),
  tags: z.array(z.string()).optional().describe('New tags for the rule'),
}).passthrough();

export const deleteAutomationRuleSchema = z.object({
  ruleId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the automation rule to delete'),
}).strict();

export const enableDisableAutomationRuleSchema = z.object({
  ruleId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the automation rule'),
  enabled: z.boolean().describe('Whether to enable (true) or disable (false) the rule'),
}).strict();

export const executeManualRuleSchema = z.object({
  ruleId: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The ID of the automation rule to execute'),
  context: z.object({
    issueId: z.string().max(10000).optional().describe('Issue ID for context (required for issue-related rules)'),
    projectId: z.string().max(10000).optional().describe('Project ID for context'),
    userId: z.string().max(10000).optional().describe('User ID for context'),
  }).strict().optional().describe('Execution context for the rule'),
}).strict();

export const validateAutomationRuleSchema = z.object({
  name: z.string().min(1).max(255).describe('The name of the automation rule to validate'),
  trigger: rawAutomationTriggerSchema.describe('The trigger configuration to validate'),
  conditions: z.array(rawAutomationConditionSchema).optional().describe('Conditions to validate'),
  actions: z.array(rawAutomationActionSchema).min(1).describe('Actions to validate'),
  projects: z.array(z.string()).optional().describe('Project IDs to validate'),
}).strict();