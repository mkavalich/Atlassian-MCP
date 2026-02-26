import { z } from 'zod';

// Project schemas
export const createProjectSchema = z.object({
  name: z.string().min(1).max(255).describe('The name of the project'),
  key: z.string()
    .min(2)
    .max(10)
    .regex(/^[A-Z][A-Z0-9]*$/, 'Project key must start with a letter and contain only uppercase letters and numbers')
    .describe('The project key (2-10 uppercase letters/numbers)'),
  projectTypeKey: z.enum(['business', 'software', 'service_desk'])
    .describe('The type of project to create'),
  description: z.string().optional().describe('The description of the project'),
  leadAccountId: z.string().describe('The account ID of the project lead'),
  assigneeType: z.enum(['PROJECT_LEAD', 'UNASSIGNED']).optional()
    .describe('The default assignee for issues created in this project'),
  url: z.string().url().optional().describe('A URL for the project'),
  avatarId: z.number().optional().describe('The ID of the project avatar'),
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
}).strict();

export const updateProjectSchema = z.object({
  projectIdOrKey: z.string().describe('The project ID or key'),
  name: z.string().min(1).max(255).optional().describe('The new name of the project'),
  key: z.string()
    .min(2)
    .max(10)
    .regex(/^[A-Z][A-Z0-9]*$/)
    .optional()
    .describe('The new project key'),
  description: z.string().optional().describe('The new description of the project'),
  leadAccountId: z.string().optional().describe('The new project lead account ID'),
  assigneeType: z.enum(['PROJECT_LEAD', 'UNASSIGNED']).optional()
    .describe('The new default assignee type'),
  url: z.string().url().optional().describe('The new project URL'),
  avatarId: z.number().optional().describe('The new avatar ID'),
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
  projectIdOrKey: z.string().describe('The project ID or key'),
  expand: z.string().optional()
    .describe('Comma-separated list of fields to expand'),
  fields: z.array(z.string()).optional()
    .describe('Specific fields to return'),
}).strict();

export const deleteProjectSchema = z.object({
  projectIdOrKey: z.string().describe('The project ID or key'),
  enableUndo: z.boolean().optional().default(false)
    .describe('Whether to enable undo for this deletion'),
}).strict();

export const searchProjectsSchema = z.object({
  query: z.string().optional().describe('Filter projects by name or key'),
  typeKey: z.string().optional().describe('Filter projects by project type key'),
  categoryId: z.number().optional().describe('Filter projects by project category ID'),
  action: z.enum(['view', 'browse', 'edit']).optional().describe('Filter projects by actions'),
  expand: z.string().optional().describe('Comma-separated list of fields to expand'),
  orderBy: z.enum(['category', 'issueCount', 'key', 'lastIssueUpdatedTime', 'name', 'owner', 'archivedDate', 'deletedDate'])
    .optional().describe('Sort the results by the specified field'),
  startAt: z.number().min(0).optional().default(0).describe('The starting index for results'),
  maxResults: z.number().min(1).max(100).optional().default(20).describe('Max results per page (default 20)'),
  fields: z.enum(['summary', 'full']).optional().default('summary')
    .describe('Response detail level'),
}).strict();

// Issue Type schemas
export const getIssueTypesSchema = z.object({
  expand: z.string().optional()
    .describe('Comma-separated list of fields to expand'),
  fields: z.enum(['summary', 'full']).optional().default('summary')
    .describe('Response detail level'),
}).strict();

export const createIssueTypeSchema = z.object({
  name: z.string().min(1).max(255).describe('The name of the issue type'),
  description: z.string().optional().describe('The description of the issue type'),
  type: z.enum(['subtask', 'standard']).optional().default('standard')
    .describe('The type of issue type'),
  avatarId: z.number().optional().describe('The ID of the avatar for the issue type'),
}).strict();

