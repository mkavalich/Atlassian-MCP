import { z } from 'zod';

/**
 * Input schemas for Jira System Admin MCP Server tools.
 *
 * All schemas use .passthrough() to allow Extensions to add
 * additional parameters (like responseFormat) without modifying these schemas.
 */

// Field input schemas (for MCP tool registration)
export const getFieldsInputSchema = z.object({
  type: z.enum(['custom', 'system', 'all']).optional().default('all')
    .describe('Filter fields by type'),
}).passthrough();

export const createCustomFieldInputSchema = z.object({
  name: z.string().min(1).max(255).describe('The name of the custom field'),
  description: z.string().optional().describe('The description of the custom field'),
  type: z.string().describe('The type of the custom field (e.g., com.atlassian.jira.plugin.system.customfieldtypes:textfield)'),
  searcherKey: z.string().optional()
    .describe('The searcher key for the custom field'),
}).passthrough();

export const updateCustomFieldInputSchema = z.object({
  fieldId: z.string().describe('The ID of the custom field to update'),
  name: z.string().min(1).max(255).optional().describe('The new name of the custom field'),
  description: z.string().optional().describe('The new description of the custom field'),
}).passthrough();

export const deleteCustomFieldInputSchema = z.object({
  fieldId: z.string().describe('The ID of the custom field to delete'),
}).passthrough();

// Permission input schemas
export const getPermissionSchemesInputSchema = z.object({
  expand: z.string().optional().describe('Use expand to include additional information'),
}).passthrough();

export const createPermissionSchemeInputSchema = z.object({
  name: z.string().min(1).max(255).describe('The name of the permission scheme'),
  description: z.string().optional().describe('The description of the permission scheme'),
  permissions: z.array(z.object({
    permission: z.string().describe('The permission type'),
    holder: z.object({
      type: z.enum(['anyone', 'assignee', 'reporter', 'user', 'group', 'projectRole', 'applicationRole'])
        .describe('The type of permission holder'),
      parameter: z.string().optional().describe('The parameter for the permission holder'),
    }),
  })).optional().describe('The permissions to include in the scheme'),
}).passthrough();

export const assignPermissionSchemeToProjectInputSchema = z.object({
  projectIdOrKey: z.string().describe('The project ID or key'),
  schemeId: z.coerce.number().describe('The ID of the permission scheme to assign'),
}).passthrough();

export const updatePermissionSchemeInputSchema = z.object({
  schemeId: z.coerce.number().describe('The ID of the permission scheme to update'),
  name: z.string().min(1).max(255).optional().describe('The new name of the permission scheme'),
  description: z.string().optional().describe('The new description of the permission scheme'),
}).passthrough();

export const deletePermissionSchemeInputSchema = z.object({
  schemeId: z.coerce.number().describe('The ID of the permission scheme to delete'),
}).passthrough();

export const getPermissionGrantsInputSchema = z.object({
  schemeId: z.coerce.number().describe('The ID of the permission scheme'),
  expand: z.string().optional().describe('Use expand to include additional information'),
}).passthrough();

export const createPermissionGrantInputSchema = z.object({
  schemeId: z.coerce.number().describe('The ID of the permission scheme'),
  permission: z.string().describe('The permission key (e.g., BROWSE_PROJECTS, CREATE_ISSUES, etc.)'),
  holder: z.object({
    type: z.enum(['anyone', 'assignee', 'reporter', 'group', 'projectRole', 'user', 'applicationRole'])
      .describe('The type of permission holder'),
    parameter: z.string().optional().describe('The parameter for the holder type'),
  }),
}).passthrough();

export const deletePermissionGrantInputSchema = z.object({
  schemeId: z.coerce.number().describe('The ID of the permission scheme'),
  permissionId: z.coerce.number().describe('The ID of the permission grant to delete'),
}).passthrough();

// Advanced Permission Validation input schemas
export const getGlobalPermissionsInputSchema = z.object({
  expand: z.string().optional()
    .describe('Comma-separated list of fields to expand (e.g., permissions,user,group,projectRole,field,all)'),
}).passthrough();

export const getMyPermissionsInputSchema = z.object({
  projectKey: z.string().optional().describe('The project key to check permissions for'),
  projectId: z.string().optional().describe('The project ID to check permissions for'),
  issueKey: z.string().optional().describe('The issue key to check permissions for'),
  issueId: z.string().optional().describe('The issue ID to check permissions for'),
  permissions: z.string().optional()
    .describe('Comma-separated list of permission keys to check (e.g., BROWSE_PROJECTS,CREATE_ISSUES)'),
}).passthrough();

export const getUserPermissionsInputSchema = z.object({
  accountId: z.string().describe('The account ID of the user to check permissions for'),
  projectKey: z.string().optional().describe('The project key to check permissions for'),
  projectId: z.string().optional().describe('The project ID to check permissions for'),
  issueKey: z.string().optional().describe('The issue key to check permissions for'),
  issueId: z.string().optional().describe('The issue ID to check permissions for'),
  permissions: z.string().optional()
    .describe('Comma-separated list of permission keys to check'),
}).passthrough();

export const validatePermissionsInputSchema = z.object({
  permissions: z.array(z.object({
    key: z.string().describe('The permission key to validate'),
    subject: z.object({
      type: z.enum(['user', 'group', 'projectRole', 'applicationRole']).describe('The type of subject'),
      id: z.string().optional().describe('The ID of the subject (user accountId, group name, role ID)'),
      name: z.string().optional().describe('The name of the subject'),
    }).optional().describe('The subject to validate permissions for'),
    context: z.object({
      project: z.object({
        key: z.string().optional(),
        id: z.string().optional(),
      }).optional().describe('Project context for validation'),
      issue: z.object({
        key: z.string().optional(),
        id: z.string().optional(),
      }).optional().describe('Issue context for validation'),
    }).optional().describe('The context to validate permissions in'),
  })).min(1).describe('Array of permissions to validate'),
}).passthrough();

export const getPermissionSchemeUsersInputSchema = z.object({
  schemeId: z.coerce.number().describe('The ID of the permission scheme'),
  startAt: z.number().optional().default(0).describe('The starting index for results'),
  maxResults: z.number().max(200).optional().default(50)
    .describe('The maximum number of results to return'),
  permission: z.string().optional()
    .describe('Filter users by specific permission key'),
}).passthrough();

export const getProjectPermissionsInputSchema = z.object({
  projectKey: z.string().describe('The project key to get permissions for'),
  permissions: z.string().optional()
    .describe('Comma-separated list of permission keys to check'),
  expand: z.string().optional()
    .describe('Comma-separated list of fields to expand'),
}).passthrough();

// Project input schemas
export const createProjectInputSchema = z.object({
  name: z.string().min(1).max(80).describe('The name of the project'),
  key: z.string().min(1).max(10).describe('The project key'),
  projectTypeKey: z.enum(['business', 'software', 'service_desk']).describe('The project type'),
  description: z.string().optional().describe('The project description'),
  leadAccountId: z.string().describe('The account ID of the project lead'),
  assigneeType: z.enum(['PROJECT_LEAD', 'UNASSIGNED']).optional().default('PROJECT_LEAD')
    .describe('The default assignee type'),
  url: z.string().url().optional().describe('The project URL'),
  avatarId: z.number().optional().describe('The ID of the project avatar'),
  // Enhanced parameters for project templates and configuration
  projectTemplateKey: z.string().optional()
    .describe('The template key to use for project creation'),
  categoryId: z.number().optional()
    .describe('The ID of the project category to assign'),
  notificationScheme: z.number().optional()
    .describe('The ID of the notification scheme to apply'),
  permissionScheme: z.number().optional()
    .describe('The ID of the permission scheme to apply'),
  issueSecurityScheme: z.number().optional()
    .describe('The ID of the issue security scheme to apply'),
}).passthrough();

