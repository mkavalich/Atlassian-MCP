import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ConfluenceApiClient } from '../api/client.js';
import {
  getPageCommentsSchema,
  getFooterCommentsSchema,
  getInlineCommentsSchema,
  addFooterCommentSchema,
  addInlineCommentSchema,
  updateCommentSchema,
  deleteCommentSchema,
  getCommentChildrenSchema,
} from '../validation/schemas.js';
import {
  getPageCommentsInputSchema,
  getFooterCommentsInputSchema,
  getInlineCommentsInputSchema,
  addFooterCommentInputSchema,
  addInlineCommentInputSchema,
  updateCommentInputSchema,
  deleteCommentInputSchema,
  getCommentChildrenInputSchema,
} from '../validation/input-schemas.js';
import {
  ConfluenceComment,
  CursorPaginatedResponse,
} from '../types/index.js';
import { logger } from '../utils/logger.js';
import { sanitizeErrorMessage } from '../utils/errors.js';
import { sanitizePageBody } from '../utils/sanitize.js';

export async function registerCommentTools(server: McpServer, apiClient: ConfluenceApiClient) {
  // =====================
  // Comment Read Operations
  // =====================

  // Tool: get_page_comments
  server.registerTool(
    'get_page_comments',
    {
      title: 'Get Page Comments',
      description: '📖 READ: Get all comments on a page (both footer and inline comments).',
      inputSchema: getPageCommentsInputSchema,
      annotations: {
        title: 'Get Page Comments',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = getPageCommentsSchema.parse(params);

        const queryParams: Record<string, any> = {};
        if (validatedParams.bodyFormat) {
          queryParams['body-format'] = validatedParams.bodyFormat;
        }
        if (validatedParams.limit) {
          queryParams.limit = validatedParams.limit;
        }
        if (validatedParams.cursor) {
          queryParams.cursor = validatedParams.cursor;
        }

        // Get footer comments
        const footerResponse = await apiClient.makeV2Request<CursorPaginatedResponse<ConfluenceComment>>({
          method: 'GET',
          path: `/pages/${validatedParams.pageId}/footer-comments`,
          params: queryParams,
        });

        // Get inline comments
        const inlineResponse = await apiClient.makeV2Request<CursorPaginatedResponse<ConfluenceComment>>({
          method: 'GET',
          path: `/pages/${validatedParams.pageId}/inline-comments`,
          params: queryParams,
        });

        if (footerResponse.success && inlineResponse.success) {
          const footerComments = footerResponse.data?.results || [];
          const inlineComments = inlineResponse.data?.results || [];

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                pageId: validatedParams.pageId,
                footerComments: footerComments.map(c => ({
                  id: c.id,
                  status: c.status,
                  authorId: c.authorId,
                  createdAt: c.createdAt,
                  body: sanitizePageBody(c.body as Record<string, unknown> | undefined),
                  version: c.version?.number,
                })),
                inlineComments: inlineComments.map(c => ({
                  id: c.id,
                  status: c.status,
                  authorId: c.authorId,
                  createdAt: c.createdAt,
                  body: sanitizePageBody(c.body as Record<string, unknown> | undefined),
                  version: c.version?.number,
                  inlineProperties: c.inlineProperties,
                })),
                totalCount: footerComments.length + inlineComments.length,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get page comments');
      } catch (error: any) {
        logger.error('Failed to get page comments', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_PAGE_COMMENTS_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: 'Verify the page ID is correct',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: get_footer_comments
  server.registerTool(
    'get_footer_comments',
    {
      title: 'Get Footer Comments',
      description: '📖 READ: Get only footer comments on a page (comments at the bottom of the page).',
      inputSchema: getFooterCommentsInputSchema,
      annotations: {
        title: 'Get Footer Comments',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = getFooterCommentsSchema.parse(params);

        const queryParams: Record<string, any> = {};
        if (validatedParams.bodyFormat) {
          queryParams['body-format'] = validatedParams.bodyFormat;
        }
        if (validatedParams.limit) {
          queryParams.limit = validatedParams.limit;
        }
        if (validatedParams.cursor) {
          queryParams.cursor = validatedParams.cursor;
        }

        const response = await apiClient.makeV2Request<CursorPaginatedResponse<ConfluenceComment>>({
          method: 'GET',
          path: `/pages/${validatedParams.pageId}/footer-comments`,
          params: queryParams,
        });

        if (response.success && response.data) {
          const comments = response.data.results;
          const nextCursor = response.data._links?.next
            ? new URL(response.data._links.next, 'http://localhost').searchParams.get('cursor')
            : null;

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                pageId: validatedParams.pageId,
                comments: comments.map(c => ({
                  id: c.id,
                  status: c.status,
                  authorId: c.authorId,
                  createdAt: c.createdAt,
                  body: sanitizePageBody(c.body as Record<string, unknown> | undefined),
                  version: c.version?.number,
                })),
                pagination: {
                  returned: comments.length,
                  hasMore: !!nextCursor,
                  nextCursor,
                },
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get footer comments');
      } catch (error: any) {
        logger.error('Failed to get footer comments', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_FOOTER_COMMENTS_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: 'Verify the page ID is correct',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: get_inline_comments
  server.registerTool(
    'get_inline_comments',
    {
      title: 'Get Inline Comments',
      description: '📖 READ: Get only inline comments on a page (comments attached to specific text).',
      inputSchema: getInlineCommentsInputSchema,
      annotations: {
        title: 'Get Inline Comments',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = getInlineCommentsSchema.parse(params);

        const queryParams: Record<string, any> = {};
        if (validatedParams.bodyFormat) {
          queryParams['body-format'] = validatedParams.bodyFormat;
        }
        if (validatedParams.limit) {
          queryParams.limit = validatedParams.limit;
        }
        if (validatedParams.cursor) {
          queryParams.cursor = validatedParams.cursor;
        }

        const response = await apiClient.makeV2Request<CursorPaginatedResponse<ConfluenceComment>>({
          method: 'GET',
          path: `/pages/${validatedParams.pageId}/inline-comments`,
          params: queryParams,
        });

        if (response.success && response.data) {
          const comments = response.data.results;
          const nextCursor = response.data._links?.next
            ? new URL(response.data._links.next, 'http://localhost').searchParams.get('cursor')
            : null;

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                pageId: validatedParams.pageId,
                comments: comments.map(c => ({
                  id: c.id,
                  status: c.status,
                  authorId: c.authorId,
                  createdAt: c.createdAt,
                  body: sanitizePageBody(c.body as Record<string, unknown> | undefined),
                  version: c.version?.number,
                  inlineProperties: c.inlineProperties,
                })),
                pagination: {
                  returned: comments.length,
                  hasMore: !!nextCursor,
                  nextCursor,
                },
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get inline comments');
      } catch (error: any) {
        logger.error('Failed to get inline comments', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_INLINE_COMMENTS_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: 'Verify the page ID is correct',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // =====================
  // Comment Create Operations
  // =====================

  // Tool: add_footer_comment
  server.registerTool(
    'add_footer_comment',
    {
      title: 'Add Footer Comment',
      description: '💬 CREATE: Add a footer comment to a page. These appear at the bottom of the page.',
      inputSchema: addFooterCommentInputSchema,
      annotations: {
        title: 'Add Footer Comment',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = addFooterCommentSchema.parse(params);

        const commentData = {
          pageId: validatedParams.pageId,
          body: {
            representation: validatedParams.representation,
            value: validatedParams.body,
          },
        };

        const response = await apiClient.makeV2Request<ConfluenceComment>({
          method: 'POST',
          path: '/footer-comments',
          data: commentData,
        });

        if (response.success && response.data) {
          logger.info('Footer comment added', {
            pageId: validatedParams.pageId,
            commentId: response.data.id,
          });

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                comment: {
                  id: response.data.id,
                  pageId: validatedParams.pageId,
                  createdAt: response.data.createdAt,
                },
                message: 'Comment added successfully',
                suggested_next_steps: [
                  `Use "update_comment" with commentId="${response.data.id}" to edit`,
                  `Use "get_footer_comments" to see all comments`,
                ],
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to add footer comment');
      } catch (error: any) {
        logger.error('Failed to add footer comment', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'ADD_FOOTER_COMMENT_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: 'Verify the page ID is correct and you have comment permissions',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // REMOVED: add_inline_comment - V2 API has strict text selection validation that often fails
  // See backlog.json for details. Use Confluence UI to add inline comments.
  /*
  server.registerTool(
    'add_inline_comment',
    {
      title: 'Add Inline Comment',
      description: '💬 CREATE: Add an inline comment attached to specific text on a page. IMPORTANT: The textSelection must be an EXACT match of text found in the page content. If the text appears multiple times, you MUST provide textSelectionMatchCount (total occurrences) and textSelectionMatchIndex (which occurrence to use, 0-based).',
      inputSchema: addInlineCommentInputSchema,
      annotations: {
        title: 'Add Inline Comment',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = addInlineCommentSchema.parse(params);

        // Build the inline comment properties
        // The API requires exact text match and proper match count/index for duplicate text
        const inlineCommentProperties: Record<string, any> = {
          textSelection: validatedParams.textSelection,
        };

        // If text appears multiple times, API requires both matchCount AND matchIndex
        // Default to assuming text appears once (index 0) if not specified
        if (validatedParams.textSelectionMatchCount !== undefined && validatedParams.textSelectionMatchCount > 1) {
          inlineCommentProperties.textSelectionMatchCount = validatedParams.textSelectionMatchCount;
          inlineCommentProperties.textSelectionMatchIndex = validatedParams.textSelectionMatchIndex ?? 0;
        } else if (validatedParams.textSelectionMatchIndex !== undefined) {
          // If only index is provided, set count to index + 1 at minimum
          inlineCommentProperties.textSelectionMatchCount = validatedParams.textSelectionMatchCount ?? (validatedParams.textSelectionMatchIndex + 1);
          inlineCommentProperties.textSelectionMatchIndex = validatedParams.textSelectionMatchIndex;
        }

        const commentData = {
          pageId: validatedParams.pageId,
          body: {
            representation: validatedParams.representation || 'storage',
            value: validatedParams.body,
          },
          inlineCommentProperties,
        };

        const response = await apiClient.makeV2Request<ConfluenceComment>({
          method: 'POST',
          path: '/inline-comments',
          data: commentData,
        });

        if (response.success && response.data) {
          logger.info('Inline comment added', {
            pageId: validatedParams.pageId,
            commentId: response.data.id,
          });

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                comment: {
                  id: response.data.id,
                  pageId: validatedParams.pageId,
                  textSelection: validatedParams.textSelection,
                  createdAt: response.data.createdAt,
                },
                message: 'Inline comment added successfully',
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to add inline comment');
      } catch (error: any) {
        logger.error('Failed to add inline comment', { error: error.message });

        let suggestion = 'Verify the page ID is correct and you have comment permissions';
        const errorMsg = error.message?.toLowerCase() || '';

        if (errorMsg.includes('text') || errorMsg.includes('selection') || errorMsg.includes('validation')) {
          suggestion = 'Text selection validation failed. Ensure: (1) The text exists EXACTLY as specified in the page, (2) If the text appears multiple times, provide textSelectionMatchCount and textSelectionMatchIndex, (3) Use "get_page" with bodyFormat="storage" to see the exact content';
        } else if (errorMsg.includes('not found')) {
          suggestion = 'Page not found. Verify the pageId is correct';
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'ADD_INLINE_COMMENT_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion,
                tip: 'For reliable inline comments, first use get_page to retrieve the exact text content, then select a unique text snippet',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );
  */

  // =====================
  // Comment Update/Delete Operations
  // =====================

  // Tool: update_comment
  server.registerTool(
    'update_comment',
    {
      title: 'Update Comment',
      description: '✏️ UPDATE: Edit an existing comment. Requires the current version number.',
      inputSchema: updateCommentInputSchema,
      annotations: {
        title: 'Update Comment',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = updateCommentSchema.parse(params);

        const updateData = {
          version: {
            number: validatedParams.version + 1,
          },
          body: {
            representation: validatedParams.representation,
            value: validatedParams.body,
          },
        };

        // Try footer comment first, then inline
        let response;
        try {
          response = await apiClient.makeV2Request<ConfluenceComment>({
            method: 'PUT',
            path: `/footer-comments/${validatedParams.commentId}`,
            data: updateData,
          });
        } catch {
          // Try inline comment
          response = await apiClient.makeV2Request<ConfluenceComment>({
            method: 'PUT',
            path: `/inline-comments/${validatedParams.commentId}`,
            data: updateData,
          });
        }

        if (response.success && response.data) {
          logger.info('Comment updated', { commentId: validatedParams.commentId });

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                comment: {
                  id: response.data.id,
                  version: response.data.version?.number,
                },
                message: 'Comment updated successfully',
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to update comment');
      } catch (error: any) {
        logger.error('Failed to update comment', { error: error.message });

        let suggestion = 'Verify the comment ID and version number are correct';
        if (error.message?.includes('version')) {
          suggestion = 'Version conflict. Get the latest version and retry';
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'UPDATE_COMMENT_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion,
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: delete_comment
  server.registerTool(
    'delete_comment',
    {
      title: 'Delete Comment',
      description: '🗑️ DELETE: Permanently delete a comment. This cannot be undone.',
      inputSchema: deleteCommentInputSchema,
      annotations: {
        title: 'Delete Comment',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = deleteCommentSchema.parse(params);

        // Try footer comment first, then inline
        let response;
        try {
          response = await apiClient.makeV2Request<void>({
            method: 'DELETE',
            path: `/footer-comments/${validatedParams.commentId}`,
          });
        } catch {
          // Try inline comment
          response = await apiClient.makeV2Request<void>({
            method: 'DELETE',
            path: `/inline-comments/${validatedParams.commentId}`,
          });
        }

        if (response.success) {
          logger.info('Comment deleted', { commentId: validatedParams.commentId });

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
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

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'DELETE_COMMENT_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: 'Verify the comment ID is correct and you have delete permissions',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: get_comment_children
  server.registerTool(
    'get_comment_children',
    {
      title: 'Get Comment Replies',
      description: '📖 READ: Get replies to a comment (nested comments).',
      inputSchema: getCommentChildrenInputSchema,
      annotations: {
        title: 'Get Comment Replies',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = getCommentChildrenSchema.parse(params);

        const queryParams: Record<string, any> = {};
        if (validatedParams.bodyFormat) {
          queryParams['body-format'] = validatedParams.bodyFormat;
        }
        if (validatedParams.limit) {
          queryParams.limit = validatedParams.limit;
        }
        if (validatedParams.cursor) {
          queryParams.cursor = validatedParams.cursor;
        }

        // Try footer comment children first, then inline
        let response: any = null;
        let endpointFound = false;

        try {
          response = await apiClient.makeV2Request<CursorPaginatedResponse<ConfluenceComment>>({
            method: 'GET',
            path: `/footer-comments/${validatedParams.commentId}/children`,
            params: queryParams,
          });
          endpointFound = true;
        } catch (footerError: any) {
          // Try inline comment children
          try {
            response = await apiClient.makeV2Request<CursorPaginatedResponse<ConfluenceComment>>({
              method: 'GET',
              path: `/inline-comments/${validatedParams.commentId}/children`,
              params: queryParams,
            });
            endpointFound = true;
          } catch (inlineError: any) {
            // Neither endpoint worked - return graceful response
            logger.debug('Comment children endpoints not available', {
              commentId: validatedParams.commentId,
            });
            return {
              content: [{
                type: 'text' as const,
                text: JSON.stringify({
                  success: true,
                  parentCommentId: validatedParams.commentId,
                  children: [],
                  note: 'Could not retrieve comment replies. The comment may not have replies, or the comment ID format may be incorrect.',
                  suggestion: 'Verify the comment ID is correct and the comment exists',
                }, null, 2),
              }],
            };
          }
        }

        if (endpointFound && response?.success && response?.data) {
          const children = response.data.results;
          const nextCursor = response.data._links?.next
            ? new URL(response.data._links.next, 'http://localhost').searchParams.get('cursor')
            : null;

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                parentCommentId: validatedParams.commentId,
                children: children.map(c => ({
                  id: c.id,
                  status: c.status,
                  authorId: c.authorId,
                  createdAt: c.createdAt,
                  body: sanitizePageBody(c.body as Record<string, unknown> | undefined),
                })),
                pagination: {
                  returned: children.length,
                  hasMore: !!nextCursor,
                  nextCursor,
                },
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get comment children');
      } catch (error: any) {
        logger.error('Failed to get comment children', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_COMMENT_CHILDREN_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: 'Verify the comment ID is correct',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Comment tools registered successfully
}