export const updateIssueTypeSchema = z.object({
  issueTypeId: z.string().describe('The ID of the issue type to update'),
  name: z.string().min(1).max(255).optional().describe('The new name of the issue type'),
  description: z.string().optional().describe('The new description of the issue type'),
  avatarId: z.number().optional().describe('The new avatar ID for the issue type'),
}).strict();

export const deleteIssueTypeSchema = z.object({
  issueTypeId: z.string().describe('The ID of the issue type to delete'),
  alternativeIssueTypeId: z.string().optional()
    .describe('The ID of the issue type to replace issues with'),
}).strict();

// Issue Type Scheme schemas
export const getIssueTypeSchemesSchema = z.object({
  startAt: z.number().optional().default(0).describe('The starting index for results'),
  maxResults: z.number().max(100).optional().default(20)
    .describe('Max results per page (default 20)'),
  expand: z.string().optional()
    .describe('Comma-separated list of fields to expand'),
  fields: z.enum(['summary', 'full']).optional().default('summary')
    .describe('Response detail level'),
}).strict();

export const createIssueTypeSchemeSchema = z.object({
  name: z.string().min(1).max(255).describe('The name of the issue type scheme'),
  description: z.string().optional().describe('The description of the issue type scheme'),
  issueTypeIds: z.array(z.string()).describe('Array of issue type IDs to include in the scheme'),
  defaultIssueTypeId: z.string().describe('The ID of the default issue type for this scheme'),
}).strict();

export const updateIssueTypeSchemeSchema = z.object({
  schemeId: z.string().describe('The ID of the issue type scheme to update'),
  name: z.string().min(1).max(255).optional().describe('The new name of the issue type scheme'),
  description: z.string().optional().describe('The new description of the issue type scheme'),
}).strict();

export const deleteIssueTypeSchemeSchema = z.object({
  schemeId: z.string().describe('The ID of the issue type scheme to delete'),
}).strict();

// Issue Type Scheme Mapping schemas
export const getIssueTypeSchemeMappingsSchema = z.object({
  startAt: z.number().optional().default(0).describe('The starting index for results'),
  maxResults: z.number().max(100).optional().default(50)
    .describe('Max results per page (default 50, max 100)'),
  projectId: z.array(z.string()).optional()
    .describe('Filter by project IDs to get their scheme mappings'),
}).strict();

export const addIssueTypesToSchemeSchema = z.object({
  schemeId: z.string().describe('The ID of the issue type scheme to modify'),
  issueTypeIds: z.array(z.string()).min(1)
    .describe('Array of issue type IDs to add to the scheme'),
}).strict();

export const assignIssueTypeSchemeToProjectSchema = z.object({
  projectId: z.string().describe('The ID of the project to assign the scheme to'),
  issueTypeSchemeId: z.string().describe('The ID of the issue type scheme to assign'),
}).strict();

// Issue Createmeta schemas
export const getIssueCreatemetaFieldsSchema = z.object({
  projectIdOrKey: z.string().min(1).describe('The project ID or key'),
  issueTypeId: z.string().min(1).describe('The issue type ID'),
  startAt: z.number().optional().default(0).describe('Pagination start'),
  maxResults: z.number().max(100).optional().default(50).describe('Max fields per page'),
}).strict();

export const getIssueCreatemetaIssuetypesSchema = z.object({
  projectIdOrKey: z.string().min(1).describe('The project ID or key'),
  startAt: z.number().optional().default(0).describe('Pagination start'),
  maxResults: z.number().max(100).optional().default(50).describe('Max issue types per page'),
}).strict();

// Issue Editmeta schema
export const getIssueEditmetaFieldsSchema = z.object({
  issueIdOrKey: z.string().min(1).describe('The issue ID or key'),
}).strict();

// Dashboard schemas
export const getDashboardsSchema = z.object({
  startAt: z.number().optional().default(0).describe('The starting index for results'),
  maxResults: z.number().max(100).optional().default(20)
    .describe('Max results per page (default 20)'),
  filter: z.enum(['favourite', 'my', 'all']).optional().default('all')
    .describe('Filter dashboards by type'),
  fields: z.enum(['summary', 'full']).optional().default('summary')
    .describe('Response detail level'),
}).strict();

