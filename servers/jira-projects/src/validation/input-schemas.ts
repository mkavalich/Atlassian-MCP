import { z } from 'zod';

/**
 * Input schemas for Jira Projects MCP Server tools.
 *
 * All schemas use .passthrough() to allow Extensions to add
 * additional parameters (like responseFormat) without modifying these schemas.
 */

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
  fields: z.array(z.string()).optional()
    .describe('Specific fields to return (e.g., ["key", "name", "lead"]). Omit for all fields.'),
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

export const searchProjectsInputSchema = z.object({
  query: z.string().optional().describe('Filter projects by name or key'),
  typeKey: z.string().optional().describe('Filter projects by project type key'),
  categoryId: z.number().optional().describe('Filter projects by project category ID'),
  action: z.enum(['view', 'browse', 'edit']).optional().describe('Filter projects by actions'),
  expand: z.string().optional().describe('Comma-separated list of fields to expand'),
  orderBy: z.enum(['category', 'issueCount', 'key', 'lastIssueUpdatedTime', 'name', 'owner', 'archivedDate', 'deletedDate'])
    .optional().describe('Sort the results by the specified field'),
  startAt: z.number().optional().default(0).describe('The starting index for results'),
  maxResults: z.number().max(100).optional().default(20).describe('Max results per page (default 20, max 100)'),
  fields: z.enum(['summary', 'full']).optional().default('summary')
    .describe('Response detail level: "summary" returns key/name/type only, "full" returns all fields'),
}).passthrough();

// Issue Type input schemas
export const getIssueTypesInputSchema = z.object({
  expand: z.string().optional()
    .describe('Comma-separated list of fields to expand'),
  fields: z.enum(['summary', 'full']).optional().default('summary')
    .describe('Response detail level: "summary" returns id/name/subtask only, "full" returns all fields'),
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
    .describe('The ID of the issue type to replace issues with'),
}).passthrough();

