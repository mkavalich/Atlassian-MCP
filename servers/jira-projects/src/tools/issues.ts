import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { JiraApiClient } from '../api/client.js';
import {
  createIssueSchema,
  getIssueSchema,
  updateIssueSchema,
  deleteIssueSchema,
  bulkCreateIssuesSchema,
  getIssueEditmetaFieldsSchema,
  getTransitionsSchema,
  transitionIssueSchema,
  assignIssueSchema,
  addCommentSchema,
  getCommentsSchema,
  updateCommentSchema,
  deleteCommentSchema,
} from '../validation/schemas.js';
import {
  createIssueInputSchema,
  getIssueInputSchema,
  updateIssueInputSchema,
  deleteIssueInputSchema,
  bulkCreateIssuesInputSchema,
  getIssueEditmetaFieldsInputSchema,
  getTransitionsInputSchema,
  transitionIssueInputSchema,
  assignIssueInputSchema,
  addCommentInputSchema,
  getCommentsInputSchema,
  updateCommentInputSchema,
  deleteCommentInputSchema,
} from '../validation/input-schemas.js';
import { JiraIssue, JiraTransition, JiraComment, JiraCommentPage, JiraCreateIssueResponse } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { wrapUserContent, sanitizeComment } from '../utils/sanitize.js';
import { toolExamples } from '../validation/tool-examples.js';