export const getProjectInputSchema = z.object({
  projectIdOrKey: z.string().describe('The project ID or key'),
  expand: z.string().optional().describe('Use expand to include additional information'),
}).passthrough();

export const updateProjectInputSchema = z.object({
  projectIdOrKey: z.string().describe('The project ID or key'),
  name: z.string().min(1).max(80).optional().describe('The new name of the project'),
  key: z.string().min(1).max(10).optional().describe('The new project key'),
  description: z.string().optional().describe('The new project description'),
  leadAccountId: z.string().optional().describe('The new project lead account ID'),
  assigneeType: z.enum(['PROJECT_LEAD', 'UNASSIGNED']).optional()
    .describe('The new default assignee type'),
  url: z.string().url().optional().describe('The new project URL'),
  avatarId: z.number().optional().describe('The new project avatar ID'),
  // Enhanced parameters for project configuration updates
  categoryId: z.number().optional()
    .describe('The ID of the project category to assign'),
  notificationScheme: z.number().optional()
    .describe('The ID of the notification scheme to apply'),
  permissionScheme: z.number().optional()
    .describe('The ID of the permission scheme to apply'),
  issueSecurityScheme: z.number().optional()
    .describe('The ID of the issue security scheme to apply'),
}).passthrough();

export const deleteProjectInputSchema = z.object({
  projectIdOrKey: z.string().describe('The project ID or key'),
  enableUndo: z.boolean().optional().default(false)
    .describe('Whether to enable undo for the deletion'),
}).passthrough();

// System input schemas
export const searchJQLInputSchema = z.object({
  jql: z.string().describe('The JQL query string'),
  startAt: z.number().optional().default(0).describe('The starting index for results'),
  maxResults: z.number().max(100).optional().default(50)
    .describe('The maximum number of results to return'),
  fields: z.array(z.string()).optional()
    .describe('The list of fields to return for each issue'),
  expand: z.string().optional()
    .describe('Comma-separated list of fields to expand'),
  validateQuery: z.enum(['strict', 'warn', 'none']).optional().default('strict')
    .describe('How to validate the JQL query'),
}).passthrough();

export const getAuditRecordsInputSchema = z.object({
  offset: z.number().optional().default(0).describe('The starting index for results'),
  limit: z.number().max(1000).optional().default(100)
    .describe('The maximum number of audit records to return'),
  filter: z.string().max(10000).optional()
    .describe('The filter for audit records (e.g., created > -1d)'),
  from: z.string().max(255).optional()
    .describe('The start date for audit records (ISO 8601 format)'),
  to: z.string().max(255).optional()
    .describe('The end date for audit records (ISO 8601 format)'),
}).passthrough();

// Workflow input schemas
export const getWorkflowsInputSchema = z.object({
  workflowName: z.string().optional().describe('Filter by workflow name'),
  expand: z.string().optional().describe('Use expand to include additional information'),
}).passthrough();

export const createWorkflowInputSchema = z.object({
  name: z.string().min(1).max(255).describe('The name of the workflow'),
  description: z.string().optional().describe('The description of the workflow'),
  transitions: z.array(z.object({
    name: z.string().describe('The name of the transition'),
    from: z.array(z.string()).describe('The statuses this transition can start from'),
    to: z.string().describe('The status this transition leads to'),
    conditions: z.array(z.string()).optional().describe('Conditions for this transition'),
    validators: z.array(z.string()).optional().describe('Validators for this transition'),
    postFunctions: z.array(z.string()).optional().describe('Post-functions for this transition'),
  })).describe('The transitions in the workflow'),
  statuses: z.array(z.string()).describe('The statuses in the workflow'),
}).passthrough();

// Filter input schemas
export const createFilterInputSchema = z.object({
  name: z.string().min(1).max(255).describe('The name of the filter'),
  description: z.string().max(32768).optional().describe('The description of the filter'),
  jql: z.string().max(10000).describe('The JQL query for the filter'),
  favourite: z.boolean().optional().describe('Whether the filter is marked as favourite'),
  sharePermissions: z.array(z.object({
    type: z.enum(['global', 'project', 'group', 'authenticated', 'user'])
      .describe('The type of share permission'),
    project: z.object({
      id: z.string().max(255).optional(),
      key: z.string().max(255).optional(),
    }).optional().describe('Project details for project type permissions'),
    group: z.object({
      name: z.string().max(255),
    }).optional().describe('Group details for group type permissions'),
    user: z.object({
      accountId: z.string().max(255),
    }).optional().describe('User details for user type permissions'),
  })).optional().describe('Share permissions for the filter'),
}).passthrough();

// Additional input schemas for tools with no parameters
export const getInstanceInfoInputSchema = z.object({}).passthrough();

export const getProjectTemplatesInputSchema = z.object({
  accessible: z.boolean().optional().describe('Get only project types accessible to the user'),
  projectTypeKey: z.string().optional().describe('Get details for a specific project type (business, software, service_desk)'),
}).passthrough();

export const searchProjectsInputSchema = z.object({
  query: z.string().optional().describe('Filter projects by name or key (partial matches supported)'),
  typeKey: z.string().optional().describe('Filter projects by project type key (business, software, service_desk)'),
  categoryId: z.number().optional().describe('Filter projects by project category ID'),
  action: z.enum(['view', 'browse', 'edit']).optional().describe('Filter projects by the actions you can perform'),
  expand: z.string().optional().describe('Comma-separated list of fields to expand (e.g., description,lead,url,projectKeys,permissions)'),
  orderBy: z.enum(['category', 'issueCount', 'key', 'lastIssueUpdatedTime', 'name', 'owner', 'archivedDate', 'deletedDate'])
    .optional().describe('Sort the results by the specified field'),
  startAt: z.number().optional().default(0).describe('The starting index for results (pagination)'),
  maxResults: z.number().max(100).optional().default(50).describe('The maximum number of results to return (max 100)'),
}).passthrough();

// Advanced Search & Lookup input schemas
export const searchUsersInputSchema = z.object({
  query: z.string().max(10000).optional().describe('Search query for users (name, email, or username)'),
  username: z.string().max(255).optional().describe('Exact username to search for'),
  accountId: z.string().max(255).regex(/^[a-zA-Z0-9:._\-]+$/, 'invalid accountId').optional().describe('Specific account ID to search for'),
  startAt: z.number().optional().default(0).describe('The starting index for results'),
  maxResults: z.number().max(1000).optional().default(50)
    .describe('The maximum number of results to return'),
  includeActive: z.boolean().optional().default(true).describe('Include active users'),
  includeInactive: z.boolean().optional().default(false).describe('Include inactive users'),
}).passthrough();

export const searchGroupsInputSchema = z.object({
  query: z.string().max(10000).optional().describe('Search query for groups (group name)'),
  exclude: z.array(z.string().max(255)).optional().describe('Group names to exclude from results'),
  maxResults: z.number().max(1000).optional().default(20)
    .describe('The maximum number of results to return'),
}).passthrough();

export const getUserGroupsInputSchema = z.object({
  accountId: z.string().max(255).regex(/^[a-zA-Z0-9:._\-]+$/, 'invalid accountId').describe('The account ID of the user'),
}).passthrough();

export const getApplicationRolesInputSchema = z.object({
  key: z.string().max(255).optional().describe('Specific application role key to retrieve'),
}).passthrough();

export const getBulkPermissionsInputSchema = z.object({
  projectIds: z.array(z.union([z.string(), z.number()])).min(1).max(100)
    .describe('Array of project IDs (numeric) to check permissions for. Use search_projects to find project IDs.'),
  permissions: z.array(z.string().max(255)).min(1)
    .describe('Array of permission keys to check (e.g., BROWSE_PROJECTS, CREATE_ISSUES, EDIT_ISSUES)'),
}).passthrough();