export const createDashboardSchema = z.object({
  name: z.string().min(1).max(255).describe('The name of the dashboard'),
  description: z.string().optional().describe('The description of the dashboard'),
  sharePermissions: z.array(z.object({
    type: z.enum(['global', 'project', 'group', 'authenticated', 'user'])
      .describe('The type of share permission'),
    project: z.object({
      id: z.string().optional(),
      key: z.string().optional(),
    }).strict().optional().describe('Project details for project type permissions'),
    group: z.object({
      name: z.string(),
    }).strict().optional().describe('Group details for group type permissions'),
    user: z.object({
      accountId: z.string(),
    }).strict().optional().describe('User details for user type permissions'),
  }).strict()).optional().describe('Share permissions for the dashboard'),
}).strict();

export const getDashboardSchema = z.object({
  dashboardId: z.string().describe('The ID of the dashboard'),
}).strict();

export const updateDashboardSchema = z.object({
  dashboardId: z.string().describe('The ID of the dashboard to update'),
  name: z.string().min(1).max(255).optional().describe('The new name of the dashboard'),
  description: z.string().optional().describe('The new description of the dashboard'),
  sharePermissions: z.array(z.object({
    type: z.enum(['global', 'project', 'group', 'authenticated', 'user'])
      .describe('The type of share permission'),
    project: z.object({
      id: z.string().optional(),
      key: z.string().optional(),
    }).strict().optional().describe('Project details for project type permissions'),
    group: z.object({
      name: z.string(),
    }).strict().optional().describe('Group details for group type permissions'),
    user: z.object({
      accountId: z.string(),
    }).strict().optional().describe('User details for user type permissions'),
  }).strict()).optional().describe('Share permissions for the dashboard'),
}).strict();

export const deleteDashboardSchema = z.object({
  dashboardId: z.string().describe('The ID of the dashboard to delete'),
}).strict();

// Search schemas
export const searchJQLSchema = z.object({
  jql: z.string().describe('The JQL query string'),
  startAt: z.number().optional().default(0).describe('The starting index for results'),
  maxResults: z.number().max(100).optional().default(20)
    .describe('Max results per page (default 20)'),
  fields: z.array(z.string()).optional()
    .describe('Specific fields to return for each issue'),
  expand: z.string().optional()
    .describe('Comma-separated list of fields to expand'),
  validateQuery: z.enum(['strict', 'warn', 'none']).optional().default('strict')
    .describe('How to validate the JQL query'),
}).strict();

// Issue schemas
export const createIssueSchema = z.object({
  projectKey: z.string().min(1).max(10).describe('The project key where the issue will be created'),
  issueType: z.string().min(1).describe('The issue type name or ID (e.g., "Bug", "Task", "Story")'),
  summary: z.string().min(1).max(255).describe('The issue summary/title'),
  description: z.string().optional().describe('The issue description (supports Atlassian Document Format or plain text)'),
  assignee: z.string().optional().describe('The account ID of the assignee'),
  reporter: z.string().optional().describe('The account ID of the reporter'),
  priority: z.string().optional().describe('The priority name or ID (e.g., "High", "Medium", "Low")'),
  labels: z.array(z.string()).optional().describe('Array of label names to apply'),
  components: z.array(z.string()).optional().describe('Array of component names or IDs'),
  fixVersions: z.array(z.string()).optional().describe('Array of fix version names or IDs'),
  affectsVersions: z.array(z.string()).optional().describe('Array of affected version names or IDs'),
  parentKey: z.string().optional().describe('Parent issue key for subtasks'),
  dueDate: z.string().optional().describe('Due date in YYYY-MM-DD format'),
  customFields: z.record(z.string(), z.unknown()).optional().describe('Custom field values as key-value pairs (use field ID as key)'),
}).strict();