// Issue Type Scheme input schemas
export const getIssueTypeSchemesInputSchema = z.object({
  startAt: z.number().optional().default(0).describe('The starting index for results'),
  maxResults: z.number().max(100).optional().default(20)
    .describe('Max results per page (default 20, max 100)'),
  expand: z.string().optional()
    .describe('Comma-separated list of fields to expand'),
  fields: z.enum(['summary', 'full']).optional().default('summary')
    .describe('Response detail level: "summary" returns id/name only, "full" returns all fields'),
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

// Issue Type Scheme Mapping input schemas
export const getIssueTypeSchemeMappingsInputSchema = z.object({
  startAt: z.number().optional().default(0).describe('The starting index for results'),
  maxResults: z.number().max(100).optional().default(50)
    .describe('Max results per page (default 50, max 100)'),
  projectId: z.array(z.string()).optional()
    .describe('Filter by project IDs to get their scheme mappings'),
}).passthrough();

export const addIssueTypesToSchemeInputSchema = z.object({
  schemeId: z.string().describe('The ID of the issue type scheme to modify'),
  issueTypeIds: z.array(z.string()).min(1)
    .describe('Array of issue type IDs to add to the scheme'),
}).passthrough();

export const assignIssueTypeSchemeToProjectInputSchema = z.object({
  projectId: z.string().describe('The ID of the project to assign the scheme to'),
  issueTypeSchemeId: z.string().describe('The ID of the issue type scheme to assign'),
}).passthrough();

// Issue Createmeta input schemas
export const getIssueCreatemetaFieldsInputSchema = z.object({
  projectIdOrKey: z.string().min(1).describe('The project ID or key (e.g., "PROJ" or "10001")'),
  issueTypeId: z.string().min(1).describe('The issue type ID (use get_issue_createmeta_issuetypes to find valid IDs)'),
  startAt: z.number().optional().default(0).describe('The starting index for pagination'),
  maxResults: z.number().max(100).optional().default(50).describe('Max fields per page (default 50, max 100)'),
}).passthrough();

export const getIssueCreatemetaIssuetypesInputSchema = z.object({
  projectIdOrKey: z.string().min(1).describe('The project ID or key (e.g., "PROJ" or "10001")'),
  startAt: z.number().optional().default(0).describe('The starting index for pagination'),
  maxResults: z.number().max(100).optional().default(50).describe('Max issue types per page (default 50, max 100)'),
}).passthrough();

// Issue Editmeta input schema
export const getIssueEditmetaFieldsInputSchema = z.object({
  issueIdOrKey: z.string().min(1).describe('The issue ID or key (e.g., "PROJ-123")'),
}).passthrough();

// Dashboard input schemas
export const getDashboardsInputSchema = z.object({
  startAt: z.number().optional().default(0).describe('The starting index for results'),
  maxResults: z.number().max(100).optional().default(20)
    .describe('Max results per page (default 20, max 100)'),
  filter: z.enum(['favourite', 'my', 'all']).optional().default('all')
    .describe('Filter dashboards by type'),
  fields: z.enum(['summary', 'full']).optional().default('summary')
    .describe('Response detail level: "summary" returns id/name only, "full" returns all fields'),
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

// Search schema
export const searchJQLInputSchema = z.object({
  jql: z.string().describe('The JQL query string'),
  startAt: z.number().optional().default(0).describe('The starting index for results'),
  maxResults: z.number().max(100).optional().default(20)
    .describe('Max results per page (default 20, max 100)'),
  fields: z.array(z.string()).optional()
    .describe('Specific fields to return (e.g., ["key", "summary", "status"]). Omit for default fields.'),
  expand: z.string().optional()
    .describe('Comma-separated list of fields to expand'),
  validateQuery: z.enum(['strict', 'warn', 'none']).optional().default('strict')
    .describe('How to validate the JQL query'),
}).passthrough();

// Reporting schemas
export const generateProjectReportInputSchema = z.object({
  projectKey: z.string().describe('The project key to generate report for'),
  includeIssues: z.boolean().optional().default(true).describe('Include issue details'),
  includeProgress: z.boolean().optional().default(true).describe('Include progress statistics'),
  dateRange: z.string().optional().describe('Date range for report (e.g., "30d", "1w")'),
}).passthrough();

// Issue input schemas
export const createIssueInputSchema = z.object({
  projectKey: z.string().min(1).max(10).describe('The project key where the issue will be created (e.g., "PROJ")'),
  issueType: z.string().min(1).describe('The issue type name (e.g., "Bug", "Task", "Story", "Epic")'),
  summary: z.string().min(1).max(255).describe('The issue summary/title - a brief description of the issue'),
  description: z.string().optional().describe('Detailed description of the issue. Supports plain text or Atlassian Document Format (ADF)'),
  assignee: z.string().optional().describe('The account ID of the user to assign the issue to. Use search_site_users to find account IDs'),
  reporter: z.string().optional().describe('The account ID of the reporter. Defaults to the authenticated user'),
  priority: z.string().optional().describe('Priority name (e.g., "Highest", "High", "Medium", "Low", "Lowest")'),
  labels: z.array(z.string()).optional().describe('Array of label names to apply to the issue'),
  components: z.array(z.string()).optional().describe('Array of component names or IDs to associate with the issue'),
  fixVersions: z.array(z.string()).optional().describe('Array of fix version names or IDs'),
  affectsVersions: z.array(z.string()).optional().describe('Array of affected version names or IDs'),
  parentKey: z.string().optional().describe('Parent issue key (required for subtasks, e.g., "PROJ-100")'),
  dueDate: z.string().optional().describe('Due date in YYYY-MM-DD format (e.g., "2024-12-31")'),
  customFields: z.record(z.string(), z.unknown()).optional().describe('Custom field values as key-value pairs. Use field ID as key (e.g., {"customfield_10001": "value"})'),
}).passthrough();

export const getIssueInputSchema = z.object({
  issueIdOrKey: z.string().min(1).describe('The issue ID or key (e.g., "PROJ-123" or "10001")'),
  fields: z.array(z.string()).optional().describe('Specific fields to return (e.g., ["summary", "status", "assignee"]). Omit for all fields'),
  expand: z.array(z.enum([
    'changelog', 'renderedFields', 'transitions', 'editmeta',
    'names', 'schema', 'operations', 'versionedRepresentations'
  ])).optional().describe('Additional data to include: changelog (history), transitions (available workflow actions), etc.'),
  properties: z.array(z.string()).optional().describe('Entity properties to return'),
}).passthrough();

export const updateIssueInputSchema = z.object({
  issueIdOrKey: z.string().min(1).describe('The issue ID or key to update (e.g., "PROJ-123")'),
  summary: z.string().min(1).max(255).optional().describe('New issue summary/title'),
  description: z.string().optional().describe('New issue description'),
  assignee: z.string().nullable().optional().describe('New assignee account ID. Set to null to unassign'),
  priority: z.string().optional().describe('New priority name (e.g., "High", "Medium", "Low")'),
  labels: z.array(z.string()).optional().describe('New array of labels (replaces all existing labels)'),
  components: z.array(z.string()).optional().describe('New array of component names or IDs'),
  fixVersions: z.array(z.string()).optional().describe('New array of fix version names or IDs'),
  dueDate: z.string().nullable().optional().describe('New due date (YYYY-MM-DD format) or null to clear'),
  customFields: z.record(z.string(), z.unknown()).optional().describe('Custom field updates as key-value pairs'),
  notifyUsers: z.boolean().optional().default(true).describe('Whether to send email notifications to watchers about this update'),
}).passthrough();

export const deleteIssueInputSchema = z.object({
  issueIdOrKey: z.string().min(1).describe('The issue ID or key to delete (e.g., "PROJ-123")'),
  deleteSubtasks: z.boolean().optional().default(false).describe('If true, also deletes all subtasks. If false and subtasks exist, deletion will fail'),
}).passthrough();

// Bulk issue schema - reuses single issue fields
const bulkIssueItemSchema = z.object({
  projectKey: z.string().min(1).max(10).describe('The project key (e.g., "PROJ")'),
  issueType: z.string().min(1).describe('The issue type name (e.g., "Bug", "Task", "Story")'),
  summary: z.string().min(1).max(255).describe('The issue summary/title'),
  description: z.string().optional().describe('Issue description'),
  assignee: z.string().optional().describe('Account ID of the assignee'),
  priority: z.string().optional().describe('Priority name (e.g., "High", "Medium", "Low")'),
  labels: z.array(z.string()).optional().describe('Array of labels'),
  components: z.array(z.string()).optional().describe('Array of component names'),
  dueDate: z.string().optional().describe('Due date in YYYY-MM-DD format'),
  customFields: z.record(z.string(), z.unknown()).optional().describe('Custom field values'),
});

export const bulkCreateIssuesInputSchema = z.object({
  issues: z.array(bulkIssueItemSchema).min(1).max(50)
    .describe('Array of issues to create (1-50 issues per request)'),
}).passthrough();

export const getTransitionsInputSchema = z.object({
  issueIdOrKey: z.string().min(1).describe('The issue ID or key (e.g., "PROJ-123")'),
  expand: z.string().optional().describe('Use "transitions.fields" to include fields required for each transition'),
}).passthrough();

export const transitionIssueInputSchema = z.object({
  issueIdOrKey: z.string().min(1).describe('The issue ID or key to transition (e.g., "PROJ-123")'),
  transitionId: z.string().optional().describe('The transition ID to perform. Use get_transitions to find available IDs'),
  transitionName: z.string().optional().describe('The transition name (e.g., "Start Progress", "Done"). Alternative to transitionId'),
  comment: z.string().optional().describe('Optional comment to add during the transition'),
  resolution: z.string().optional().describe('Resolution name (e.g., "Done", "Won\'t Do") - required for some transitions'),
  fields: z.record(z.string(), z.unknown()).optional().describe('Field values required by the transition screen'),
}).passthrough();

export const assignIssueInputSchema = z.object({
  issueIdOrKey: z.string().min(1).describe('The issue ID or key to assign (e.g., "PROJ-123")'),
  accountId: z.string().nullable().describe('Account ID of the user to assign. Set to null to unassign the issue. Use search_site_users to find account IDs'),
}).passthrough();

// Comment input schemas
export const addCommentInputSchema = z.object({
  issueIdOrKey: z.string().min(1).describe('The issue ID or key to add a comment to (e.g., "PROJ-123")'),
  body: z.string().min(1).describe('The comment text. Supports plain text or Atlassian Document Format (ADF)'),
  visibility: z.object({
    type: z.enum(['role', 'group']).describe('Restriction type: "role" for project roles, "group" for user groups'),
    value: z.string().describe('The role name (e.g., "Developers") or group name to restrict visibility to'),
  }).optional().describe('Restrict to specific role/group (standard Jira). For Service Desk internal comments, use "internal" instead'),
  internal: z.boolean().optional().default(false)
    .describe('SERVICE DESK ONLY: true = internal comment (agents only, hidden from customers), false = public (customer visible). Uses sd.public.comment property'),
}).passthrough();

export const getCommentsInputSchema = z.object({
  issueIdOrKey: z.string().min(1).describe('The issue ID or key (e.g., "PROJ-123")'),
  startAt: z.number().optional().default(0).describe('Starting index for pagination'),
  maxResults: z.number().max(100).optional().default(50).describe('Maximum number of comments to return (max 100)'),
  orderBy: z.enum(['created', '-created']).optional().default('-created').describe('Sort order: "created" for oldest first, "-created" for newest first'),
  expand: z.string().optional().describe('Use "renderedBody" to include HTML-rendered comment body'),
}).passthrough();

export const updateCommentInputSchema = z.object({
  issueIdOrKey: z.string().min(1).describe('The issue ID or key (e.g., "PROJ-123")'),
  commentId: z.string().min(1).describe('The comment ID to update. Use get_comments to find comment IDs'),
  body: z.string().min(1).describe('The new comment text'),
  visibility: z.object({
    type: z.enum(['role', 'group']).describe('Restriction type: "role" for project roles, "group" for user groups'),
    value: z.string().describe('The role name or group name to restrict visibility to'),
  }).optional().describe('Restrict to specific role/group (standard Jira). For Service Desk internal comments, use "internal" instead'),
  internal: z.boolean().optional()
    .describe('SERVICE DESK ONLY: true = internal comment (agents only), false = public (customer visible). Uses sd.public.comment property'),
}).passthrough();

export const deleteCommentInputSchema = z.object({
  issueIdOrKey: z.string().min(1).describe('The issue ID or key (e.g., "PROJ-123")'),
  commentId: z.string().min(1).describe('The comment ID to delete. Use get_comments to find comment IDs'),
}).passthrough();

// Attachment input schemas
export const addAttachmentInputSchema = z.object({
  issueIdOrKey: z.string().min(1).describe('The issue ID or key to attach the file to (e.g., "PROJ-123")'),
  filename: z.string().min(1).max(255).describe('The filename for the attachment (e.g., "screenshot.png", "document.pdf")'),
  content: z.string().min(1).describe('The file content as a base64 encoded string. Encode your file to base64 before sending'),
  mimeType: z.string().optional().describe('The MIME type of the file (e.g., "application/pdf", "image/png", "text/plain"). If omitted, defaults to "application/octet-stream"'),
}).passthrough();

export const getAttachmentInputSchema = z.object({
  attachmentId: z.string().min(1).describe('The attachment ID. Use list_issue_attachments to find attachment IDs'),
}).passthrough();

export const listIssueAttachmentsInputSchema = z.object({
  issueIdOrKey: z.string().min(1).describe('The issue ID or key to list attachments for (e.g., "PROJ-123")'),
}).passthrough();

export const deleteAttachmentInputSchema = z.object({
  attachmentId: z.string().min(1).describe('The attachment ID to delete. Use list_issue_attachments to find attachment IDs. This action cannot be undone'),
}).passthrough();

export const getAttachmentMetaInputSchema = z.object({}).passthrough();

// ============================================================================
// Agile API Input Schemas (Jira Software - /rest/agile/1.0)
// ============================================================================

// Board input schemas
export const getBoardsInputSchema = z.object({
  startAt: z.number().min(0).optional().default(0).describe('Starting index for pagination (0-based)'),
  maxResults: z.number().min(1).max(100).optional().default(50).describe('Maximum boards to return (1-100, default 50)'),
  type: z.enum(['scrum', 'kanban', 'simple']).optional().describe('Filter by board type. "scrum" for sprint boards, "kanban" for kanban boards'),
  name: z.string().optional().describe('Filter boards by name (partial match). E.g., "Backend" matches "Backend Team Board"'),
  projectKeyOrId: z.string().optional().describe('Filter by project key or ID (e.g., "PROJ" or "10001")'),
}).passthrough();

export const getBoardInputSchema = z.object({
  boardId: z.coerce.number().describe('The board ID. Use get_boards to find board IDs'),
}).passthrough();

export const getBoardConfigurationInputSchema = z.object({
  boardId: z.coerce.number().describe('The board ID. Returns column config, estimation settings, and filters'),
}).passthrough();

export const getBoardBacklogInputSchema = z.object({
  boardId: z.coerce.number().describe('The board ID. Use get_boards to find board IDs'),
  startAt: z.number().min(0).optional().default(0).describe('Starting index for pagination'),
  maxResults: z.number().min(1).max(100).optional().default(50).describe('Maximum issues to return (1-100)'),
  jql: z.string().optional().describe('Additional JQL filter to narrow backlog results (e.g., "priority = High")'),
  fields: z.array(z.string()).optional().describe('Specific issue fields to return (e.g., ["summary", "status", "priority"])'),
}).passthrough();

export const createBoardInputSchema = z.object({
  name: z.string().min(1).max(255).describe('Board name (e.g., "Backend Team Board", "Mobile Sprint Board")'),
  type: z.enum(['scrum', 'kanban']).describe('Board type: "scrum" enables sprints, "kanban" uses continuous flow'),
  filterId: z.coerce.number().describe('ID of the JQL filter defining board issues. Use create_filter in jira-system-admin first, then use the returned filter ID'),
  projectKeyOrId: z.string().optional().describe('Project to associate the board with (e.g., "PROJ" or "10001"). If omitted, board is user-scoped'),
}).passthrough();

export const deleteBoardInputSchema = z.object({
  boardId: z.coerce.number().describe('The board ID to delete. Use get_boards to find board IDs. This permanently removes the board but does not affect issues'),
}).passthrough();

// Sprint input schemas
export const getSprintsForBoardInputSchema = z.object({
  boardId: z.coerce.number().describe('The board ID. Only scrum boards have sprints. Use get_boards to find board IDs'),
  startAt: z.number().min(0).optional().default(0).describe('Starting index for pagination'),
  maxResults: z.number().min(1).max(100).optional().default(50).describe('Maximum sprints to return (1-100, default 50)'),
  state: z.enum(['future', 'active', 'closed']).optional().describe('Filter by sprint state: "future" (not started), "active" (in progress), "closed" (completed)'),
}).passthrough();

export const createSprintInputSchema = z.object({
  name: z.string().min(1).max(255).describe('Sprint name (e.g., "Sprint 1", "January Sprint")'),
  originBoardId: z.coerce.number().describe('The board ID where the sprint will be created. Must be a scrum board'),
  goal: z.string().optional().describe('Sprint goal - what the team aims to achieve this sprint'),
  startDate: z.string().optional().describe('Start date in ISO 8601 format (e.g., "2024-01-15T09:00:00.000Z"). Leave empty for unscheduled sprint'),
  endDate: z.string().optional().describe('End date in ISO 8601 format (e.g., "2024-01-29T17:00:00.000Z"). Typically 1-4 weeks after start'),
}).passthrough();

export const getSprintInputSchema = z.object({
  sprintId: z.coerce.number().describe('The sprint ID. Use get_sprints_for_board to find sprint IDs'),
}).passthrough();

export const updateSprintInputSchema = z.object({
  sprintId: z.coerce.number().describe('The sprint ID to update'),
  name: z.string().min(1).max(255).optional().describe('New sprint name'),
  goal: z.string().optional().describe('New sprint goal'),
  startDate: z.string().optional().describe('New start date in ISO 8601 format'),
  endDate: z.string().optional().describe('New end date in ISO 8601 format'),
  state: z.enum(['future', 'active', 'closed']).optional()
    .describe('Change sprint state. Sprints must progress in order: future -> active -> closed. Use "active" to start sprint, "closed" to complete'),
  completeDate: z.string().optional().describe('Complete date in ISO 8601 format. Only set when closing a sprint (state="closed")'),
}).passthrough();

export const deleteSprintInputSchema = z.object({
  sprintId: z.coerce.number().describe('The sprint ID to delete. Issues in this sprint will be moved to backlog. Cannot be undone'),
}).passthrough();

export const getSprintIssuesInputSchema = z.object({
  sprintId: z.coerce.number().describe('The sprint ID. Use get_sprints_for_board to find sprint IDs'),
  startAt: z.number().min(0).optional().default(0).describe('Starting index for pagination'),
  maxResults: z.number().min(1).max(100).optional().default(50).describe('Maximum issues to return (1-100)'),
  jql: z.string().optional().describe('Additional JQL filter (e.g., "status = Done" to see completed issues)'),
  fields: z.array(z.string()).optional().describe('Specific issue fields to return (e.g., ["summary", "status", "assignee"])'),
}).passthrough();

export const moveIssuesToSprintInputSchema = z.object({
  sprintId: z.coerce.number().describe('The target sprint ID. Issues will be added to this sprint'),
  issues: z.array(z.string()).min(1).max(50).describe('Issue keys to move (e.g., ["PROJ-1", "PROJ-2"]). Maximum 50 issues per request'),
  rankBefore: z.string().optional().describe('Issue key to rank the moved issues before (higher priority)'),
  rankAfter: z.string().optional().describe('Issue key to rank the moved issues after (lower priority)'),
}).passthrough();

export const moveIssuesToBacklogInputSchema = z.object({
  issues: z.array(z.string()).min(1).max(50).describe('Issue keys to move to backlog (e.g., ["PROJ-1", "PROJ-2"]). Removes from any sprint. Maximum 50 issues'),
}).passthrough();