// System Configuration input schemas
export const getApplicationPropertiesInputSchema = z.object({
  key: z.string().max(255).optional().describe('Specific property key to retrieve'),
  keyFilter: z.string().max(255).optional().describe('Filter properties by key pattern'),
}).passthrough();

export const setApplicationPropertyInputSchema = z.object({
  id: z.string().max(255).regex(/^[\w.\-:]+$/, 'invalid id').describe('The property key/ID'),
  value: z.string().max(10000).describe('The property value to set'),
}).passthrough();

export const getSystemAvatarsInputSchema = z.object({
  type: z.enum(['project', 'issuetype', 'user']).describe('The type of avatar'),
}).passthrough();

export const getTimeTrackingSettingsInputSchema = z.object({}).passthrough();

export const updateTimeTrackingSettingsInputSchema = z.object({
  workingHoursPerDay: z.number().min(1).max(24).describe('Working hours per day'),
  workingDaysPerWeek: z.number().min(1).max(7).describe('Working days per week'),
  timeFormat: z.enum(['pretty', 'days', 'hours']).describe('Time display format'),
  defaultUnit: z.enum(['minute', 'hour', 'day', 'week']).describe('Default time unit'),
}).passthrough();

export const getJiraLicenseInputSchema = z.object({}).passthrough();

export const getSystemWebhooksInputSchema = z.object({
  startAt: z.number().optional().default(0).describe('The starting index for results'),
  maxResults: z.number().max(100).optional().default(25)
    .describe('The maximum number of results to return'),
}).passthrough();

// Integration & Migration input schemas
export const exportProjectDataInputSchema = z.object({
  projectKey: z.string().max(255).regex(/^[A-Za-z][A-Za-z0-9_]{1,255}$/, 'invalid project key').describe('The project key to export data for'),
  includeIssues: z.boolean().optional().default(true).describe('Include issues in export'),
  includeWorkflows: z.boolean().optional().default(true).describe('Include workflow configurations'),
  includePermissions: z.boolean().optional().default(true).describe('Include permission schemes'),
  includeCustomFields: z.boolean().optional().default(true).describe('Include custom field configurations'),
  maxIssues: z.number().max(10000).optional().default(1000).describe('Maximum number of issues to export'),
}).passthrough();

export const exportUserDataInputSchema = z.object({
  accountId: z.string().max(255).regex(/^[a-zA-Z0-9:._\-]+$/, 'invalid accountId').describe('The account ID of the user to export data for'),
  includeGroups: z.boolean().optional().default(true).describe('Include user group memberships'),
  includePermissions: z.boolean().optional().default(true).describe('Include user permissions'),
  includeActivity: z.boolean().optional().default(false).describe('Include user activity and issue history'),
}).passthrough();

export const importProjectDataInputSchema = z.object({
  projectData: z.object({
    key: z.string().describe('Project key'),
    name: z.string().describe('Project name'),
    projectTypeKey: z.enum(['business', 'software', 'service_desk']).describe('Project type'),
    leadAccountId: z.string().describe('Project lead account ID'),
  }).describe('Project data to import'),
  includeIssues: z.boolean().optional().default(false).describe('Import issues (requires issue data)'),
  includeWorkflows: z.boolean().optional().default(false).describe('Import workflow configurations'),
  overwriteExisting: z.boolean().optional().default(false).describe('Overwrite existing configurations'),
}).passthrough();

export const importUserDataInputSchema = z.object({
  userData: z.object({
    accountId: z.string().describe('User account ID'),
    emailAddress: z.string().email().describe('User email address'),
    displayName: z.string().describe('User display name'),
  }).describe('User data to import'),
  includeGroups: z.boolean().optional().default(false).describe('Import group memberships'),
  createMissingGroups: z.boolean().optional().default(false).describe('Create groups that do not exist'),
}).passthrough();

// Reporting & Analytics input schemas
export const generateSystemReportInputSchema = z.object({
  reportType: z.enum(['basic', 'full', 'custom']).describe('Type of system report to generate'),
  sections: z.array(z.enum(['system', 'license', 'usage', 'security', 'performance']))
    .optional().describe('Specific sections to include (for custom reports)'),
}).passthrough();

export const generateUsageAnalyticsInputSchema = z.object({
  period: z.enum(['week', 'month', 'quarter', 'year']).optional()
    .describe('Predefined time period for analytics'),
  startDate: z.string().max(255).optional().describe('Start date for custom period (ISO 8601)'),
  endDate: z.string().max(255).optional().describe('End date for custom period (ISO 8601)'),
  includeAuditData: z.boolean().optional().default(false)
    .describe('Include audit log data in analytics'),
}).passthrough();

export const exportSystemConfigurationInputSchema = z.object({
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
}).passthrough();

export const importSystemConfigurationInputSchema = z.object({
  configurationData: z.object({
    permissionSchemes: z.array(z.unknown()).optional().describe('Permission schemes to import'),
    workflowSchemes: z.array(z.unknown()).optional().describe('Workflow schemes to import'),
    fieldConfigurations: z.array(z.unknown()).optional().describe('Field configurations to import'),
  }).describe('System configuration data to import'),
  overwriteExisting: z.boolean().optional().default(false)
    .describe('Overwrite existing configurations'),
  validateOnly: z.boolean().optional().default(false)
    .describe('Only validate import data without applying changes'),
}).passthrough();

export const generateComplianceReportInputSchema = z.object({
  reportType: z.enum(['gdpr', 'sox', 'security', 'audit']).describe('Type of compliance report'),
  startDate: z.string().optional().describe('Start date for compliance period (ISO 8601)'),
  endDate: z.string().optional().describe('End date for compliance period (ISO 8601)'),
  includeUserData: z.boolean().optional().default(true)
    .describe('Include user data in compliance report'),
  includeAuditLogs: z.boolean().optional().default(true)
    .describe('Include audit logs in compliance report'),
}).passthrough();

export const getDataRetentionPoliciesInputSchema = z.object({
  policyType: z.enum(['issues', 'attachments', 'audit', 'all']).optional().default('all')
    .describe('Type of retention policies to retrieve'),
}).passthrough();

export const bulkDataExportInputSchema = z.object({
  exportType: z.enum(['all', 'projects', 'users', 'system']).describe('Type of bulk export'),
  projectKeys: z.array(z.string()).optional()
    .describe('Specific project keys to export (for project export)'),
  includeAttachments: z.boolean().optional().default(false)
    .describe('Include file attachments in export'),
  compressionFormat: z.enum(['zip', 'tar', 'none']).optional().default('zip')
    .describe('Compression format for export'),
}).passthrough();

export const bulkDataImportInputSchema = z.object({
  importType: z.enum(['projects', 'users', 'system']).describe('Type of bulk import'),
  importData: z.unknown().describe('Import data payload'),
  validateOnly: z.boolean().optional().default(false)
    .describe('Only validate import data without applying changes'),
  batchSize: z.number().min(1).max(100).optional().default(10)
    .describe('Number of items to process in each batch'),
}).passthrough();

export const generateHealthCheckReportInputSchema = z.object({
  checkLevel: z.enum(['basic', 'comprehensive']).optional().default('basic')
    .describe('Level of health checks to perform'),
  checks: z.array(z.enum(['system', 'license', 'performance', 'security', 'integrations']))
    .optional().describe('Specific health checks to perform'),
}).passthrough();

export const getSystemStatisticsInputSchema = z.object({
  period: z.enum(['week', 'month', 'quarter', 'year']).optional().default('month')
    .describe('Time period for statistics'),
  includeProjectStats: z.boolean().optional().default(true)
    .describe('Include project-level statistics'),
  includeUserStats: z.boolean().optional().default(true)
    .describe('Include user activity statistics'),
}).passthrough();