export const getIssueSchema = z.object({
  issueIdOrKey: z.string().min(1).describe('The issue ID or key (e.g., "PROJ-123")'),
  fields: z.array(z.string()).optional().describe('Specific fields to return'),
  expand: z.array(z.enum([
    'changelog', 'renderedFields', 'transitions', 'editmeta',
    'names', 'schema', 'operations', 'versionedRepresentations'
  ])).optional().describe('Additional data to include in the response'),
  properties: z.array(z.string()).optional().describe('Entity properties to return'),
}).strict();

export const updateIssueSchema = z.object({
  issueIdOrKey: z.string().min(1).describe('The issue ID or key to update'),
  summary: z.string().min(1).max(255).optional().describe('New issue summary/title'),
  description: z.string().optional().describe('New issue description'),
  assignee: z.string().nullable().optional().describe('New assignee account ID (null to unassign)'),
  priority: z.string().optional().describe('New priority name or ID'),
  labels: z.array(z.string()).optional().describe('New array of labels (replaces existing)'),
  components: z.array(z.string()).optional().describe('New array of components'),
  fixVersions: z.array(z.string()).optional().describe('New array of fix versions'),
  dueDate: z.string().nullable().optional().describe('New due date (YYYY-MM-DD) or null to clear'),
  customFields: z.record(z.string(), z.unknown()).optional().describe('Custom field updates'),
  notifyUsers: z.boolean().optional().default(true).describe('Whether to notify watchers of the update'),
}).strict();

export const deleteIssueSchema = z.object({
  issueIdOrKey: z.string().min(1).describe('The issue ID or key to delete'),
  deleteSubtasks: z.boolean().optional().default(false).describe('Whether to delete subtasks'),
}).strict();

// Bulk issue schema item - validates individual issue in bulk request
const bulkIssueItemRuntimeSchema = z.object({
  projectKey: z.string().min(1).max(10).describe('The project key'),
  issueType: z.string().min(1).describe('The issue type name'),
  summary: z.string().min(1).max(255).describe('The issue summary'),
  description: z.string().optional().describe('Issue description'),
  assignee: z.string().optional().describe('Account ID of assignee'),
  priority: z.string().optional().describe('Priority name'),
  labels: z.array(z.string()).optional().describe('Array of labels'),
  components: z.array(z.string()).optional().describe('Array of component names'),
  dueDate: z.string().optional().describe('Due date in YYYY-MM-DD format'),
  customFields: z.record(z.string(), z.unknown()).optional().describe('Custom field values'),
}).strict();

export const bulkCreateIssuesSchema = z.object({
  issues: z.array(bulkIssueItemRuntimeSchema).min(1).max(50)
    .describe('Array of issues to create (1-50 per request)'),
}).strict();

export const getTransitionsSchema = z.object({
  issueIdOrKey: z.string().min(1).describe('The issue ID or key'),
  expand: z.string().optional().describe('Expand transitions fields'),
}).strict();

export const transitionIssueSchema = z.object({
  issueIdOrKey: z.string().min(1).describe('The issue ID or key to transition'),
  transitionId: z.string().optional().describe('The ID of the transition to perform'),
  transitionName: z.string().optional().describe('The name of the transition to perform (alternative to transitionId)'),
  comment: z.string().optional().describe('Comment to add during transition'),
  resolution: z.string().optional().describe('Resolution name for transitions that require it'),
  fields: z.record(z.string(), z.unknown()).optional().describe('Field values required by the transition'),
}).strict();

export const assignIssueSchema = z.object({
  issueIdOrKey: z.string().min(1).describe('The issue ID or key to assign'),
  accountId: z.string().nullable().describe('The account ID of the new assignee (null to unassign)'),
}).strict();

// Comment schemas
export const addCommentSchema = z.object({
  issueIdOrKey: z.string().min(1).describe('The issue ID or key to comment on'),
  body: z.string().min(1).describe('The comment body text'),
  visibility: z.object({
    type: z.enum(['role', 'group']).describe('Visibility restriction type'),
    value: z.string().describe('Role name or group name'),
  }).strict().optional().describe('Restrict to specific role/group (standard Jira). Use "internal" for Service Desk.'),
  internal: z.boolean().optional().default(false)
    .describe('For Service Desk projects: true = internal (agents only), false = public (customer visible). This uses the sd.public.comment property.'),
}).strict();

