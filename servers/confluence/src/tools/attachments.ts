import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ConfluenceApiClient } from '../api/client.js';
import {
  getAttachmentsSchema,
  getAttachmentSchema,
  uploadAttachmentSchema,
  updateAttachmentSchema,
  deleteAttachmentSchema,
  downloadAttachmentSchema,
  getAttachmentVersionsSchema,
  copyAttachmentSchema,
} from '../validation/schemas.js';
import {
  getAttachmentsInputSchema,
  getAttachmentInputSchema,
  uploadAttachmentInputSchema,
  updateAttachmentInputSchema,
  deleteAttachmentInputSchema,
  downloadAttachmentInputSchema,
  getAttachmentVersionsInputSchema,
  copyAttachmentInputSchema,
} from '../validation/input-schemas.js';
import {
  ConfluenceAttachment,
  ContentVersion,
  CursorPaginatedResponse,
} from '../types/index.js';
import { logger } from '../utils/logger.js';

export async function registerAttachmentTools(server: McpServer, apiClient: ConfluenceApiClient) {
  // =====================
  // Attachment Read Operations
  // =====================

  // Tool: get_attachments
  server.registerTool(
    'get_attachments',
    {
      title: 'Get Attachments',
      description: '🔍 DISCOVERY: Get all attachments on a page. Filter by media type or filename.',
      inputSchema: getAttachmentsInputSchema,
      annotations: {
        title: 'Get Attachments',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = getAttachmentsSchema.parse(params);

        const queryParams: Record<string, any> = {};
        if (validatedParams.mediaType) {
          queryParams.mediaType = validatedParams.mediaType;
        }
        if (validatedParams.filename) {
          queryParams.filename = validatedParams.filename;
        }
        if (validatedParams.limit) {
          queryParams.limit = validatedParams.limit;
        }
        if (validatedParams.cursor) {
          queryParams.cursor = validatedParams.cursor;
        }

        const response = await apiClient.makeV2Request<CursorPaginatedResponse<ConfluenceAttachment>>({
          method: 'GET',
          path: `/pages/${validatedParams.pageId}/attachments`,
          params: queryParams,
        });

        if (response.success && response.data) {
          const attachments = response.data.results;
          const nextCursor = response.data._links?.next
            ? new URL(response.data._links.next, 'http://localhost').searchParams.get('cursor')
            : null;

          const attachmentsData = attachments.map(a => ({
            id: a.id,
            title: a.title,
            mediaType: a.mediaType,
            fileSize: a.fileSize,
            comment: a.comment,
            version: a.version?.number,
            createdAt: a.createdAt,
            downloadLink: a.downloadLink,
          }));

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                pageId: validatedParams.pageId,
                attachments: attachmentsData,
                pagination: {
                  returned: attachments.length,
                  hasMore: !!nextCursor,
                  nextCursor,
                },
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get attachments');
      } catch (error: any) {
        logger.error('Failed to get attachments', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_ATTACHMENTS_ERROR',
                message: error.message,
                suggestion: 'Verify the page ID is correct',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: get_attachment
  server.registerTool(
    'get_attachment',
    {
      title: 'Get Attachment',
      description: '📖 READ: Get details about a specific attachment.',
      inputSchema: getAttachmentInputSchema,
      annotations: {
        title: 'Get Attachment',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = getAttachmentSchema.parse(params);

        const response = await apiClient.makeV2Request<ConfluenceAttachment>({
          method: 'GET',
          path: `/attachments/${validatedParams.attachmentId}`,
        });

        if (response.success && response.data) {
          const attachment = response.data;

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                attachment: {
                  id: attachment.id,
                  title: attachment.title,
                  mediaType: attachment.mediaType,
                  mediaTypeDescription: attachment.mediaTypeDescription,
                  fileSize: attachment.fileSize,
                  comment: attachment.comment,
                  version: attachment.version,
                  pageId: attachment.pageId,
                  createdAt: attachment.createdAt,
                  downloadLink: attachment.downloadLink,
                  webuiLink: attachment.webuiLink,
                },
                suggested_next_steps: [
                  `Use "download_attachment" to get the file content`,
                  `Use "get_attachment_versions" to see version history`,
                ],
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get attachment');
      } catch (error: any) {
        logger.error('Failed to get attachment', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_ATTACHMENT_ERROR',
                message: error.message,
                suggestion: 'Verify the attachment ID is correct',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // =====================
  // Attachment Create/Update Operations
  // =====================

  // Tool: upload_attachment
  server.registerTool(
    'upload_attachment',
    {
      title: 'Upload Attachment',
      description: '⚠️ KNOWN LIMITATION: File uploads require multipart/form-data which may not work in all environments. Provide base64-encoded content. For large or binary files, use Confluence UI directly.',
      inputSchema: uploadAttachmentInputSchema,
      annotations: {
        title: 'Upload Attachment',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = uploadAttachmentSchema.parse(params);

        // Confluence attachment upload requires multipart/form-data
        // We use FormData for proper multipart encoding
        const FormData = (await import('form-data')).default;
        const formData = new FormData();

        // Decode base64 content to buffer
        let fileBuffer: Buffer;
        try {
          fileBuffer = Buffer.from(validatedParams.content, 'base64');
        } catch (decodeError) {
          throw new Error('Invalid base64 content. Ensure the content parameter is properly base64-encoded.');
        }

        // Append file with proper options
        formData.append('file', fileBuffer, {
          filename: validatedParams.filename,
          contentType: validatedParams.mediaType || 'application/octet-stream',
          knownLength: fileBuffer.length,
        });

        if (validatedParams.comment) {
          formData.append('comment', validatedParams.comment);
        }

        // Get FormData headers which include the boundary
        const formHeaders = formData.getHeaders();

        const response = await apiClient.makeV1Request<any>({
          method: 'POST',
          path: `/content/${validatedParams.pageId}/child/attachment`,
          headers: {
            'X-Atlassian-Token': 'no-check',
            'Content-Type': formHeaders['content-type'],
          },
          data: formData,
        });

        if (response.success && response.data) {
          const attachment = response.data.results?.[0] || response.data;
          logger.info('Attachment uploaded', {
            pageId: validatedParams.pageId,
            filename: validatedParams.filename,
          });

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                attachment: {
                  id: attachment.id,
                  title: attachment.title,
                  mediaType: attachment.mediaType,
                  fileSize: attachment.extensions?.fileSize,
                },
                message: `File "${validatedParams.filename}" uploaded successfully`,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to upload attachment');
      } catch (error: any) {
        logger.error('Failed to upload attachment', { error: error.message });

        let suggestion = 'Verify the page ID and file content are correct';
        const errorMsg = error.message?.toLowerCase() || '';
        const isMediaTypeError = errorMsg.includes('415') ||
          errorMsg.includes('unsupported media') ||
          errorMsg.includes('content-type');

        if (isMediaTypeError) {
          suggestion = 'Content-Type header issue. This is a known limitation with multipart/form-data handling. Use Confluence UI or curl to upload files instead.';
        } else if (errorMsg.includes('base64')) {
          suggestion = 'Ensure the content is valid base64-encoded. You can encode files using: base64 -i filename';
        } else if (errorMsg.includes('size') || errorMsg.includes('large')) {
          suggestion = 'File may be too large. Check your Confluence attachment size limits';
        } else if (errorMsg.includes('not found') || errorMsg.includes('404')) {
          suggestion = 'Page not found. Verify the pageId is correct';
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'UPLOAD_ATTACHMENT_ERROR',
                message: error.message,
                suggestion,
                knownLimitation: isMediaTypeError
                  ? 'Multipart/form-data file uploads have limited support. Use Confluence UI or: curl -X POST -H "X-Atlassian-Token: no-check" -F "file=@filename" "https://your-site.atlassian.net/wiki/rest/api/content/{pageId}/child/attachment"'
                  : undefined,
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: update_attachment
  server.registerTool(
    'update_attachment',
    {
      title: 'Update Attachment',
      description: '✏️ UPDATE: Upload a new version of an existing attachment.',
      inputSchema: updateAttachmentInputSchema,
      annotations: {
        title: 'Update Attachment',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = updateAttachmentSchema.parse(params);

        // First get the attachment to find its page
        const attachmentInfo = await apiClient.makeV2Request<ConfluenceAttachment>({
          method: 'GET',
          path: `/attachments/${validatedParams.attachmentId}`,
        });

        if (!attachmentInfo.success || !attachmentInfo.data) {
          throw new Error('Attachment not found');
        }

        const pageId = attachmentInfo.data.pageId;
        const filename = attachmentInfo.data.title;

        // Update attachment requires multipart/form-data like upload
        const FormData = (await import('form-data')).default;
        const formData = new FormData();

        // Decode base64 content to buffer
        let fileBuffer: Buffer;
        try {
          fileBuffer = Buffer.from(validatedParams.content, 'base64');
        } catch (decodeError) {
          throw new Error('Invalid base64 content. Ensure the content parameter is properly base64-encoded.');
        }

        // Append file with proper options
        formData.append('file', fileBuffer, {
          filename: filename,
          contentType: attachmentInfo.data.mediaType || 'application/octet-stream',
          knownLength: fileBuffer.length,
        });

        if (validatedParams.comment) {
          formData.append('comment', validatedParams.comment);
        }

        // Get FormData headers which include the boundary
        const formHeaders = formData.getHeaders();

        // Update the attachment (V1 API with multipart/form-data)
        const response = await apiClient.makeV1Request<any>({
          method: 'POST',
          path: `/content/${pageId}/child/attachment/${validatedParams.attachmentId}/data`,
          headers: {
            'X-Atlassian-Token': 'no-check',
            'Content-Type': formHeaders['content-type'],
          },
          data: formData,
        });

        if (response.success) {
          logger.info('Attachment updated', { attachmentId: validatedParams.attachmentId });

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                attachmentId: validatedParams.attachmentId,
                message: 'Attachment updated successfully',
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to update attachment');
      } catch (error: any) {
        logger.error('Failed to update attachment', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'UPDATE_ATTACHMENT_ERROR',
                message: error.message,
                suggestion: 'Verify the attachment ID is correct',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: delete_attachment
  server.registerTool(
    'delete_attachment',
    {
      title: 'Delete Attachment',
      description: '🗑️ DELETE: Delete an attachment. By default moves to trash; use purge=true to permanently delete.',
      inputSchema: deleteAttachmentInputSchema,
      annotations: {
        title: 'Delete Attachment',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = deleteAttachmentSchema.parse(params);

        // Normalize attachment ID - V1 API expects just the numeric ID
        let attachmentId = validatedParams.attachmentId;
        if (attachmentId.startsWith('att')) {
          attachmentId = attachmentId.substring(3);
        }

        const queryParams: Record<string, any> = {};
        if (validatedParams.purge) {
          queryParams.status = 'trashed'; // V1 API uses status=trashed for purge
        }

        // Use V1 API for deletion as V2 API has issues with DELETE
        const response = await apiClient.makeV1Request<void>({
          method: 'DELETE',
          path: `/content/${attachmentId}`,
          params: queryParams,
        });

        if (response.success) {
          logger.info('Attachment deleted', {
            attachmentId: validatedParams.attachmentId,
            purged: validatedParams.purge,
          });

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                deletedAttachmentId: validatedParams.attachmentId,
                purged: validatedParams.purge,
                message: validatedParams.purge
                  ? 'Attachment permanently deleted'
                  : 'Attachment moved to trash',
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to delete attachment');
      } catch (error: any) {
        logger.error('Failed to delete attachment', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'DELETE_ATTACHMENT_ERROR',
                message: error.message,
                suggestion: 'Verify the attachment ID is correct',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: download_attachment
  server.registerTool(
    'download_attachment',
    {
      title: 'Download Attachment',
      description: '📥 READ: Get the download URL for an attachment.',
      inputSchema: downloadAttachmentInputSchema,
      annotations: {
        title: 'Download Attachment',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = downloadAttachmentSchema.parse(params);

        const response = await apiClient.makeV2Request<ConfluenceAttachment>({
          method: 'GET',
          path: `/attachments/${validatedParams.attachmentId}`,
        });

        if (response.success && response.data) {
          const attachment = response.data;

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                attachment: {
                  id: attachment.id,
                  title: attachment.title,
                  mediaType: attachment.mediaType,
                  fileSize: attachment.fileSize,
                  downloadLink: attachment.downloadLink,
                  webuiLink: attachment.webuiLink,
                },
                note: 'Use the downloadLink URL with authentication to download the file',
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get attachment download info');
      } catch (error: any) {
        logger.error('Failed to get attachment download info', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'DOWNLOAD_ATTACHMENT_ERROR',
                message: error.message,
                suggestion: 'Verify the attachment ID is correct',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: get_attachment_versions
  server.registerTool(
    'get_attachment_versions',
    {
      title: 'Get Attachment Versions',
      description: '📖 READ: Get version history of an attachment.',
      inputSchema: getAttachmentVersionsInputSchema,
      annotations: {
        title: 'Get Attachment Versions',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = getAttachmentVersionsSchema.parse(params);

        const queryParams: Record<string, any> = {};
        if (validatedParams.limit) {
          queryParams.limit = validatedParams.limit;
        }
        if (validatedParams.cursor) {
          queryParams.cursor = validatedParams.cursor;
        }

        const response = await apiClient.makeV2Request<CursorPaginatedResponse<ContentVersion>>({
          method: 'GET',
          path: `/attachments/${validatedParams.attachmentId}/versions`,
          params: queryParams,
        });

        if (response.success && response.data) {
          const versions = response.data.results;
          const nextCursor = response.data._links?.next
            ? new URL(response.data._links.next, 'http://localhost').searchParams.get('cursor')
            : null;

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                attachmentId: validatedParams.attachmentId,
                versions: versions.map(v => ({
                  number: v.number,
                  message: v.message,
                  authorId: v.authorId,
                  createdAt: v.createdAt,
                })),
                pagination: {
                  returned: versions.length,
                  hasMore: !!nextCursor,
                  nextCursor,
                },
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get attachment versions');
      } catch (error: any) {
        logger.error('Failed to get attachment versions', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_ATTACHMENT_VERSIONS_ERROR',
                message: error.message,
                suggestion: 'Verify the attachment ID is correct',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: copy_attachment
  server.registerTool(
    'copy_attachment',
    {
      title: 'Copy Attachment',
      description: '📋 CREATE: Copy an attachment to another page.',
      inputSchema: copyAttachmentInputSchema,
      annotations: {
        title: 'Copy Attachment',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = copyAttachmentSchema.parse(params);

        // First get the attachment details
        const attachmentInfo = await apiClient.makeV2Request<ConfluenceAttachment>({
          method: 'GET',
          path: `/attachments/${validatedParams.attachmentId}`,
        });

        if (!attachmentInfo.success || !attachmentInfo.data) {
          throw new Error('Attachment not found');
        }

        const sourceAttachment = attachmentInfo.data;

        // Download the attachment content
        const downloadResponse = await apiClient.downloadAttachment(sourceAttachment.downloadLink);
        if (!downloadResponse.success || !downloadResponse.data) {
          throw new Error('Failed to download attachment content');
        }

        // Re-upload to destination page using multipart/form-data
        const FormData = (await import('form-data')).default;
        const formData = new FormData();

        formData.append('file', downloadResponse.data, {
          filename: sourceAttachment.title,
          contentType: sourceAttachment.mediaType || 'application/octet-stream',
          knownLength: downloadResponse.data.length,
        });

        formData.append('comment', `Copied from attachment ${validatedParams.attachmentId}`);

        const formHeaders = formData.getHeaders();

        const response = await apiClient.makeV1Request<any>({
          method: 'POST',
          path: `/content/${validatedParams.destinationPageId}/child/attachment`,
          headers: {
            'X-Atlassian-Token': 'no-check',
            'Content-Type': formHeaders['content-type'],
          },
          data: formData,
        });

        if (response.success && response.data) {
          const newAttachment = response.data.results?.[0] || response.data;
          logger.info('Attachment copied', {
            sourceId: validatedParams.attachmentId,
            destinationPageId: validatedParams.destinationPageId,
          });

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                originalAttachmentId: validatedParams.attachmentId,
                newAttachment: {
                  id: newAttachment.id,
                  title: newAttachment.title,
                  pageId: validatedParams.destinationPageId,
                },
                message: 'Attachment copied successfully',
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to copy attachment');
      } catch (error: any) {
        logger.error('Failed to copy attachment', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'COPY_ATTACHMENT_ERROR',
                message: error.message,
                suggestion: 'Verify both the attachment ID and destination page ID are correct',
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