export const generateCustomReportInputSchema = z.object({
  reportName: z.string().min(1).max(255).describe('Name for the custom report'),
  jqlQuery: z.string().describe('JQL query to define report data'),
  fields: z.array(z.string()).describe('Fields to include in the report'),
  groupBy: z.string().optional().describe('Field to group results by'),
  aggregations: z.array(z.enum(['count', 'sum', 'avg', 'min', 'max'])).optional()
    .describe('Aggregation functions to apply'),
  format: z.enum(['json', 'csv', 'xlsx']).optional().default('json')
    .describe('Output format for the report'),
}).passthrough();

export const generatePerformanceReportInputSchema = z.object({
  period: z.enum(['week', 'month', 'quarter']).optional().default('month')
    .describe('Time period for performance analysis'),
  includeSystemMetrics: z.boolean().optional().default(true)
    .describe('Include system performance metrics'),
  includeUsageMetrics: z.boolean().optional().default(true)
    .describe('Include usage performance metrics'),
  includeResponseTimes: z.boolean().optional().default(false)
    .describe('Include API response time analysis'),
}).passthrough();

export const getAllWorkflowsInputSchema = z.object({
  startAt: z.number().optional().default(0).describe('The starting index for results'),
  maxResults: z.number().max(100).optional().default(50).describe('The maximum number of results to return'),
}).passthrough();

export const getSystemLimitsInputSchema = z.object({}).passthrough();

// Issue Type Scheme input schemas
export const getIssueTypeSchemesInputSchema = z.object({
  startAt: z.number().optional().default(0).describe('The starting index for results'),
  maxResults: z.number().max(100).optional().default(50)
    .describe('The maximum number of results to return'),
  expand: z.string().optional()
    .describe('Comma-separated list of fields to expand (e.g., issueTypes)'),
}).passthrough();

export const createIssueTypeSchemeInputSchema = z.object({
  name: z.string().min(1).max(255).describe('The name of the issue type scheme'),
  description: z.string().optional().describe('The description of the issue type scheme'),
  issueTypeIds: z.array(z.string()).describe('Array of issue type IDs to include in the scheme'),
  defaultIssueTypeId: z.string().describe('The ID of the default issue type for this scheme'),
}).passthrough();

export const updateIssueTypeSchemeInputSchema = z.object({
  schemeId: z.string().describe('The ID of the issue type scheme to update'),
  name: z.string().min(1).max(255).optional().describe('The new name of the issue type scheme'),
  description: z.string().optional().describe('The new description of the issue type scheme'),
}).passthrough();

export const deleteIssueTypeSchemeInputSchema = z.object({
  schemeId: z.string().describe('The ID of the issue type scheme to delete'),
}).passthrough();

// Issue Type Screen Scheme input schemas
export const getIssueTypeScreenSchemesInputSchema = z.object({
  startAt: z.number().optional().default(0).describe('The starting index for results'),
  maxResults: z.number().max(100).optional().default(50)
    .describe('The maximum number of results to return'),
  expand: z.string().optional()
    .describe('Comma-separated list of fields to expand (e.g., issueTypeMappings)'),
}).passthrough();

export const createIssueTypeScreenSchemeInputSchema = z.object({
  name: z.string().min(1).max(255).describe('The name of the issue type screen scheme'),
  description: z.string().optional().describe('The description of the issue type screen scheme'),
  issueTypeMappings: z.array(z.object({
    issueTypeId: z.string().describe('The ID of the issue type'),
    screenSchemeId: z.string().describe('The ID of the screen scheme to associate'),
  })).describe('Mappings between issue types and screen schemes'),
}).passthrough();

// Screen Scheme input schemas
export const getScreenSchemesInputSchema = z.object({
  startAt: z.number().optional().default(0).describe('The starting index for results'),
  maxResults: z.number().max(100).optional().default(50)
    .describe('The maximum number of results to return'),
  expand: z.string().optional()
    .describe('Comma-separated list of fields to expand (e.g., screens)'),
}).passthrough();

export const createScreenSchemeInputSchema = z.object({
  name: z.string().min(1).max(255).describe('The name of the screen scheme'),
  description: z.string().optional().describe('The description of the screen scheme'),
  screens: z.object({
    default: z.string().describe('The ID of the default screen'),
    create: z.string().optional().describe('The ID of the create screen'),
    edit: z.string().optional().describe('The ID of the edit screen'),
    view: z.string().optional().describe('The ID of the view screen'),
  }).describe('Screen mappings for different operations'),
}).passthrough();

export const updateScreenSchemeInputSchema = z.object({
  screenSchemeId: z.string().describe('The ID of the screen scheme to update'),
  name: z.string().min(1).max(255).optional().describe('The new name of the screen scheme'),
  description: z.string().optional().describe('The new description of the screen scheme'),
  screens: z.object({
    default: z.string().optional().describe('The ID of the default screen'),
    create: z.string().optional().describe('The ID of the create screen'),
    edit: z.string().optional().describe('The ID of the edit screen'),
    view: z.string().optional().describe('The ID of the view screen'),
  }).optional().describe('Screen mappings for different operations'),
}).passthrough();

// Custom Field Context input schemas
export const getCustomFieldContextsInputSchema = z.object({
  fieldId: z.string().describe('The ID of the custom field'),
  startAt: z.number().optional().default(0).describe('The starting index for results'),
  maxResults: z.number().max(100).optional().default(50)
    .describe('The maximum number of results to return'),
}).passthrough();

export const createCustomFieldContextInputSchema = z.object({
  fieldId: z.string().describe('The ID of the custom field'),
  name: z.string().min(1).max(255).describe('The name of the context'),
  description: z.string().optional().describe('The description of the context'),
  projectIds: z.array(z.string()).optional()
    .describe('Array of project IDs to scope this context to (empty for global)'),
  issueTypeIds: z.array(z.string()).optional()
    .describe('Array of issue type IDs to scope this context to (empty for all issue types)'),
}).passthrough();

export const updateCustomFieldContextInputSchema = z.object({
  fieldId: z.string().describe('The ID of the custom field'),
  contextId: z.string().describe('The ID of the context to update'),
  name: z.string().min(1).max(255).optional().describe('The new name of the context'),
  description: z.string().optional().describe('The new description of the context'),
}).passthrough();

export const deleteCustomFieldContextInputSchema = z.object({
  fieldId: z.string().describe('The ID of the custom field'),
  contextId: z.string().describe('The ID of the context to delete'),
}).passthrough();

export const getCustomFieldOptionsInputSchema = z.object({
  fieldId: z.string().describe('The ID of the custom field'),
  contextId: z.string().describe('The ID of the context'),
  startAt: z.number().optional().default(0).describe('The starting index for results'),
  maxResults: z.number().max(100).optional().default(50)
    .describe('The maximum number of results to return'),
}).passthrough();

export const createCustomFieldOptionsInputSchema = z.object({
  fieldId: z.string().describe('The ID of the custom field'),
  contextId: z.string().describe('The ID of the context'),
  options: z.array(z.object({
    value: z.string().min(1).describe('The value of the option'),
    disabled: z.boolean().optional().default(false).describe('Whether the option is disabled'),
  })).min(1).describe('Array of options to create'),
}).passthrough();

// Field Configuration input schemas
export const getFieldConfigurationsInputSchema = z.object({
  startAt: z.number().optional().default(0).describe('The starting index for results'),
  maxResults: z.number().max(100).optional().default(50)
    .describe('The maximum number of results to return'),
}).passthrough();

export const createFieldConfigurationInputSchema = z.object({
  name: z.string().min(1).max(255).describe('The name of the field configuration'),
  description: z.string().optional().describe('The description of the field configuration'),
}).passthrough();