export const getCommentsSchema = z.object({
  issueIdOrKey: z.string().min(1).describe('The issue ID or key'),
  startAt: z.number().optional().default(0).describe('Starting index for pagination'),
  maxResults: z.number().max(100).optional().default(50).describe('Maximum comments to return'),
  orderBy: z.enum(['created', '-created']).optional().default('-created').describe('Sort order'),
  expand: z.string().optional().describe('Expand renderedBody for HTML content'),
}).strict();

export const updateCommentSchema = z.object({
  issueIdOrKey: z.string().min(1).describe('The issue ID or key'),
  commentId: z.string().min(1).describe('The comment ID to update'),
  body: z.string().min(1).describe('The new comment body text'),
  visibility: z.object({
    type: z.enum(['role', 'group']).describe('Visibility restriction type'),
    value: z.string().describe('Role name or group name'),
  }).strict().optional().describe('Restrict to specific role/group (standard Jira). Use "internal" for Service Desk.'),
  internal: z.boolean().optional()
    .describe('For Service Desk projects: true = internal (agents only), false = public (customer visible). This uses the sd.public.comment property.'),
}).strict();

export const deleteCommentSchema = z.object({
  issueIdOrKey: z.string().min(1).describe('The issue ID or key'),
  commentId: z.string().min(1).describe('The comment ID to delete'),
}).strict();

// Attachment schemas
export const addAttachmentSchema = z.object({
  issueIdOrKey: z.string().min(1).describe('The issue ID or key to attach the file to'),
  filename: z.string().min(1).max(255).describe('The filename for the attachment'),
  content: z.string().min(1).describe('The file content as base64 encoded string'),
  mimeType: z.string().optional().describe('The MIME type of the file (e.g., "application/pdf", "image/png")'),
}).strict();

export const getAttachmentSchema = z.object({
  attachmentId: z.string().min(1).describe('The attachment ID'),
}).strict();

export const listIssueAttachmentsSchema = z.object({
  issueIdOrKey: z.string().min(1).describe('The issue ID or key to list attachments for'),
}).strict();

export const deleteAttachmentSchema = z.object({
  attachmentId: z.string().min(1).describe('The attachment ID to delete'),
}).strict();

export const getAttachmentMetaSchema = z.object({}).strict();

// ============================================================================
// Agile API Schemas (Jira Software - /rest/agile/1.0)
// ============================================================================

// Board schemas
export const getBoardsSchema = z.object({
  startAt: z.number().min(0).optional().default(0).describe('Starting index for pagination'),
  maxResults: z.number().min(1).max(100).optional().default(50).describe('Maximum boards to return (1-100)'),
  type: z.enum(['scrum', 'kanban', 'simple']).optional().describe('Filter by board type'),
  name: z.string().optional().describe('Filter boards by name (partial match)'),
  projectKeyOrId: z.string().optional().describe('Filter by project key or ID'),
}).strict();

export const getBoardSchema = z.object({
  boardId: z.coerce.number().describe('The board ID'),
}).strict();

export const getBoardConfigurationSchema = z.object({
  boardId: z.coerce.number().describe('The board ID'),
}).strict();

export const getBoardBacklogSchema = z.object({
  boardId: z.coerce.number().describe('The board ID'),
  startAt: z.number().min(0).optional().default(0).describe('Starting index for pagination'),
  maxResults: z.number().min(1).max(100).optional().default(50).describe('Maximum issues to return'),
  jql: z.string().optional().describe('Additional JQL filter for backlog issues'),
  fields: z.array(z.string()).optional().describe('Fields to return for each issue'),
}).strict();