export async function registerIssueTools(server: McpServer, apiClient: JiraApiClient) {
  // =====================
  // PHASE 1: Core Issue CRUD Operations
  // =====================

  // Tool: createIssue
  server.registerTool(
    'create_issue',
    {
      title: 'Create Issue',
      description: `⚠️ MULTIPLE PREREQUISITES: Use "search_projects" first to find valid project keys AND "get_issue_types" to find valid issue types for the project. Creates a new issue in a Jira project with the specified summary, type, and optional fields. If you get "Project not found" or "Issue type not found" errors, the IDs likely don't exist - use the discovery tools first.

**Custom Fields:**
Pass custom field values via the customFields parameter using field IDs (e.g., "customfield_10001").

Value formats by field type:
- Select: {"customfield_10001": {"id": "10500"}} or {"value": "Option Name"}
- Multi-select: {"customfield_10002": [{"id": "10500"}, {"id": "10501"}]}
- User picker: {"customfield_10003": {"accountId": "557058:..."}}
- Cascading select: {"customfield_10004": {"value": "Parent", "child": {"value": "Child"}}}
- Number: {"customfield_10005": 42}
- Text: {"customfield_10006": "text value"}
- Date: {"customfield_10007": "2024-12-31"}

Use "get_fields_paginated" with type="custom" to discover field IDs and types.`,
      inputSchema: createIssueInputSchema,
      annotations: {
        title: 'Create Issue',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      examples: toolExamples['create_issue'],
    },
    async (params) => {
      try {
        const validatedParams = createIssueSchema.parse(params);

        // Build the issue fields object for Jira API
        const fields: Record<string, any> = {
          project: { key: validatedParams.projectKey },
          issuetype: { name: validatedParams.issueType },
          summary: validatedParams.summary,
        };

        // Add optional fields
        if (validatedParams.description) {
          // Convert plain text to ADF if it's a simple string
          fields.description = typeof validatedParams.description === 'string' && !validatedParams.description.includes('"type":')
            ? {
                type: 'doc',
                version: 1,
                content: [{
                  type: 'paragraph',
                  content: [{ type: 'text', text: validatedParams.description }]
                }]
              }
            : validatedParams.description;
        }

        if (validatedParams.assignee) {
          fields.assignee = { accountId: validatedParams.assignee };
        }
        if (validatedParams.reporter) {
          fields.reporter = { accountId: validatedParams.reporter };
        }
        if (validatedParams.priority) {
          fields.priority = { name: validatedParams.priority };
        }
        if (validatedParams.labels && validatedParams.labels.length > 0) {
          fields.labels = validatedParams.labels;
        }
        if (validatedParams.components && validatedParams.components.length > 0) {
          fields.components = validatedParams.components.map(c => ({ name: c }));
        }
        if (validatedParams.fixVersions && validatedParams.fixVersions.length > 0) {
          fields.fixVersions = validatedParams.fixVersions.map(v => ({ name: v }));
        }
        if (validatedParams.affectsVersions && validatedParams.affectsVersions.length > 0) {
          fields.versions = validatedParams.affectsVersions.map(v => ({ name: v }));
        }
        if (validatedParams.parentKey) {
          fields.parent = { key: validatedParams.parentKey };
        }
        if (validatedParams.dueDate) {
          fields.duedate = validatedParams.dueDate;
        }

        // Add custom fields
        if (validatedParams.customFields) {
          for (const [fieldId, value] of Object.entries(validatedParams.customFields)) {
            fields[fieldId] = value;
          }
        }

        const response = await apiClient.makeRequest<JiraCreateIssueResponse>({
          method: 'POST',
          path: '/issue',
          data: { fields },
        });

        if (response.success && response.data) {
          logger.info('Issue created successfully', {
            issueKey: response.data.key,
            issueId: response.data.id,
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                issue: {
                  id: response.data.id,
                  key: response.data.key,
                  self: response.data.self,
                },
                message: `Issue ${response.data.key} created successfully`,
                suggested_next_steps: [
                  `Use "get_issue" with issueIdOrKey="${response.data.key}" to view full details`,
                  `Use "update_issue" to modify the issue`,
                  `Use "transition_issue" to change the issue status`,
                  `Use "add_comment" to add comments`,
                ],
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to create issue: No data returned');
      } catch (error: any) {
        logger.error('Failed to create issue', { error: error.message, details: error.details });

        let suggestion = 'Check project key, issue type, and required fields';
        let next_steps: string[] = ['Use "search_projects" to find valid project keys', 'Use "get_issue_types" to find valid issue types'];
        const related_tools = ['search_projects', 'get_issue_types', 'get_fields_paginated'];
        let customFieldHints: Record<string, string> | undefined;

        // Parse error details for field-specific errors
        const errorDetails = error.details || error.response?.data;
        const errors = errorDetails?.errors || {};
        const errorMessages = errorDetails?.errorMessages || [];

        // Check for custom field validation errors
        const customFieldErrors: Record<string, string> = {};
        for (const [fieldId, fieldError] of Object.entries(errors)) {
          if (fieldId.startsWith('customfield_')) {
            customFieldErrors[fieldId] = fieldError as string;
          }
        }

        if (Object.keys(customFieldErrors).length > 0) {
          suggestion = 'Custom field validation failed. Check the field format requirements below.';
          customFieldHints = {
            select_field: 'Use {id: "optionId"} or {value: "Option Name"}',
            multi_select: 'Use [{id: "id1"}, {id: "id2"}] or [{value: "Name1"}]',
            user_picker: 'Use {accountId: "user-account-id"}',
            cascading_select: 'Use {value: "Parent", child: {value: "Child"}}',
            number_field: 'Use a plain number (e.g., 42)',
            text_field: 'Use a plain string',
            date_field: 'Use "YYYY-MM-DD" format',
            datetime_field: 'Use ISO 8601 format (e.g., "2024-01-15T10:30:00.000+0000")',
          };
          next_steps = [
            'Use "get_fields_paginated" with type="custom" to discover custom fields and their types',
            'Use "get_custom_field_options" to see valid options for select fields',
          ];
        } else if (error.message?.includes('project') || errors.project) {
          suggestion = 'Verify the project key exists. Use "search_projects" to find valid keys';
          next_steps = ['Use "search_projects" to find valid project keys'];
        } else if (error.message?.includes('issuetype') || error.message?.includes('issue type') || errors.issuetype) {
          suggestion = 'Verify the issue type exists in this project. Use "get_issue_types" to find valid types';
          next_steps = ['Use "get_issue_types" to find valid issue types for this project'];
        } else if (error.message?.includes('permission') || error.statusCode === 403) {
          suggestion = 'You may not have permission to create issues in this project';
          next_steps = ['Use "get_my_permissions" to check your permissions on this project'];
        } else if (error.message?.includes('required') || errorMessages.some((m: string) => m.includes('required'))) {
          suggestion = 'Missing required field. Check the project\'s required fields configuration';
          next_steps = [
            'Use "get_fields_paginated" to see which fields are required',
            'Check if the project has additional required custom fields',
          ];
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'CREATE_ISSUE_ERROR',
                message: error.message,
                details: error.details,
                fieldErrors: Object.keys(errors).length > 0 ? errors : undefined,
                errorMessages: errorMessages.length > 0 ? errorMessages : undefined,
                customFieldErrors: Object.keys(customFieldErrors).length > 0 ? customFieldErrors : undefined,
                suggestion,
                customFieldHints,
                next_steps,
                related_tools,
                workflow_guidance: 'Proper workflow: search_projects → get_issue_types → create_issue',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: getIssue
  server.registerTool(
    'get_issue',
    {
      title: 'Get Issue',
      description: '📖 READ: Retrieve detailed information about a specific issue by its key or ID. Use expand parameter to include additional data like changelog, transitions, or rendered fields.',
      inputSchema: getIssueInputSchema,
      annotations: {
        title: 'Get Issue',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = getIssueSchema.parse(params);

        const queryParams: Record<string, any> = {};
        if (validatedParams.fields && validatedParams.fields.length > 0) {
          queryParams.fields = validatedParams.fields.join(',');
        }
        if (validatedParams.expand && validatedParams.expand.length > 0) {
          queryParams.expand = validatedParams.expand.join(',');
        }
        if (validatedParams.properties && validatedParams.properties.length > 0) {
          queryParams.properties = validatedParams.properties.join(',');
        }

        const response = await apiClient.makeRequest<JiraIssue>({
          method: 'GET',
          path: `/issue/${validatedParams.issueIdOrKey}`,
          params: queryParams,
        });

        if (response.success && response.data) {
          const issue = response.data;

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                issue: {
                  id: issue.id,
                  key: issue.key,
                  self: issue.self,
                  fields: {
                    summary: wrapUserContent(issue.fields.summary),
                    description: wrapUserContent(issue.fields.description),
                    status: issue.fields.status,
                    priority: issue.fields.priority,
                    issuetype: issue.fields.issuetype,
                    project: {
                      key: issue.fields.project?.key,
                      name: issue.fields.project?.name,
                    },
                    assignee: issue.fields.assignee,
                    reporter: issue.fields.reporter,
                    created: issue.fields.created,
                    updated: issue.fields.updated,
                    duedate: issue.fields.duedate,
                    labels: issue.fields.labels,
                    components: issue.fields.components,
                    fixVersions: issue.fields.fixVersions,
                    resolution: issue.fields.resolution,
                    parent: issue.fields.parent,
                    subtasks: issue.fields.subtasks,
                  },
                  transitions: issue.transitions,
                  changelog: issue.changelog,
                },
                suggested_next_steps: [
                  `Use "update_issue" to modify this issue`,
                  `Use "get_transitions" to see available status changes`,
                  `Use "transition_issue" to move to a new status`,
                  `Use "add_comment" to add a comment`,
                  `Use "get_comments" to view existing comments`,
                ],
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get issue: No data returned');
      } catch (error: any) {
        logger.error('Failed to get issue', { error: error.message });

        let suggestion = 'Verify the issue key or ID is correct';
        if (error.message?.includes('not found') || error.message?.includes('does not exist')) {
          suggestion = 'Issue not found. Verify the issue key format (e.g., "PROJ-123") or use "search_jql" to find issues';
        } else if (error.message?.includes('permission')) {
          suggestion = 'You may not have permission to view this issue';
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_ISSUE_ERROR',
                message: error.message,
                details: error.details,
                suggestion,
                related_tools: ['search_jql', 'search_projects'],
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: updateIssue
  server.registerTool(
    'update_issue',
    {
      title: 'Update Issue',
      description: `✏️ UPDATE: Update fields on an existing issue. Only specified fields will be modified; omitted fields remain unchanged. Use "get_issue" first to see current values.

**Custom Fields:**
Pass custom field updates via the customFields parameter using field IDs (e.g., "customfield_10001").

Value formats by field type:
- Select: {"customfield_10001": {"id": "10500"}} or {"value": "Option Name"}
- Multi-select: {"customfield_10002": [{"id": "10500"}, {"id": "10501"}]}
- User picker: {"customfield_10003": {"accountId": "557058:..."}}
- Cascading select: {"customfield_10004": {"value": "Parent", "child": {"value": "Child"}}}
- Number: {"customfield_10005": 42}
- Text: {"customfield_10006": "text value"}
- Date: {"customfield_10007": "2024-12-31"}

Use "get_fields_paginated" with type="custom" to discover field IDs and types.
Use "get_custom_field_options" to see valid options for select fields.`,
      inputSchema: updateIssueInputSchema,
      annotations: {
        title: 'Update Issue',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      examples: toolExamples['update_issue'],
    },
    async (params) => {
      try {
        const validatedParams = updateIssueSchema.parse(params);
        const { issueIdOrKey, notifyUsers, customFields, ...updateFields } = validatedParams;

        // Build update payload
        const fields: Record<string, any> = {};

        if (updateFields.summary !== undefined) {
          fields.summary = updateFields.summary;
        }
        if (updateFields.description !== undefined) {
          fields.description = typeof updateFields.description === 'string' && !updateFields.description.includes('"type":')
            ? {
                type: 'doc',
                version: 1,
                content: [{
                  type: 'paragraph',
                  content: [{ type: 'text', text: updateFields.description }]
                }]
              }
            : updateFields.description;
        }
        if (updateFields.assignee !== undefined) {
          fields.assignee = updateFields.assignee === null ? null : { accountId: updateFields.assignee };
        }
        if (updateFields.priority !== undefined) {
          fields.priority = { name: updateFields.priority };
        }
        if (updateFields.labels !== undefined) {
          fields.labels = updateFields.labels;
        }
        if (updateFields.components !== undefined) {
          fields.components = updateFields.components.map(c => ({ name: c }));
        }
        if (updateFields.fixVersions !== undefined) {
          fields.fixVersions = updateFields.fixVersions.map(v => ({ name: v }));
        }
        if (updateFields.dueDate !== undefined) {
          fields.duedate = updateFields.dueDate;
        }

        // Add custom fields
        if (customFields) {
          for (const [fieldId, value] of Object.entries(customFields)) {
            fields[fieldId] = value;
          }
        }

        const queryParams: Record<string, any> = {};
        if (notifyUsers === false) {
          queryParams.notifyUsers = false;
        }

        const response = await apiClient.makeRequest<void>({
          method: 'PUT',
          path: `/issue/${issueIdOrKey}`,
          data: { fields },
          params: queryParams,
        });

        // Jira returns 204 No Content on success
        if (response.success) {
          logger.info('Issue updated successfully', { issueKey: issueIdOrKey });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                issueIdOrKey,
                updatedFields: Object.keys(fields),
                message: `Issue ${issueIdOrKey} updated successfully`,
                suggested_next_steps: [
                  `Use "get_issue" with issueIdOrKey="${issueIdOrKey}" to verify changes`,
                  `Use "transition_issue" to change the status`,
                ],
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to update issue');
      } catch (error: any) {
        logger.error('Failed to update issue', { error: error.message, details: error.details });

        let suggestion = 'Verify the issue exists and you have edit permissions';
        let next_steps: string[] = ['Use "get_issue" first to verify the issue exists and see current values'];
        const related_tools = ['get_issue', 'get_fields_paginated'];
        let customFieldHints: Record<string, string> | undefined;

        // Parse error details for custom field-specific errors
        const errorDetails = error.details || error.response?.data;
        const errors = errorDetails?.errors || {};
        const errorMessages = errorDetails?.errorMessages || [];

        // Check for custom field validation errors
        const customFieldErrors: Record<string, string> = {};
        for (const [fieldId, fieldError] of Object.entries(errors)) {
          if (fieldId.startsWith('customfield_')) {
            customFieldErrors[fieldId] = fieldError as string;
          }
        }

        if (Object.keys(customFieldErrors).length > 0) {
          suggestion = 'Custom field validation failed. Check the field format requirements below.';
          customFieldHints = {
            select_field: 'Use {id: "optionId"} or {value: "Option Name"}',
            multi_select: 'Use [{id: "id1"}, {id: "id2"}] or [{value: "Name1"}]',
            user_picker: 'Use {accountId: "user-account-id"}',
            cascading_select: 'Use {value: "Parent", child: {value: "Child"}}',
            number_field: 'Use a plain number (e.g., 42)',
            text_field: 'Use a plain string',
            date_field: 'Use "YYYY-MM-DD" format',
            datetime_field: 'Use ISO 8601 format (e.g., "2024-01-15T10:30:00.000+0000")',
          };
          next_steps = [
            'Use "get_fields_paginated" with type="custom" to discover available custom fields and their types',
            'Use "get_custom_field_options" to see valid options for select fields',
            'Use "get_issue" with expand=["editmeta"] to see field requirements',
          ];
        } else if (error.message?.includes('not found') || error.statusCode === 404) {
          suggestion = 'Issue not found. Verify the issue key is correct';
          next_steps = ['Use "search_jql" to find the correct issue key'];
        } else if (error.message?.includes('permission') || error.statusCode === 403) {
          suggestion = 'You may not have permission to edit this issue or specific fields';
          next_steps = [
            'Verify you have edit permissions on the project',
            'Check if specific fields have edit restrictions',
            'Use "get_my_permissions" to check your permissions',
          ];
        } else if (error.message?.includes('required') || errorMessages.some((m: string) => m.includes('required'))) {
          suggestion = 'A required field is missing or invalid';
          next_steps = [
            'Use "get_issue" with expand=["editmeta"] to see required fields',
            'Check if the project has mandatory fields configured',
          ];
        } else if (error.statusCode === 400) {
          suggestion = 'Invalid field value or format. Check the error details for specifics.';
          next_steps = [
            'Use "get_issue" with expand=["editmeta"] to see valid field values',
            'Verify field IDs are correct (custom fields should start with "customfield_")',
          ];
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'UPDATE_ISSUE_ERROR',
                message: error.message,
                details: error.details,
                fieldErrors: Object.keys(errors).length > 0 ? errors : undefined,
                errorMessages: errorMessages.length > 0 ? errorMessages : undefined,
                customFieldErrors: Object.keys(customFieldErrors).length > 0 ? customFieldErrors : undefined,
                suggestion,
                customFieldHints,
                next_steps,
                related_tools,
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: deleteIssue
  server.registerTool(
    'delete_issue',
    {
      title: 'Delete Issue',
      description: '🗑️ DELETE: Permanently delete an issue. This action cannot be undone. Use deleteSubtasks=true to also delete subtasks, otherwise deletion fails if subtasks exist.',
      inputSchema: deleteIssueInputSchema,
      annotations: {
        title: 'Delete Issue',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = deleteIssueSchema.parse(params);

        const queryParams: Record<string, any> = {};
        if (validatedParams.deleteSubtasks) {
          queryParams.deleteSubtasks = 'true';
        }

        const response = await apiClient.makeRequest<void>({
          method: 'DELETE',
          path: `/issue/${validatedParams.issueIdOrKey}`,
          params: queryParams,
        });

        if (response.success) {
          logger.info('Issue deleted successfully', { issueKey: validatedParams.issueIdOrKey });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                deletedIssue: validatedParams.issueIdOrKey,
                deletedSubtasks: validatedParams.deleteSubtasks || false,
                message: `Issue ${validatedParams.issueIdOrKey} has been permanently deleted`,
                warning: 'This action cannot be undone',
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to delete issue');
      } catch (error: any) {
        logger.error('Failed to delete issue', { error: error.message });

        let suggestion = 'Verify the issue exists and you have delete permissions';
        if (error.message?.includes('subtask')) {
          suggestion = 'Issue has subtasks. Use deleteSubtasks=true to delete them, or delete subtasks individually first';
        } else if (error.message?.includes('not found')) {
          suggestion = 'Issue not found. It may have already been deleted';
        } else if (error.message?.includes('permission')) {
          suggestion = 'You may not have permission to delete this issue';
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'DELETE_ISSUE_ERROR',
                message: error.message,
                details: error.details,
                suggestion,
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: bulkCreateIssues
  server.registerTool(
    'bulk_create_issues',
    {
      title: 'Bulk Create Issues',
      description: `📦 BATCH CREATE: Create multiple issues in a single request (up to 50). More efficient than multiple create_issue calls. Each issue is created independently - some may succeed while others fail.

**Usage:** Provide an array of issue objects, each with projectKey, issueType, and summary at minimum.

**Custom Fields:** Same format as create_issue - use field IDs like "customfield_10001".

**Response:** Returns created issues with their keys, plus any errors for failed items with the specific error message.`,
      inputSchema: bulkCreateIssuesInputSchema,
      annotations: {
        title: 'Bulk Create Issues',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      examples: toolExamples['bulk_create_issues'],
    },
    async (params) => {
      try {
        const validatedParams = bulkCreateIssuesSchema.parse(params);

        // Build the bulk issue update payload
        const issueUpdates = validatedParams.issues.map((issue) => {
          const fields: Record<string, any> = {
            project: { key: issue.projectKey },
            issuetype: { name: issue.issueType },
            summary: issue.summary,
          };

          if (issue.description) {
            fields.description = typeof issue.description === 'string' && !issue.description.includes('"type":')
              ? {
                  type: 'doc',
                  version: 1,
                  content: [{
                    type: 'paragraph',
                    content: [{ type: 'text', text: issue.description }]
                  }]
                }
              : issue.description;
          }

          if (issue.assignee) {
            fields.assignee = { accountId: issue.assignee };
          }
          if (issue.priority) {
            fields.priority = { name: issue.priority };
          }
          if (issue.labels && issue.labels.length > 0) {
            fields.labels = issue.labels;
          }
          if (issue.components && issue.components.length > 0) {
            fields.components = issue.components.map(c => ({ name: c }));
          }
          if (issue.dueDate) {
            fields.duedate = issue.dueDate;
          }

          // Add custom fields
          if (issue.customFields) {
            for (const [fieldId, value] of Object.entries(issue.customFields)) {
              fields[fieldId] = value;
            }
          }

          return { fields };
        });

        const response = await apiClient.makeRequest<{
          issues: Array<{ id: string; key: string; self: string }>;
          errors: Array<{
            status: number;
            elementErrors?: { errors: Record<string, string>; errorMessages: string[] };
            failedElementNumber?: number;
          }>;
        }>({
          method: 'POST',
          path: '/issue/bulk',
          data: { issueUpdates },
        });

        if (response.success && response.data) {
          const { issues = [], errors = [] } = response.data;

          logger.info('Bulk issue creation completed', {
            created: issues.length,
            failed: errors.length,
          });

          // Build error details for failed items
          const failedItems = errors.map((err, idx) => ({
            index: err.failedElementNumber ?? idx,
            status: err.status,
            errors: err.elementErrors?.errors,
            messages: err.elementErrors?.errorMessages,
          }));

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                summary: {
                  total: validatedParams.issues.length,
                  created: issues.length,
                  failed: errors.length,
                },
                createdIssues: issues.map(i => ({
                  id: i.id,
                  key: i.key,
                  self: i.self,
                })),
                failedItems: failedItems.length > 0 ? failedItems : undefined,
                suggested_next_steps: issues.length > 0 ? [
                  'Use "search_jql" to find and verify the created issues',
                  'Use "get_issue" to view individual issue details',
                ] : [
                  'Review the error messages and fix the issue data',
                  'Use "get_issue_types" to verify valid issue types',
                  'Use "search_projects" to verify valid project keys',
                ],
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to create issues: No response data');
      } catch (error: any) {
        logger.error('Failed to bulk create issues', { error: error.message, details: error.details });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'BULK_CREATE_ERROR',
                message: error.message,
                details: error.details,
                suggestion: 'Verify project keys and issue types are valid. Use "search_projects" and "get_issue_types" to discover valid values.',
                next_steps: [
                  'Use "search_projects" to find valid project keys',
                  'Use "get_issue_types" to find valid issue types',
                  'Reduce batch size if hitting rate limits',
                ],
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: getTransitions
  server.registerTool(
    'get_transitions',
    {
      title: 'Get Transitions',
      description: '🔍 DISCOVERY: Get available workflow transitions for an issue. Use this to find valid transition IDs before using "transition_issue". Shows what status changes are currently possible.',
      inputSchema: getTransitionsInputSchema,
      annotations: {
        title: 'Get Transitions',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = getTransitionsSchema.parse(params);

        const queryParams: Record<string, any> = {};
        if (validatedParams.expand) {
          queryParams.expand = validatedParams.expand;
        }

        const response = await apiClient.makeRequest<{ transitions: JiraTransition[] }>({
          method: 'GET',
          path: `/issue/${validatedParams.issueIdOrKey}/transitions`,
          params: queryParams,
        });

        if (response.success && response.data) {
          const transitions = response.data.transitions;

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                issueIdOrKey: validatedParams.issueIdOrKey,
                transitions: transitions.map(t => ({
                  id: t.id,
                  name: t.name,
                  to: {
                    id: t.to.id,
                    name: t.to.name,
                    statusCategory: t.to.statusCategory,
                  },
                  hasScreen: t.hasScreen,
                  isGlobal: t.isGlobal,
                  isConditional: t.isConditional,
                  fields: t.fields,
                })),
                count: transitions.length,
                usage_guidance: transitions.length > 0
                  ? `Found ${transitions.length} available transition(s). Use "transition_issue" with transitionId or transitionName to change status.`
                  : 'No transitions available. The issue may be in a final state or you lack permission to transition it.',
                example: transitions.length > 0
                  ? `transition_issue(issueIdOrKey="${validatedParams.issueIdOrKey}", transitionId="${transitions[0].id}")`
                  : undefined,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get transitions');
      } catch (error: any) {
        logger.error('Failed to get transitions', { error: error.message });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_TRANSITIONS_ERROR',
                message: error.message,
                details: error.details,
                suggestion: 'Verify the issue exists and you have permission to view it',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: transitionIssue
  server.registerTool(
    'transition_issue',
    {
      title: 'Transition Issue',
      description: '🔄 UPDATE: Move an issue to a new status via workflow transition. Use "get_transitions" first to find available transition IDs. Some transitions may require additional fields like resolution.',
      inputSchema: transitionIssueInputSchema,
      annotations: {
        title: 'Transition Issue',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      examples: toolExamples['transition_issue'],
    },
    async (params) => {
      try {
        const validatedParams = transitionIssueSchema.parse(params);

        // If transitionName is provided but not transitionId, look up the ID
        let transitionId = validatedParams.transitionId;
        if (!transitionId && validatedParams.transitionName) {
          const transitionsResponse = await apiClient.makeRequest<{ transitions: JiraTransition[] }>({
            method: 'GET',
            path: `/issue/${validatedParams.issueIdOrKey}/transitions`,
          });

          if (transitionsResponse.success && transitionsResponse.data) {
            const transition = transitionsResponse.data.transitions.find(
              t => t.name.toLowerCase() === validatedParams.transitionName!.toLowerCase()
            );
            if (transition) {
              transitionId = transition.id;
            } else {
              const availableNames = transitionsResponse.data.transitions.map(t => t.name).join(', ');
              throw new Error(`Transition "${validatedParams.transitionName}" not found. Available transitions: ${availableNames}`);
            }
          }
        }

        if (!transitionId) {
          throw new Error('Either transitionId or transitionName must be provided');
        }

        // Build transition payload
        const transitionData: Record<string, any> = {
          transition: { id: transitionId },
        };

        // Add fields if provided
        if (validatedParams.fields || validatedParams.resolution) {
          transitionData.fields = validatedParams.fields || {};
          if (validatedParams.resolution) {
            transitionData.fields.resolution = { name: validatedParams.resolution };
          }
        }

        // Add comment if provided
        if (validatedParams.comment) {
          transitionData.update = {
            comment: [{
              add: {
                body: {
                  type: 'doc',
                  version: 1,
                  content: [{
                    type: 'paragraph',
                    content: [{ type: 'text', text: validatedParams.comment }]
                  }]
                }
              }
            }]
          };
        }

        const response = await apiClient.makeRequest<void>({
          method: 'POST',
          path: `/issue/${validatedParams.issueIdOrKey}/transitions`,
          data: transitionData,
        });

        if (response.success) {
          logger.info('Issue transitioned successfully', {
            issueKey: validatedParams.issueIdOrKey,
            transitionId,
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                issueIdOrKey: validatedParams.issueIdOrKey,
                transitionId,
                transitionName: validatedParams.transitionName,
                commentAdded: !!validatedParams.comment,
                message: `Issue ${validatedParams.issueIdOrKey} transitioned successfully`,
                suggested_next_steps: [
                  `Use "get_issue" to verify the new status`,
                  `Use "get_transitions" to see new available transitions`,
                ],
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to transition issue');
      } catch (error: any) {
        logger.error('Failed to transition issue', { error: error.message });

        let suggestion = 'Use "get_transitions" to find available transitions for this issue';
        if (error.message?.includes('resolution')) {
          suggestion = 'This transition requires a resolution. Add resolution parameter (e.g., "Done", "Won\'t Do")';
        } else if (error.message?.includes('required')) {
          suggestion = 'This transition requires additional fields. Use "get_transitions" with expand to see required fields';
        } else if (error.message?.includes('not found')) {
          suggestion = 'Transition not available. The issue may not be in a state that allows this transition';
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'TRANSITION_ISSUE_ERROR',
                message: error.message,
                details: error.details,
                suggestion,
                workflow_guidance: 'Use "get_transitions" first to see available transitions and required fields',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: assignIssue
  server.registerTool(
    'assign_issue',
    {
      title: 'Assign Issue',
      description: '👤 UPDATE: Assign an issue to a user or unassign it. Use "search_site_users" to find valid account IDs. Set accountId to null to unassign.',
      inputSchema: assignIssueInputSchema,
      annotations: {
        title: 'Assign Issue',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = assignIssueSchema.parse(params);

        const response = await apiClient.makeRequest<void>({
          method: 'PUT',
          path: `/issue/${validatedParams.issueIdOrKey}/assignee`,
          data: { accountId: validatedParams.accountId },
        });

        if (response.success) {
          const action = validatedParams.accountId ? 'assigned' : 'unassigned';
          logger.info(`Issue ${action} successfully`, {
            issueKey: validatedParams.issueIdOrKey,
            accountId: validatedParams.accountId,
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                issueIdOrKey: validatedParams.issueIdOrKey,
                accountId: validatedParams.accountId,
                message: validatedParams.accountId
                  ? `Issue ${validatedParams.issueIdOrKey} assigned successfully`
                  : `Issue ${validatedParams.issueIdOrKey} unassigned`,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to assign issue');
      } catch (error: any) {
        logger.error('Failed to assign issue', { error: error.message });

        let suggestion = 'Verify the issue and user exist';
        if (error.message?.includes('user') || error.message?.includes('account')) {
          suggestion = 'User not found or not assignable. Use "search_site_users" to find valid account IDs';
        } else if (error.message?.includes('not found')) {
          suggestion = 'Issue not found. Verify the issue key is correct';
        } else if (error.message?.includes('permission')) {
          suggestion = 'You may not have permission to assign this issue';
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'ASSIGN_ISSUE_ERROR',
                message: error.message,
                details: error.details,
                suggestion,
                related_tools: ['search_site_users', 'get_issue'],
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // =====================
  // PHASE 2: Comment Operations
  // =====================

  // Tool: addComment
  server.registerTool(
    'add_comment',
    {
      title: 'Add Comment',
      description: '💬 CREATE: Add a comment to an issue. Supports plain text or Atlassian Document Format. Use visibility to restrict who can see the comment.',
      inputSchema: addCommentInputSchema,
      annotations: {
        title: 'Add Comment',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      examples: toolExamples['add_comment'],
    },
    async (params) => {
      try {
        const validatedParams = addCommentSchema.parse(params);

        // Build comment body - convert plain text to ADF
        // ADF structure: { type: 'doc', version: 1, content: [...] }
        let body: any;
        const bodyStr = validatedParams.body;

        // Check if body looks like ADF JSON (starts with { and contains "type":"doc")
        if (bodyStr.trim().startsWith('{') && bodyStr.includes('"type"') && bodyStr.includes('"doc"')) {
          try {
            body = JSON.parse(bodyStr);
          } catch {
            // If JSON parsing fails, treat as plain text
            body = {
              type: 'doc',
              version: 1,
              content: [{
                type: 'paragraph',
                content: [{ type: 'text', text: bodyStr }]
              }]
            };
          }
        } else {
          // Plain text - convert to ADF
          body = {
            type: 'doc',
            version: 1,
            content: [{
              type: 'paragraph',
              content: [{ type: 'text', text: bodyStr }]
            }]
          };
        }

        const commentData: Record<string, any> = { body };

        // Standard Jira visibility (role/group restriction)
        if (validatedParams.visibility) {
          commentData.visibility = {
            type: validatedParams.visibility.type,
            value: validatedParams.visibility.value,
          };
        }

        // Service Desk internal comment support
        // Uses the sd.public.comment property to control customer visibility
        if (validatedParams.internal !== undefined) {
          commentData.properties = [
            {
              key: 'sd.public.comment',
              value: { internal: validatedParams.internal }
            }
          ];
        }

        const response = await apiClient.makeRequest<JiraComment>({
          method: 'POST',
          path: `/issue/${validatedParams.issueIdOrKey}/comment`,
          data: commentData,
        });

        if (response.success && response.data) {
          const isInternal = validatedParams.internal === true;
          logger.info('Comment added successfully', {
            issueKey: validatedParams.issueIdOrKey,
            commentId: response.data.id,
            internal: isInternal,
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                comment: {
                  id: response.data.id,
                  self: response.data.self,
                  author: response.data.author,
                  created: response.data.created,
                  visibility: response.data.visibility,
                  internal: isInternal,
                },
                issueIdOrKey: validatedParams.issueIdOrKey,
                message: isInternal
                  ? `Internal comment added to ${validatedParams.issueIdOrKey} (hidden from customers)`
                  : `Comment added to ${validatedParams.issueIdOrKey}`,
                suggested_next_steps: [
                  `Use "get_comments" to view all comments`,
                  `Use "update_comment" with commentId="${response.data.id}" to edit`,
                ],
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to add comment');
      } catch (error: any) {
        logger.error('Failed to add comment', { error: error.message });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'ADD_COMMENT_ERROR',
                message: error.message,
                details: error.details,
                suggestion: 'Verify the issue exists and you have permission to comment',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: getComments
  server.registerTool(
    'get_comments',
    {
      title: 'Get Comments',
      description: '📖 READ: Retrieve comments on an issue with pagination support. Use expand="renderedBody" to get HTML-rendered content.',
      inputSchema: getCommentsInputSchema,
      annotations: {
        title: 'Get Comments',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = getCommentsSchema.parse(params);

        const queryParams: Record<string, any> = {
          startAt: validatedParams.startAt,
          maxResults: validatedParams.maxResults,
          orderBy: validatedParams.orderBy,
        };

        if (validatedParams.expand) {
          queryParams.expand = validatedParams.expand;
        }

        const response = await apiClient.makeRequest<JiraCommentPage>({
          method: 'GET',
          path: `/issue/${validatedParams.issueIdOrKey}/comment`,
          params: queryParams,
        });

        if (response.success && response.data) {
          const data = response.data;
          const hasMore = data.startAt + data.comments.length < data.total;

          // Transform comments with sanitized content
          const comments = data.comments.map(c => ({
            id: c.id,
            author: c.author,
            body: wrapUserContent(c.body),
            renderedBody: wrapUserContent(c.renderedBody),
            created: c.created,
            updated: c.updated,
            visibility: c.visibility,
          }));

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                comments,
                issueIdOrKey: validatedParams.issueIdOrKey,
                pagination: {
                  startAt: data.startAt,
                  maxResults: data.maxResults,
                  total: data.total,
                  returned: data.comments.length,
                  hasMore,
                  nextStartAt: hasMore ? data.startAt + data.comments.length : null,
                },
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get comments');
      } catch (error: any) {
        logger.error('Failed to get comments', { error: error.message });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_COMMENTS_ERROR',
                message: error.message,
                details: error.details,
                suggestion: 'Verify the issue exists and you have permission to view it',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: updateComment
  server.registerTool(
    'update_comment',
    {
      title: 'Update Comment',
      description: '✏️ UPDATE: Edit an existing comment. Use "get_comments" first to find the comment ID. You can only edit comments you authored (unless you have admin permissions).',
      inputSchema: updateCommentInputSchema,
      annotations: {
        title: 'Update Comment',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = updateCommentSchema.parse(params);

        // Build comment body - convert plain text to ADF
        // ADF structure: { type: 'doc', version: 1, content: [...] }
        let body: any;
        const bodyStr = validatedParams.body;

        // Check if body looks like ADF JSON (starts with { and contains "type":"doc")
        if (bodyStr.trim().startsWith('{') && bodyStr.includes('"type"') && bodyStr.includes('"doc"')) {
          try {
            body = JSON.parse(bodyStr);
          } catch {
            // If JSON parsing fails, treat as plain text
            body = {
              type: 'doc',
              version: 1,
              content: [{
                type: 'paragraph',
                content: [{ type: 'text', text: bodyStr }]
              }]
            };
          }
        } else {
          // Plain text - convert to ADF
          body = {
            type: 'doc',
            version: 1,
            content: [{
              type: 'paragraph',
              content: [{ type: 'text', text: bodyStr }]
            }]
          };
        }

        const commentData: Record<string, any> = { body };

        // Standard Jira visibility (role/group restriction)
        if (validatedParams.visibility) {
          commentData.visibility = {
            type: validatedParams.visibility.type,
            value: validatedParams.visibility.value,
          };
        }

        // Service Desk internal comment support
        // Uses the sd.public.comment property to control customer visibility
        if (validatedParams.internal !== undefined) {
          commentData.properties = [
            {
              key: 'sd.public.comment',
              value: { internal: validatedParams.internal }
            }
          ];
        }

        const response = await apiClient.makeRequest<JiraComment>({
          method: 'PUT',
          path: `/issue/${validatedParams.issueIdOrKey}/comment/${validatedParams.commentId}`,
          data: commentData,
        });

        if (response.success && response.data) {
          logger.info('Comment updated successfully', {
            issueKey: validatedParams.issueIdOrKey,
            commentId: validatedParams.commentId,
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                comment: {
                  id: response.data.id,
                  updated: response.data.updated,
                  updateAuthor: response.data.updateAuthor,
                  internal: validatedParams.internal,
                },
                issueIdOrKey: validatedParams.issueIdOrKey,
                message: `Comment updated successfully${validatedParams.internal ? ' (internal - hidden from customers)' : ''}`,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to update comment');
      } catch (error: any) {
        logger.error('Failed to update comment', { error: error.message });

        let suggestion = 'Verify the comment exists and you have permission to edit it';
        if (error.message?.includes('not found')) {
          suggestion = 'Comment not found. Use "get_comments" to find valid comment IDs';
        } else if (error.message?.includes('permission') || error.message?.includes('author')) {
          suggestion = 'You can only edit comments you authored (unless you have admin permissions)';
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'UPDATE_COMMENT_ERROR',
                message: error.message,
                details: error.details,
                suggestion,
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: deleteComment
  server.registerTool(
    'delete_comment',
    {
      title: 'Delete Comment',
      description: '🗑️ DELETE: Permanently delete a comment. Use "get_comments" first to find the comment ID. You can only delete comments you authored (unless you have admin permissions).',
      inputSchema: deleteCommentInputSchema,
      annotations: {
        title: 'Delete Comment',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = deleteCommentSchema.parse(params);

        const response = await apiClient.makeRequest<void>({
          method: 'DELETE',
          path: `/issue/${validatedParams.issueIdOrKey}/comment/${validatedParams.commentId}`,
        });

        if (response.success) {
          logger.info('Comment deleted successfully', {
            issueKey: validatedParams.issueIdOrKey,
            commentId: validatedParams.commentId,
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                issueIdOrKey: validatedParams.issueIdOrKey,
                deletedCommentId: validatedParams.commentId,
                message: 'Comment deleted successfully',
                warning: 'This action cannot be undone',
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to delete comment');
      } catch (error: any) {
        logger.error('Failed to delete comment', { error: error.message });

        let suggestion = 'Verify the comment exists and you have permission to delete it';
        if (error.message?.includes('not found')) {
          suggestion = 'Comment not found. It may have already been deleted';
        } else if (error.message?.includes('permission') || error.message?.includes('author')) {
          suggestion = 'You can only delete comments you authored (unless you have admin permissions)';
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'DELETE_COMMENT_ERROR',
                message: error.message,
                details: error.details,
                suggestion,
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // =====================
  // PHASE 6: Issue Edit Meta Discovery
  // =====================

  // Tool: getIssueEditmetaFields
  server.registerTool(
    'get_issue_editmeta_fields',
    {
      title: 'Get Issue Edit Meta Fields',
      description: `🔍 DISCOVERY: Get all editable fields for an existing issue. Shows which fields can be modified and their allowed values. Edit screens may differ from create screens - some fields become read-only after creation, and workflow transitions may affect which fields are editable.

**Use case:** Before calling "update_issue", use this to discover which fields are editable and what values they accept.`,
      inputSchema: getIssueEditmetaFieldsInputSchema,
      annotations: {
        title: 'Get Issue Edit Meta Fields',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = getIssueEditmetaFieldsSchema.parse(params);

        // The /issue/{key}/editmeta endpoint is deprecated (410 Gone) in Jira Cloud v3.
        // Use GET /issue/{key}?expand=editmeta instead, which embeds edit metadata in the response.
        const response = await apiClient.makeRequest<{
          editmeta?: {
            fields: Record<string, {
              required: boolean;
              name: string;
              key: string;
              operations: string[];
              allowedValues?: Array<Record<string, any>>;
              defaultValue?: any;
              schema: {
                type: string;
                system?: string;
                custom?: string;
                customId?: number;
                items?: string;
              };
            }>;
          };
        }>({
          method: 'GET',
          path: `/issue/${validatedParams.issueIdOrKey}`,
          queryParams: { expand: 'editmeta' },
        });

        if (response.success && response.data?.editmeta) {
          const fieldsMap = response.data.editmeta.fields || {};
          const fields = Object.entries(fieldsMap).map(([fieldId, field]) => ({
            fieldId,
            ...field,
          }));

          // Separate required vs optional for clarity
          const requiredFields = fields.filter(f => f.required);
          const optionalFields = fields.filter(f => !f.required);

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                issueIdOrKey: validatedParams.issueIdOrKey,
                summary: {
                  totalEditableFields: fields.length,
                  requiredCount: requiredFields.length,
                  optionalCount: optionalFields.length,
                  fieldsWithOptions: fields.filter(f => f.allowedValues && f.allowedValues.length > 0).length,
                },
                requiredFields: requiredFields.map(f => ({
                  fieldId: f.fieldId,
                  name: f.name,
                  schema: f.schema,
                  operations: f.operations,
                  allowedValues: f.allowedValues,
                })),
                optionalFields: optionalFields.map(f => ({
                  fieldId: f.fieldId,
                  name: f.name,
                  schema: f.schema,
                  operations: f.operations,
                  allowedValues: f.allowedValues,
                })),
                suggested_next_steps: [
                  'Use "update_issue" with the discovered fields to modify the issue',
                  'For custom fields, use the fieldId as the key in customFields parameter',
                ],
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get editmeta fields: No editmeta data in issue response');
      } catch (error: any) {
        logger.error('Failed to get editmeta fields', { error: error.message });

        let suggestion = 'Verify the issue exists and you have edit permissions';
        if (error.message?.includes('not found') || error.statusCode === 404) {
          suggestion = 'Issue not found. Verify the issue key with "search_jql"';
        } else if (error.message?.includes('permission') || error.statusCode === 403) {
          suggestion = 'You do not have permission to edit this issue';
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_EDITMETA_FIELDS_ERROR',
                message: error.message,
                suggestion,
                related_tools: ['get_issue', 'update_issue', 'search_jql'],
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Issue tools registered successfully (logging disabled for MCP compatibility)
}