export const updateFieldConfigurationInputSchema = z.object({
  id: z.coerce.number().describe('The ID of the field configuration to update'),
  name: z.string().min(1).max(255).optional().describe('The new name of the field configuration'),
  description: z.string().optional().describe('The new description of the field configuration'),
}).passthrough();

export const getFieldConfigurationSchemesInputSchema = z.object({
  startAt: z.number().optional().default(0).describe('The starting index for results'),
  maxResults: z.number().max(100).optional().default(50)
    .describe('The maximum number of results to return'),
}).passthrough();

export const createFieldConfigurationSchemeInputSchema = z.object({
  name: z.string().min(1).max(255).describe('The name of the field configuration scheme'),
  description: z.string().optional().describe('The description of the field configuration scheme'),
  fieldConfigurationMappings: z.array(z.object({
    issueTypeId: z.string().describe('The ID of the issue type'),
    fieldConfigurationId: z.coerce.number().describe('The ID of the field configuration'),
  })).optional().describe('Mappings between issue types and field configurations'),
}).passthrough();

// Notification Scheme input schemas
export const getNotificationSchemesInputSchema = z.object({
  startAt: z.number().optional().default(0).describe('The starting index for results'),
  maxResults: z.number().max(100).optional().default(50)
    .describe('The maximum number of results to return'),
  expand: z.string().optional()
    .describe('Comma-separated list of fields to expand (e.g., notificationSchemeEvents)'),
}).passthrough();

export const createNotificationSchemeInputSchema = z.object({
  name: z.string().min(1).max(255).describe('The name of the notification scheme'),
  description: z.string().optional().describe('The description of the notification scheme'),
  notificationSchemeEvents: z.array(z.object({
    event: z.object({
      id: z.string().describe('The ID of the event'),
    }).describe('The event details'),
    notifications: z.array(z.object({
      type: z.enum(['CurrentAssignee', 'Reporter', 'CurrentUser', 'ProjectLead', 'ComponentLead', 'User', 'Group', 'ProjectRole', 'EmailAddress'])
        .describe('The type of notification'),
      parameter: z.string().optional()
        .describe('The parameter for the notification type (e.g., user ID, group name, role ID, email address)'),
    })).describe('Array of notifications for this event'),
  })).optional().describe('Array of event notifications for the scheme'),
}).passthrough();

// Screen input schemas
export const getScreensInputSchema = z.object({
  startAt: z.number().optional().default(0).describe('The starting index for results'),
  maxResults: z.number().max(100).optional().default(50)
    .describe('The maximum number of results to return'),
  expand: z.string().optional()
    .describe('Comma-separated list of fields to expand (e.g., tabs)'),
}).passthrough();

export const createScreenInputSchema = z.object({
  name: z.string().min(1).max(255).describe('The name of the screen'),
  description: z.string().optional().describe('The description of the screen'),
  tabs: z.array(z.object({
    name: z.string().min(1).describe('The name of the tab'),
    fields: z.array(z.object({
      id: z.string().describe('The ID of the field to add to the tab'),
    })).optional().describe('Array of fields for this tab'),
  })).optional().describe('Array of tabs for the screen'),
}).passthrough();

export const addFieldToScreenInputSchema = z.object({
  screenId: z.string().describe('The ID of the screen'),
  tabId: z.string().describe('The ID of the tab'),
  fieldId: z.string().describe('The ID of the field to add'),
}).passthrough();

// Dashboard input schemas
export const getDashboardsInputSchema = z.object({
  startAt: z.number().optional().default(0).describe('The starting index for results'),
  maxResults: z.number().max(100).optional().default(50)
    .describe('The maximum number of results to return'),
  filter: z.enum(['favourite', 'my', 'all']).optional().default('all')
    .describe('Filter dashboards by type'),
}).passthrough();

export const createDashboardInputSchema = z.object({
  name: z.string().min(1).max(255).describe('The name of the dashboard'),
  description: z.string().optional().describe('The description of the dashboard'),
  sharePermissions: z.array(z.object({
    type: z.enum(['global', 'project', 'group', 'authenticated', 'user'])
      .describe('The type of share permission'),
    project: z.object({
      id: z.string().optional(),
      key: z.string().optional(),
    }).optional().describe('Project details for project type permissions'),
    group: z.object({
      name: z.string(),
    }).optional().describe('Group details for group type permissions'),
    user: z.object({
      accountId: z.string(),
    }).optional().describe('User details for user type permissions'),
  })).optional().describe('Share permissions for the dashboard'),
}).passthrough();

export const getDashboardGadgetsInputSchema = z.object({
  dashboardId: z.string().describe('The ID of the dashboard'),
  moduleKey: z.string().optional()
    .describe('Filter gadgets by module key'),
  uri: z.string().optional()
    .describe('Filter gadgets by URI'),
  gadgetId: z.array(z.string()).optional()
    .describe('Filter gadgets by gadget IDs'),
}).passthrough();

export const addGadgetToDashboardInputSchema = z.object({
  dashboardId: z.string().describe('The ID of the dashboard'),
  title: z.string().optional().describe('The title of the gadget'),
  color: z.enum(['blue', 'red', 'yellow', 'green', 'cyan', 'purple', 'gray', 'white'])
    .optional().default('blue').describe('The color of the gadget'),
  position: z.object({
    column: z.number().min(0).max(1).describe('The column position (0 for left, 1 for right)'),
    row: z.number().min(0).describe('The row position within the column'),
  }).describe('The position of the gadget on the dashboard'),
  gadgetURI: z.string().describe('The URI of the gadget module'),
  properties: z.record(z.string(), z.unknown()).optional()
    .describe('Properties and configuration for the gadget'),
}).passthrough();

// Workflow Scheme input schemas
export const getWorkflowSchemesInputSchema = z.object({
  startAt: z.number().optional().default(0).describe('The starting index for results'),
  maxResults: z.number().max(100).optional().default(50)
    .describe('The maximum number of results to return'),
  expand: z.string().optional()
    .describe('Comma-separated list of fields to expand (e.g., workflows,projects)'),
}).passthrough();

export const createWorkflowSchemeInputSchema = z.object({
  name: z.string().min(1).max(255).describe('The name of the workflow scheme'),
  description: z.string().optional().describe('The description of the workflow scheme'),
  defaultWorkflow: z.string().optional()
    .describe('The name of the default workflow for this scheme'),
  issueTypeMappings: z.array(z.object({
    issueType: z.string().describe('The ID of the issue type'),
    workflow: z.string().describe('The name of the workflow to map to this issue type'),
  })).optional().describe('Mappings between issue types and workflows'),
}).passthrough();

export const updateWorkflowSchemeInputSchema = z.object({
  schemeId: z.string().describe('The ID of the workflow scheme to update'),
  name: z.string().min(1).max(255).optional().describe('The new name of the workflow scheme'),
  description: z.string().optional().describe('The new description of the workflow scheme'),
  defaultWorkflow: z.string().optional()
    .describe('The name of the new default workflow for this scheme'),
}).passthrough();

export const deleteWorkflowSchemeInputSchema = z.object({
  schemeId: z.string().describe('The ID of the workflow scheme to delete'),
}).passthrough();

export const assignWorkflowSchemeToProjectInputSchema = z.object({
  projectIdOrKey: z.string().describe('The project ID or key'),
  schemeId: z.string().describe('The ID of the workflow scheme to assign'),
}).passthrough();

export const getWorkflowSchemeProjectsInputSchema = z.object({
  schemeId: z.string().describe('The ID of the workflow scheme'),
}).passthrough();

export const getWorkflowSchemeIssueTypesInputSchema = z.object({
  schemeId: z.string().describe('The ID of the workflow scheme'),
}).passthrough();

