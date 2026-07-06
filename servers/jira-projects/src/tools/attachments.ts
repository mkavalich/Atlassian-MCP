import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { JiraApiClient } from '../api/client.js';
import {
  addAttachmentSchema,
  getAttachmentSchema,
  listIssueAttachmentsSchema,
  deleteAttachmentSchema,
  getAttachmentMetaSchema,
} from '../validation/schemas.js';
import {
  addAttachmentInputSchema,
  getAttachmentInputSchema,
  listIssueAttachmentsInputSchema,
  deleteAttachmentInputSchema,
  getAttachmentMetaInputSchema,
} from '../validation/input-schemas.js';
import { JiraAttachment } from '../types/index.js';
import { sanitizeErrorMessage } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

interface AttachmentMetaResponse {
  enabled: boolean;
  uploadLimit: number;
}

export async function registerAttachmentTools(server: McpServer, apiClient: JiraApiClient) {
  // =====================
  // Attachment Operations
  // =====================

  // Tool: addAttachment
  server.registerTool(
    'add_attachment',
    {
      title: 'Add Attachment',
      description: '📎 CREATE: Add an attachment to an issue. Provide the file content as base64 encoded string. Use "get_attachment_meta" first to check file size limits and allowed types.',
      inputSchema: addAttachmentInputSchema,
      annotations: {
        title: 'Add Attachment',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = addAttachmentSchema.parse(params);

        // Jira attachment API requires multipart/form-data
        // We need to send the file as form data with X-Atlassian-Token: no-check header
        const boundary = '----JiraAttachmentBoundary' + Date.now();

        // Decode base64 content
        const fileBuffer = Buffer.from(validatedParams.content, 'base64');

        // Build multipart form data manually
        const formData = [
          `--${boundary}`,
          `Content-Disposition: form-data; name="file"; filename="${validatedParams.filename}"`,
          `Content-Type: ${validatedParams.mimeType || 'application/octet-stream'}`,
          '',
          '', // File content placeholder
        ].join('\r\n');

        const formDataEnd = `\r\n--${boundary}--\r\n`;

        // Combine parts
        const formDataBuffer = Buffer.concat([
          Buffer.from(formData),
          fileBuffer,
          Buffer.from(formDataEnd),
        ]);

        const response = await apiClient.makeRequest<JiraAttachment[]>({
          method: 'POST',
          path: `/issue/${validatedParams.issueIdOrKey}/attachments`,
          data: formDataBuffer,
          headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'X-Atlassian-Token': 'no-check',
          },
        });

        if (response.success && response.data && response.data.length > 0) {
          const attachment = response.data[0];
          logger.info('Attachment added successfully', {
            issueKey: validatedParams.issueIdOrKey,
            attachmentId: attachment.id,
            filename: attachment.filename,
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                attachment: {
                  id: attachment.id,
                  self: attachment.self,
                  filename: attachment.filename,
                  size: attachment.size,
                  mimeType: attachment.mimeType,
                  author: attachment.author,
                  created: attachment.created,
                  content: attachment.content,
                  thumbnail: attachment.thumbnail,
                },
                issueIdOrKey: validatedParams.issueIdOrKey,
                message: `Attachment "${attachment.filename}" added to ${validatedParams.issueIdOrKey}`,
                suggested_next_steps: [
                  `Use "list_issue_attachments" to see all attachments on this issue`,
                  `Use "get_attachment" with attachmentId="${attachment.id}" to get download URL`,
                  `Use "delete_attachment" with attachmentId="${attachment.id}" to remove if needed`,
                ],
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to add attachment: No data returned');
      } catch (error: any) {
        logger.error('Failed to add attachment', { error: error.message });

        let suggestion = 'Check the issue exists and you have permission to add attachments';
        if (error.message?.includes('size') || error.message?.includes('limit')) {
          suggestion = 'File may exceed size limit. Use "get_attachment_meta" to check limits';
        } else if (error.message?.includes('not found')) {
          suggestion = 'Issue not found. Verify the issue key is correct';
        } else if (error.message?.includes('permission')) {
          suggestion = 'You may not have permission to add attachments to this issue';
        } else if (error.message?.includes('disabled')) {
          suggestion = 'Attachments may be disabled for this project. Check project settings';
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'ADD_ATTACHMENT_ERROR',
                message: sanitizeErrorMessage(error.message),
                details: error.details,
                suggestion,
                workflow_guidance: 'Use "get_attachment_meta" first to check if attachments are enabled and size limits',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: getAttachment
  server.registerTool(
    'get_attachment',
    {
      title: 'Get Attachment',
      description: '📖 READ: Get metadata and download URL for a specific attachment by its ID. Returns the content URL for downloading the file.',
      inputSchema: getAttachmentInputSchema,
      annotations: {
        title: 'Get Attachment',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = getAttachmentSchema.parse(params);

        const response = await apiClient.makeRequest<JiraAttachment>({
          method: 'GET',
          path: `/attachment/${validatedParams.attachmentId}`,
        });

        if (response.success && response.data) {
          const attachment = response.data;

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                attachment: {
                  id: attachment.id,
                  self: attachment.self,
                  filename: attachment.filename,
                  size: attachment.size,
                  sizeFormatted: formatBytes(attachment.size),
                  mimeType: attachment.mimeType,
                  author: attachment.author,
                  created: attachment.created,
                  content: attachment.content,
                  thumbnail: attachment.thumbnail,
                },
                download_guidance: `To download, use the "content" URL with your Jira authentication`,
                suggested_next_steps: [
                  `Use "delete_attachment" with attachmentId="${attachment.id}" to remove`,
                ],
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get attachment: No data returned');
      } catch (error: any) {
        logger.error('Failed to get attachment', { error: error.message });

        let suggestion = 'Verify the attachment ID is correct';
        if (error.message?.includes('not found')) {
          suggestion = 'Attachment not found. Use "list_issue_attachments" to find valid attachment IDs';
        } else if (error.message?.includes('permission')) {
          suggestion = 'You may not have permission to view this attachment';
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_ATTACHMENT_ERROR',
                message: sanitizeErrorMessage(error.message),
                details: error.details,
                suggestion,
                related_tools: ['list_issue_attachments'],
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: listIssueAttachments
  server.registerTool(
    'list_issue_attachments',
    {
      title: 'List Issue Attachments',
      description: '📋 READ: List all attachments on an issue. Returns attachment metadata including IDs, filenames, sizes, and download URLs.',
      inputSchema: listIssueAttachmentsInputSchema,
      annotations: {
        title: 'List Issue Attachments',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = listIssueAttachmentsSchema.parse(params);

        // Get issue with attachment field expanded
        const response = await apiClient.makeRequest<{ fields: { attachment?: JiraAttachment[] } }>({
          method: 'GET',
          path: `/issue/${validatedParams.issueIdOrKey}`,
          params: {
            fields: 'attachment',
          },
        });

        if (response.success && response.data) {
          const attachments = response.data.fields.attachment || [];

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                issueIdOrKey: validatedParams.issueIdOrKey,
                attachments: attachments.map(a => ({
                  id: a.id,
                  filename: a.filename,
                  size: a.size,
                  sizeFormatted: formatBytes(a.size),
                  mimeType: a.mimeType,
                  author: a.author,
                  created: a.created,
                  content: a.content,
                  thumbnail: a.thumbnail,
                })),
                count: attachments.length,
                totalSize: attachments.reduce((sum, a) => sum + a.size, 0),
                totalSizeFormatted: formatBytes(attachments.reduce((sum, a) => sum + a.size, 0)),
                usage_guidance: attachments.length > 0
                  ? `Found ${attachments.length} attachment(s). Use "get_attachment" with an ID for detailed info, or "delete_attachment" to remove.`
                  : 'No attachments on this issue. Use "add_attachment" to add one.',
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to list attachments: No data returned');
      } catch (error: any) {
        logger.error('Failed to list attachments', { error: error.message });

        let suggestion = 'Verify the issue exists and you have permission to view it';
        if (error.message?.includes('not found')) {
          suggestion = 'Issue not found. Verify the issue key format (e.g., "PROJ-123")';
        } else if (error.message?.includes('permission')) {
          suggestion = 'You may not have permission to view this issue';
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'LIST_ATTACHMENTS_ERROR',
                message: sanitizeErrorMessage(error.message),
                details: error.details,
                suggestion,
                related_tools: ['get_issue', 'search_jql'],
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: deleteAttachment
  server.registerTool(
    'delete_attachment',
    {
      title: 'Delete Attachment',
      description: '🗑️ DELETE: Permanently delete an attachment. This action cannot be undone. Use "list_issue_attachments" first to find the attachment ID.',
      inputSchema: deleteAttachmentInputSchema,
      annotations: {
        title: 'Delete Attachment',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = deleteAttachmentSchema.parse(params);

        const response = await apiClient.makeRequest<void>({
          method: 'DELETE',
          path: `/attachment/${validatedParams.attachmentId}`,
        });

        if (response.success) {
          logger.info('Attachment deleted successfully', {
            attachmentId: validatedParams.attachmentId,
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                deletedAttachmentId: validatedParams.attachmentId,
                message: `Attachment ${validatedParams.attachmentId} has been permanently deleted`,
                warning: 'This action cannot be undone',
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to delete attachment');
      } catch (error: any) {
        logger.error('Failed to delete attachment', { error: error.message });

        let suggestion = 'Verify the attachment exists and you have permission to delete it';
        if (error.message?.includes('not found')) {
          suggestion = 'Attachment not found. It may have already been deleted';
        } else if (error.message?.includes('permission')) {
          suggestion = 'You may not have permission to delete this attachment. You can usually only delete attachments you added.';
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'DELETE_ATTACHMENT_ERROR',
                message: sanitizeErrorMessage(error.message),
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

  // Tool: getAttachmentMeta
  server.registerTool(
    'get_attachment_meta',
    {
      title: 'Get Attachment Settings',
      description: '⚙️ READ: Get Jira attachment settings including whether attachments are enabled and the maximum upload size. Use this before adding attachments to check limits.',
      inputSchema: getAttachmentMetaInputSchema,
      annotations: {
        title: 'Get Attachment Settings',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        getAttachmentMetaSchema.parse(params);

        const response = await apiClient.makeRequest<AttachmentMetaResponse>({
          method: 'GET',
          path: '/attachment/meta',
        });

        if (response.success && response.data) {
          const meta = response.data;

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                attachmentSettings: {
                  enabled: meta.enabled,
                  uploadLimit: meta.uploadLimit,
                  uploadLimitFormatted: formatBytes(meta.uploadLimit),
                },
                guidance: meta.enabled
                  ? `Attachments are enabled. Maximum file size: ${formatBytes(meta.uploadLimit)}`
                  : 'Attachments are disabled on this Jira instance',
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get attachment settings');
      } catch (error: any) {
        logger.error('Failed to get attachment settings', { error: error.message });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_ATTACHMENT_META_ERROR',
                message: sanitizeErrorMessage(error.message),
                details: error.details,
                suggestion: 'Unable to retrieve attachment settings. Check your permissions.',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Attachment tools registered successfully
}

// Helper function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