export const createBoardSchema = z.object({
  name: z.string().min(1).max(255).describe('The name of the board'),
  type: z.enum(['scrum', 'kanban']).describe('Board type: "scrum" for sprint-based, "kanban" for continuous flow'),
  filterId: z.coerce.number().describe('The ID of the JQL filter that defines which issues appear on this board'),
  projectKeyOrId: z.string().optional().describe('Project key or ID to associate the board with'),
}).strict();

export const deleteBoardSchema = z.object({
  boardId: z.coerce.number().describe('The board ID to delete'),
}).strict();

// Sprint schemas
export const getSprintsForBoardSchema = z.object({
  boardId: z.coerce.number().describe('The board ID to get sprints for'),
  startAt: z.number().min(0).optional().default(0).describe('Starting index for pagination'),
  maxResults: z.number().min(1).max(100).optional().default(50).describe('Maximum sprints to return (1-100)'),
  state: z.enum(['future', 'active', 'closed']).optional().describe('Filter by sprint state'),
}).strict();

export const createSprintSchema = z.object({
  name: z.string().min(1).max(255).describe('The name of the sprint'),
  originBoardId: z.coerce.number().describe('The board ID where the sprint will be created'),
  goal: z.string().optional().describe('The goal for this sprint'),
  startDate: z.string().optional().describe('Start date in ISO 8601 format (e.g., 2024-01-15T09:00:00.000Z)'),
  endDate: z.string().optional().describe('End date in ISO 8601 format (e.g., 2024-01-29T17:00:00.000Z)'),
}).strict();

export const getSprintSchema = z.object({
  sprintId: z.coerce.number().describe('The sprint ID'),
}).strict();

export const updateSprintSchema = z.object({
  sprintId: z.coerce.number().describe('The sprint ID to update'),
  name: z.string().min(1).max(255).optional().describe('New sprint name'),
  goal: z.string().optional().describe('New sprint goal'),
  startDate: z.string().optional().describe('New start date in ISO 8601 format'),
  endDate: z.string().optional().describe('New end date in ISO 8601 format'),
  state: z.enum(['future', 'active', 'closed']).optional()
    .describe('New sprint state. Use "active" to start, "closed" to complete. Sprints must progress: future -> active -> closed'),
  completeDate: z.string().optional().describe('Complete date in ISO 8601 format (only when state is "closed")'),
}).strict();

export const deleteSprintSchema = z.object({
  sprintId: z.coerce.number().describe('The sprint ID to delete'),
}).strict();

export const getSprintIssuesSchema = z.object({
  sprintId: z.coerce.number().describe('The sprint ID'),
  startAt: z.number().min(0).optional().default(0).describe('Starting index for pagination'),
  maxResults: z.number().min(1).max(100).optional().default(50).describe('Maximum issues to return'),
  jql: z.string().optional().describe('Additional JQL filter'),
  fields: z.array(z.string()).optional().describe('Fields to return for each issue'),
}).strict();

export const moveIssuesToSprintSchema = z.object({
  sprintId: z.coerce.number().describe('The target sprint ID'),
  issues: z.array(z.string()).min(1).max(50).describe('Issue keys or IDs to move (1-50)'),
  rankBefore: z.string().optional().describe('Issue key to rank before'),
  rankAfter: z.string().optional().describe('Issue key to rank after'),
}).strict();

export const moveIssuesToBacklogSchema = z.object({
  issues: z.array(z.string()).min(1).max(50).describe('Issue keys or IDs to move to backlog (1-50)'),
}).strict();

// Reporting schemas
export const generateProjectReportSchema = z.object({
  projectKey: z.string().min(1),
  includeIssues: z.boolean().optional().default(true),
  includeProgress: z.boolean().optional().default(true),
  dateRange: z.string().optional(),
}).strict();

export const getProjectAnalyticsSchema = z.object({
  projectKey: z.string().min(1),
  metricsType: z.enum(['velocity', 'burndown', 'team_performance', 'all']).default('all'),
  timeFrame: z.enum(['7d', '30d', '90d', '6m', '1y']).default('30d'),
}).strict();