export const setWorkflowSchemeIssueTypeInputSchema = z.object({
  schemeId: z.string().describe('The ID of the workflow scheme'),
  issueType: z.string().describe('The ID of the issue type'),
  workflow: z.string().describe('The name of the workflow to assign to this issue type'),
}).passthrough();

export const deleteWorkflowSchemeIssueTypeInputSchema = z.object({
  schemeId: z.string().describe('The ID of the workflow scheme'),
  issueType: z.string().describe('The ID of the issue type to remove from the scheme'),
}).passthrough();

// Individual Issue Type input schemas
export const getIssueTypesInputSchema = z.object({
  expand: z.string().optional()
    .describe('Comma-separated list of fields to expand'),
}).passthrough();

export const createIssueTypeInputSchema = z.object({
  name: z.string().min(1).max(255).describe('The name of the issue type'),
  description: z.string().optional().describe('The description of the issue type'),
  type: z.enum(['subtask', 'standard']).optional().default('standard')
    .describe('The type of issue type'),
  avatarId: z.number().optional().describe('The ID of the avatar for the issue type'),
}).passthrough();

export const updateIssueTypeInputSchema = z.object({
  issueTypeId: z.string().describe('The ID of the issue type to update'),
  name: z.string().min(1).max(255).optional().describe('The new name of the issue type'),
  description: z.string().optional().describe('The new description of the issue type'),
  avatarId: z.number().optional().describe('The new avatar ID for the issue type'),
}).passthrough();

export const deleteIssueTypeInputSchema = z.object({
  issueTypeId: z.string().describe('The ID of the issue type to delete'),
  alternativeIssueTypeId: z.string().optional()
    .describe('The ID of the issue type to replace issues with (if any exist)'),
}).passthrough();

// Enhanced Issue Type Screen Scheme input schemas
export const updateIssueTypeScreenSchemeInputSchema = z.object({
  schemeId: z.string().describe('The ID of the issue type screen scheme to update'),
  name: z.string().min(1).max(255).optional().describe('The new name of the scheme'),
  description: z.string().optional().describe('The new description of the scheme'),
}).passthrough();

export const deleteIssueTypeScreenSchemeInputSchema = z.object({
  schemeId: z.string().describe('The ID of the issue type screen scheme to delete'),
}).passthrough();

export const getIssueTypeScreenSchemeProjectsInputSchema = z.object({
  schemeId: z.string().describe('The ID of the issue type screen scheme'),
  startAt: z.number().optional().default(0).describe('The starting index for results'),
  maxResults: z.number().max(100).optional().default(50)
    .describe('The maximum number of results to return'),
}).passthrough();

export const assignIssueTypeScreenSchemeToProjectInputSchema = z.object({
  projectIdOrKey: z.string().describe('The project ID or key'),
  schemeId: z.string().describe('The ID of the issue type screen scheme to assign'),
}).passthrough();

// Issue Type Screen Scheme Mapping input schemas
export const addIssueTypeScreenSchemeMappingsInputSchema = z.object({
  schemeId: z.string().describe('The ID of the issue type screen scheme'),
  issueTypeMappings: z.array(z.object({
    issueTypeId: z.string().describe('The ID of the issue type'),
    screenSchemeId: z.string().describe('The ID of the screen scheme to associate'),
  })).min(1).describe('Array of new issue type to screen scheme mappings to add'),
}).passthrough();

export const removeIssueTypeScreenSchemeMappingsInputSchema = z.object({
  schemeId: z.string().describe('The ID of the issue type screen scheme'),
  issueTypeIds: z.array(z.string()).min(1).describe('Array of issue type IDs to remove mappings for'),
}).passthrough();

export const updateIssueTypeScreenSchemeDefaultInputSchema = z.object({
  schemeId: z.string().describe('The ID of the issue type screen scheme'),
  screenSchemeId: z.string().describe('The ID of the screen scheme to set as default'),
}).passthrough();

export const updateIssueTypeScreenSchemeMappingInputSchema = z.object({
  schemeId: z.string().describe('The ID of the issue type screen scheme'),
  issueTypeId: z.string().describe('The ID of the issue type to update mapping for'),
  screenSchemeId: z.string().describe('The ID of the screen scheme to associate with this issue type'),
}).passthrough();

// Enhanced Screen input schemas
export const deleteScreenSchemeInputSchema = z.object({
  screenSchemeId: z.string().describe('The ID of the screen scheme to delete'),
}).passthrough();

export const updateScreenInputSchema = z.object({
  screenId: z.string().describe('The ID of the screen to update'),
  name: z.string().min(1).max(255).optional().describe('The new name of the screen'),
  description: z.string().optional().describe('The new description of the screen'),
}).passthrough();

export const deleteScreenInputSchema = z.object({
  screenId: z.string().describe('The ID of the screen to delete'),
}).passthrough();

export const getScreenTabsInputSchema = z.object({
  screenId: z.string().describe('The ID of the screen'),
  projectKey: z.string().optional().describe('The project key for context'),
}).passthrough();

export const createScreenTabInputSchema = z.object({
  screenId: z.string().describe('The ID of the screen'),
  name: z.string().min(1).max(255).describe('The name of the tab'),
}).passthrough();

export const updateScreenTabInputSchema = z.object({
  screenId: z.string().describe('The ID of the screen'),
  tabId: z.string().describe('The ID of the tab to update'),
  name: z.string().min(1).max(255).describe('The new name of the tab'),
}).passthrough();

export const deleteScreenTabInputSchema = z.object({
  screenId: z.string().describe('The ID of the screen'),
  tabId: z.string().describe('The ID of the tab to delete'),
}).passthrough();

export const getScreenTabFieldsInputSchema = z.object({
  screenId: z.string().describe('The ID of the screen'),
  tabId: z.string().describe('The ID of the tab'),
  projectKey: z.string().optional().describe('The project key for context'),
}).passthrough();

export const removeFieldFromScreenTabInputSchema = z.object({
  screenId: z.string().describe('The ID of the screen'),
  tabId: z.string().describe('The ID of the tab'),
  fieldId: z.string().describe('The ID of the field to remove'),
}).passthrough();

export const moveScreenTabFieldInputSchema = z.object({
  screenId: z.string().describe('The ID of the screen'),
  tabId: z.string().describe('The ID of the tab'),
  fieldId: z.string().describe('The ID of the field to move'),
  after: z.string().optional().describe('The ID of the field to move after (if not specified, moves to beginning)'),
  position: z.enum(['Earlier', 'Later', 'First', 'Last']).optional()
    .describe('The position to move the field to'),
}).passthrough();

export const addFieldToDefaultScreenInputSchema = z.object({
  fieldId: z.string().describe('The ID of the field to add to the default screen'),
}).passthrough();

export const getScreenAvailableFieldsInputSchema = z.object({
  screenId: z.string().describe('The ID of the screen'),
}).passthrough();

// Enhanced Dashboard input schemas
export const getDashboardInputSchema = z.object({
  dashboardId: z.string().describe('The ID of the dashboard'),
}).passthrough();

export const updateDashboardInputSchema = z.object({
  dashboardId: z.string().describe('The ID of the dashboard to update'),
  name: z.string().min(1).max(255).optional().describe('The new name of the dashboard'),
  description: z.string().optional().describe('The new description of the dashboard'),
  sharePermissions: z.array(z.object({
    type: z.enum(['global', 'project', 'group', 'authenticated', 'user'])
      .describe('The type of share permission'),
    project: z.object({
      id: z.string().optional(),
      key: z.string().optional(),
    }).optional().describe('Project details for project type permissions'),
    group: z.object({
      name: z.string(),
    }).optional().describe('Group details for group type permissions'),
    user: z.object({
      accountId: z.string(),
    }).optional().describe('User details for user type permissions'),
  })).optional().describe('Share permissions for the dashboard'),
}).passthrough();

export const deleteDashboardInputSchema = z.object({
  dashboardId: z.string().describe('The ID of the dashboard to delete'),
}).passthrough();

export const copyDashboardInputSchema = z.object({
  dashboardId: z.string().describe('The ID of the dashboard to copy'),
  name: z.string().min(1).max(255).describe('The name for the new dashboard copy'),
  description: z.string().optional().describe('The description for the new dashboard copy'),
  sharePermissions: z.array(z.object({
    type: z.enum(['global', 'project', 'group', 'authenticated', 'user'])
      .describe('The type of share permission'),
    project: z.object({
      id: z.string().optional(),
      key: z.string().optional(),
    }).optional().describe('Project details for project type permissions'),
    group: z.object({
      name: z.string(),
    }).optional().describe('Group details for group type permissions'),
    user: z.object({
      accountId: z.string(),
    }).optional().describe('User details for user type permissions'),
  })).optional().describe('Share permissions for the new dashboard'),
}).passthrough();

export const updateDashboardGadgetInputSchema = z.object({
  dashboardId: z.string().describe('The ID of the dashboard'),
  gadgetId: z.string().describe('The ID of the gadget to update'),
  title: z.string().optional().describe('The new title of the gadget'),
  color: z.enum(['blue', 'red', 'yellow', 'green', 'cyan', 'purple', 'gray', 'white'])
    .optional().describe('The new color of the gadget'),
  position: z.object({
    column: z.number().min(0).max(1).describe('The column position (0 for left, 1 for right)'),
    row: z.number().min(0).describe('The row position within the column'),
  }).optional().describe('The new position of the gadget on the dashboard'),
  properties: z.record(z.string(), z.unknown()).optional()
    .describe('Properties and configuration for the gadget'),
}).passthrough();

export const deleteDashboardGadgetInputSchema = z.object({
  dashboardId: z.string().describe('The ID of the dashboard'),
  gadgetId: z.string().describe('The ID of the gadget to delete'),
}).passthrough();

export const getDashboardSharePermissionsInputSchema = z.object({
  dashboardId: z.string().describe('The ID of the dashboard'),
}).passthrough();

export const updateDashboardSharePermissionsInputSchema = z.object({
  dashboardId: z.string().describe('The ID of the dashboard'),
  sharePermissions: z.array(z.object({
    type: z.enum(['global', 'project', 'group', 'authenticated', 'user'])
      .describe('The type of share permission'),
    project: z.object({
      id: z.string().optional(),
      key: z.string().optional(),
    }).optional().describe('Project details for project type permissions'),
    group: z.object({
      name: z.string(),
    }).optional().describe('Group details for group type permissions'),
    user: z.object({
      accountId: z.string(),
    }).optional().describe('User details for user type permissions'),
  })).describe('The new share permissions for the dashboard'),
}).passthrough();

// Jira Service Management (JSM) input schemas

export const getServiceDesksInputSchema = z.object({
  start: z.number().optional().default(0).describe('The starting index for results'),
  limit: z.number().max(100).optional().default(50)
    .describe('The maximum number of results to return'),
}).passthrough();

export const getServiceDeskInputSchema = z.object({
  serviceDeskId: z.string().describe('The ID of the service desk'),
}).passthrough();

export const getRequestTypesInputSchema = z.object({
  serviceDeskId: z.string().describe('The ID of the service desk'),
  start: z.number().optional().default(0).describe('The starting index for results'),
  limit: z.number().max(100).optional().default(50)
    .describe('The maximum number of results to return'),
  expand: z.string().optional()
    .describe('Comma-separated list of fields to expand (e.g., field)'),
}).passthrough();

export const createRequestTypeInputSchema = z.object({
  serviceDeskId: z.string().describe('The ID of the service desk'),
  name: z.string().min(1).max(255).describe('The name of the request type'),
  description: z.string().optional().describe('The description of the request type'),
  helpText: z.string().optional().describe('The help text for the request type'),
  issueTypeId: z.string().describe('The ID of the issue type to use for this request type'),
  groupIds: z.array(z.string()).optional()
    .describe('Array of customer group names that can access this request type'),
}).passthrough();


export const deleteRequestTypeInputSchema = z.object({
  serviceDeskId: z.string().describe('The ID of the service desk'),
  requestTypeId: z.string().describe('The ID of the request type to delete'),
}).passthrough();

export const getRequestTypeFieldsInputSchema = z.object({
  serviceDeskId: z.string().describe('The ID of the service desk'),
  requestTypeId: z.string().describe('The ID of the request type'),
}).passthrough();

export const updateRequestTypeFieldsInputSchema = z.object({
  serviceDeskId: z.string().describe('The ID of the service desk'),
  requestTypeId: z.string().describe('The ID of the request type'),
  requestTypeFields: z.array(z.object({
    fieldId: z.string().describe('The ID of the field'),
    required: z.boolean().optional().describe('Whether the field is required'),
    visible: z.boolean().optional().describe('Whether the field is visible'),
    defaultValues: z.array(z.unknown()).optional().describe('Default values for the field'),
    presetValues: z.array(z.unknown()).optional().describe('Preset values for the field'),
  })).describe('Array of field configurations for the request type'),
}).passthrough();

export const getRequestTypeGroupsInputSchema = z.object({
  serviceDeskId: z.string().describe('The ID of the service desk'),
  requestTypeId: z.string().describe('The ID of the request type'),
  start: z.number().optional().default(0).describe('The starting index for results'),
  limit: z.number().max(100).optional().default(50)
    .describe('The maximum number of results to return'),
}).passthrough();

export const updateRequestTypeGroupsInputSchema = z.object({
  serviceDeskId: z.string().describe('The ID of the service desk'),
  requestTypeId: z.string().describe('The ID of the request type'),
  groupNames: z.array(z.string()).describe('Array of customer group names to grant access to this request type'),
}).passthrough();

// Global Organization input schemas
export const getOrganizationInfoInputSchema = z.object({}).passthrough();

export const getOrganizationPoliciesInputSchema = z.object({}).passthrough();

export const getOrganizationDomainsInputSchema = z.object({}).passthrough();

export const getOrganizationWorkspacesInputSchema = z.object({}).passthrough();

export const getOrganizationEventsInputSchema = z.object({
  limit: z.number().min(1).max(1000).optional().default(50)
    .describe('Maximum number of events to return (default: 50, max: 1000)'),
  from: z.string().optional()
    .describe('Start date for events (ISO 8601 format)'),
  to: z.string().optional()
    .describe('End date for events (ISO 8601 format)'),
}).passthrough();

// Identity Providers input schemas
export const getIdentityProvidersInputSchema = z.object({}).passthrough();

export const getDirectoryInfoInputSchema = z.object({
  directoryId: z.string().describe('Directory ID to get information for'),
}).passthrough();

export const getDirectorySyncStatusInputSchema = z.object({
  directoryId: z.string().optional()
    .describe('Directory ID to check sync status for (optional - checks all if not specified)'),
}).passthrough();

export const getDirectorySyncSettingsInputSchema = z.object({
  directoryId: z.string().describe('Directory ID to get sync settings for'),
}).passthrough();

export const getDirectoryUsersInputSchema = z.object({
  directoryId: z.string().optional()
    .describe('Directory ID to get users from (optional - gets from all directories if not specified)'),
  limit: z.number().min(1).max(1000).optional().default(100)
    .describe('Maximum number of users to return (default: 100, max: 1000)'),
  cursor: z.string().optional()
    .describe('Pagination cursor for large result sets'),
}).passthrough();

export const getDirectoryGroupsInputSchema = z.object({
  directoryId: z.string().optional()
    .describe('Directory ID to get groups from (optional - gets from all directories if not specified)'),
  limit: z.number().min(1).max(1000).optional().default(100)
    .describe('Maximum number of groups to return (default: 100, max: 1000)'),
}).passthrough();

export const getUserLastActiveInputSchema = z.object({
  accountId: z.string().describe('User account ID to get last active dates for'),
}).passthrough();

// Global User Analysis input schemas
export const getOrganizationUsersInputSchema = z.object({
  limit: z.number().min(1).max(1000).optional().default(100)
    .describe('Maximum number of users to return (default: 100, max: 1000)'),
  accountType: z.enum(['atlassian', 'customer', 'app']).optional()
    .describe('Filter by account type'),
  status: z.enum(['active', 'inactive', 'suspended']).optional()
    .describe('Filter by account status'),
}).passthrough();

export const searchOrganizationUsersInputSchema = z.object({
  query: z.string().optional()
    .describe('Search query for user name, email, or display name'),
  domain: z.string().optional()
    .describe('Filter by email domain (useful for Azure AD analysis)'),
  accountType: z.enum(['atlassian', 'customer', 'app']).optional()
    .describe('Filter by account type'),
  lastActiveAfter: z.string().optional()
    .describe('Filter users active after this date (ISO 8601 format)'),
  limit: z.number().min(1).max(1000).optional().default(50)
    .describe('Maximum number of users to return (default: 50, max: 1000)'),
}).passthrough();

export const getUserRoleAssignmentsInputSchema = z.object({
  accountId: z.string().describe('User account ID to get role assignments for'),
}).passthrough();

export const getUserGroupMembershipsInputSchema = z.object({
  accountId: z.string().describe('User account ID to get group memberships for'),
}).passthrough();

export const analyzeUserAccessInputSchema = z.object({
  accountId: z.string().optional().describe('User account ID to analyze'),
  email: z.string().optional().describe('User email to analyze (alternative to accountId)'),
}).passthrough();

// Customer Organization input schemas
export const getCustomerOrganizationsInputSchema = z.object({
  limit: z.number().min(1).max(1000).optional().default(50)
    .describe('Maximum number of organizations to return (default: 50, max: 1000)'),
  start: z.number().min(0).optional().default(0)
    .describe('Starting index for pagination (default: 0)'),
}).passthrough();

export const getOrganizationCustomersInputSchema = z.object({
  organizationId: z.string().describe('Organization ID to get customers from'),
  limit: z.number().min(1).max(1000).optional().default(50)
    .describe('Maximum number of customers to return (default: 50, max: 1000)'),
  start: z.number().min(0).optional().default(0)
    .describe('Starting index for pagination (default: 0)'),
}).passthrough();

export const getCustomerOrganizationMembershipInputSchema = z.object({
  accountId: z.string().optional().describe('Customer account ID to check membership for'),
  email: z.string().optional().describe('Customer email to check membership for (alternative to accountId)'),
}).passthrough();

export const getProjectCustomerOrganizationsInputSchema = z.object({
  projectKey: z.string().optional().describe('Service project key to get organizations for'),
  serviceDeskId: z.string().optional().describe('Service desk ID to get organizations for (alternative to projectKey)'),
}).passthrough();

export const analyzeCustomerVisibilityInputSchema = z.object({
  projectKey: z.string().describe('Service project key to analyze'),
  customerAccountId: z.string().optional()
    .describe('Specific customer account ID to analyze (optional)'),
}).passthrough();

// Simple Global Admin input schemas
export const diagnoseCustomerVisibilityInputSchema = z.object({
  projectKey: z.string().describe('Project key for the Jira Service Management project'),
}).passthrough();

export const getJiraInstanceInfoInputSchema = z.object({}).passthrough();

// Org-level Audit Logging & Compliance Monitoring input schemas
export const getOrgAuditEventsInputSchema = z.object({
  orgId: z.string().describe('The organization ID'),
  startDate: z.string().optional().describe('Start date for audit events (ISO 8601 format)'),
  endDate: z.string().optional().describe('End date for audit events (ISO 8601 format)'),
  eventType: z.string().optional().describe('Filter by specific event type'),
  actor: z.string().optional().describe('Filter by actor who performed the action'),
  resource: z.string().optional().describe('Filter by affected resource'),
  limit: z.number().max(1000).optional().default(100)
    .describe('Maximum number of events to return'),
  cursor: z.string().optional().describe('Pagination cursor for streaming results'),
}).passthrough();

export const getOrgAuditEventsStreamInputSchema = z.object({
  orgId: z.string().describe('The organization ID'),
  startDate: z.string().optional().describe('Start date for audit events (ISO 8601 format)'),
  endDate: z.string().optional().describe('End date for audit events (ISO 8601 format)'),
  eventType: z.string().optional().describe('Filter by specific event type'),
  limit: z.number().max(1000).optional().default(100)
    .describe('Maximum number of events to return per page'),
  cursor: z.string().optional().describe('Pagination cursor for next page'),
}).passthrough();

export const getOrgSecurityPoliciesInputSchema = z.object({
  orgId: z.string().describe('The organization ID'),
  policyType: z.string().optional().describe('Filter by policy type (e.g., access-control, data-governance)'),
  status: z.enum(['active', 'inactive', 'all']).optional().default('active')
    .describe('Filter policies by status'),
}).passthrough();

export const getOrgSecurityPolicyInputSchema = z.object({
  orgId: z.string().describe('The organization ID'),
  policyId: z.string().describe('The specific policy ID to retrieve'),
}).passthrough();

export const getOrgAuthPoliciesInputSchema = z.object({
  orgId: z.string().describe('The organization ID'),
  userIds: z.array(z.string()).optional().describe('Specific user IDs to fetch policies for'),
  policyType: z.string().optional().describe('Filter by authentication policy type'),
  includeInherited: z.boolean().optional().default(true)
    .describe('Include inherited policies from parent organizations'),
}).passthrough();

export const getOrgClassificationLevelsInputSchema = z.object({
  orgId: z.string().describe('The organization ID'),
  includeInactive: z.boolean().optional().default(false)
    .describe('Include inactive classification levels'),
}).passthrough();

export const getOrgClassificationLevelInputSchema = z.object({
  orgId: z.string().describe('The organization ID'),
  levelId: z.string().describe('The classification level ID'),
}).passthrough();

// API Usage & Security Monitoring input schemas
export const getOrgApiTokensInputSchema = z.object({
  orgId: z.string().describe('Organization ID to get API tokens for'),
  startAt: z.number().optional().default(0).describe('The starting index for results'),
  maxResults: z.number().max(1000).optional().default(100)
    .describe('The maximum number of API tokens to return (max 1000)'),
  includeExpired: z.boolean().optional().default(false)
    .describe('Whether to include expired tokens in the results'),
}).passthrough();

export const getOrgApiTokensCountInputSchema = z.object({
  orgId: z.string().describe('Organization ID to get API token count for'),
  includeExpired: z.boolean().optional().default(false)
    .describe('Whether to include expired tokens in the count'),
}).passthrough();

export const getOrgApiKeysInputSchema = z.object({
  orgId: z.string().describe('Organization ID to get API keys for'),
  startAt: z.number().optional().default(0).describe('The starting index for results'),
  maxResults: z.number().max(1000).optional().default(100)
    .describe('The maximum number of API keys to return (max 1000)'),
  includeInactive: z.boolean().optional().default(false)
    .describe('Whether to include inactive API keys in the results'),
}).passthrough();

export const getOrgApiKeysCountInputSchema = z.object({
  orgId: z.string().describe('Organization ID to get API key count for'),
  includeInactive: z.boolean().optional().default(false)
    .describe('Whether to include inactive API keys in the count'),
}).passthrough();
