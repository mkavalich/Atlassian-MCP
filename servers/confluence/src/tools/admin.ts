import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ConfluenceApiClient } from '../api/client.js';
import {
  getBlogPostsSchema,
  getBlogPostSchema,
  createBlogPostSchema,
  updateBlogPostSchema,
  deleteBlogPostSchema,
  getPageAnalyticsSchema,
  getSpaceAnalyticsSchema,
  getTopViewedPagesSchema,
  getContentPropertiesSchema,
  createContentPropertySchema,
  updateContentPropertySchema,
  deleteContentPropertySchema,
  getContentWatchersSchema,
  addContentWatchSchema,
  removeContentWatchSchema,
  getSpaceWatchersSchema,
  getAuditRecordsSchema,
  exportAuditRecordsSchema,
  setContentStateSchema,
  getContentStatesSchema,
  getSystemInfoSchema,
} from '../validation/schemas.js';
import {
  getBlogPostsInputSchema,
  getBlogPostInputSchema,
  createBlogPostInputSchema,
  updateBlogPostInputSchema,
  deleteBlogPostInputSchema,
  getPageAnalyticsInputSchema,
  getSpaceAnalyticsInputSchema,
  getTopViewedPagesInputSchema,
  getContentPropertiesInputSchema,
  createContentPropertyInputSchema,
  updateContentPropertyInputSchema,
  deleteContentPropertyInputSchema,
  getContentWatchersInputSchema,
  addContentWatchInputSchema,
  removeContentWatchInputSchema,
  getSpaceWatchersInputSchema,
  getAuditRecordsInputSchema,
  exportAuditRecordsInputSchema,
  getSystemInfoInputSchema,
  getGlobalSettingsInputSchema,
  setContentStateInputSchema,
  getContentStatesInputSchema,
  getDataPoliciesInputSchema,
} from '../validation/input-schemas.js';
import {
  ConfluenceBlogPost,
  ContentAnalytics,
  ContentProperty,
  ContentWatcher,
  AuditRecord,
  SystemInfo,
  ContentState,
  CursorPaginatedResponse,
  PaginatedResponse,
} from '../types/index.js';
import { logger } from '../utils/logger.js';
import { sanitizeErrorMessage } from '../utils/errors.js';
import { sanitizePageBody, wrapUserContent } from '../utils/sanitize.js';

// NOTE: TOOL_CATALOG is now defined in index.ts for proper progressive disclosure

export async function registerAdminTools(server: McpServer, apiClient: ConfluenceApiClient) {
  // =====================
  // Blog Post Operations
  // =====================

  // Tool: get_blog_posts
  server.registerTool(
    'get_blog_posts',
    {
      title: 'Get Blog Posts',
      description: '🔍 DISCOVERY: Search for blog posts in Confluence. Filter by space or status.',
      inputSchema: getBlogPostsInputSchema,
      annotations: {
        title: 'Get Blog Posts',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = getBlogPostsSchema.parse(params);

        const queryParams: Record<string, any> = {};
        if (validatedParams.spaceId) {
          queryParams['space-id'] = validatedParams.spaceId;
        }
        if (validatedParams.status) {
          queryParams.status = validatedParams.status;
        }
        if (validatedParams.sort) {
          queryParams.sort = validatedParams.sort;
        }
        if (validatedParams.limit) {
          queryParams.limit = validatedParams.limit;
        }
        if (validatedParams.cursor) {
          queryParams.cursor = validatedParams.cursor;
        }

        const response = await apiClient.makeV2Request<CursorPaginatedResponse<ConfluenceBlogPost>>({
          method: 'GET',
          path: '/blogposts',
          params: queryParams,
        });

        if (response.success && response.data) {
          const blogs = response.data.results;
          const nextCursor = response.data._links?.next
            ? new URL(response.data._links.next, 'http://localhost').searchParams.get('cursor')
            : null;

          const blogsData = blogs.map(b => ({
            id: b.id,
            title: b.title,
            status: b.status,
            spaceId: b.spaceId,
            authorId: b.authorId,
            createdAt: b.createdAt,
            version: b.version?.number,
          }));

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                blogPosts: blogsData,
                pagination: {
                  returned: blogs.length,
                  hasMore: !!nextCursor,
                  nextCursor,
                },
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get blog posts');
      } catch (error: any) {
        logger.error('Failed to get blog posts', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_BLOG_POSTS_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: 'Check your search parameters',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: get_blog_post
  server.registerTool(
    'get_blog_post',
    {
      title: 'Get Blog Post',
      description: '📖 READ: Get details of a specific blog post.',
      inputSchema: getBlogPostInputSchema,
      annotations: {
        title: 'Get Blog Post',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = getBlogPostSchema.parse(params);

        const queryParams: Record<string, any> = {};
        if (validatedParams.bodyFormat) {
          queryParams['body-format'] = validatedParams.bodyFormat;
        }

        const response = await apiClient.makeV2Request<ConfluenceBlogPost>({
          method: 'GET',
          path: `/blogposts/${validatedParams.blogPostId}`,
          params: queryParams,
        });

        if (response.success && response.data) {
          const blog = response.data;

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                blogPost: {
                  id: blog.id,
                  title: wrapUserContent(blog.title),
                  status: blog.status,
                  spaceId: blog.spaceId,
                  authorId: blog.authorId,
                  createdAt: blog.createdAt,
                  version: blog.version,
                  body: sanitizePageBody(blog.body as Record<string, unknown> | undefined),
                  _links: blog._links,
                },
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get blog post');
      } catch (error: any) {
        logger.error('Failed to get blog post', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_BLOG_POST_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: 'Verify the blog post ID is correct',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: create_blog_post
  server.registerTool(
    'create_blog_post',
    {
      title: 'Create Blog Post',
      description: '📝 CREATE: Create a new blog post in a space.',
      inputSchema: createBlogPostInputSchema,
      annotations: {
        title: 'Create Blog Post',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = createBlogPostSchema.parse(params);

        const blogData = {
          spaceId: validatedParams.spaceId,
          title: validatedParams.title,
          status: validatedParams.status,
          body: {
            representation: validatedParams.representation,
            value: validatedParams.body,
          },
        };

        const response = await apiClient.makeV2Request<ConfluenceBlogPost>({
          method: 'POST',
          path: '/blogposts',
          data: blogData,
        });

        if (response.success && response.data) {
          const blog = response.data;
          logger.info('Blog post created', { blogId: blog.id });

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                blogPost: {
                  id: blog.id,
                  title: blog.title,
                  status: blog.status,
                  _links: blog._links,
                },
                message: `Blog post "${blog.title}" created successfully`,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to create blog post');
      } catch (error: any) {
        logger.error('Failed to create blog post', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'CREATE_BLOG_POST_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: 'Verify the space ID and content are correct',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: update_blog_post
  server.registerTool(
    'update_blog_post',
    {
      title: 'Update Blog Post',
      description: '✏️ UPDATE: Update an existing blog post. Requires current version number. If title is not provided, the current title will be preserved.',
      inputSchema: updateBlogPostInputSchema,
      annotations: {
        title: 'Update Blog Post',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = updateBlogPostSchema.parse(params);

        // The V2 API requires title in update payload
        // If no title provided, fetch current blog post to get the title
        let title = validatedParams.title;
        if (!title) {
          const currentBlog = await apiClient.makeV2Request<ConfluenceBlogPost>({
            method: 'GET',
            path: `/blogposts/${validatedParams.blogPostId}`,
          });
          if (!currentBlog.success || !currentBlog.data) {
            throw new Error('Blog post not found');
          }
          title = currentBlog.data.title;
        }

        const updateData: Record<string, any> = {
          id: validatedParams.blogPostId,
          title,
          status: validatedParams.status || 'current',
          version: {
            number: validatedParams.version + 1,
          },
        };

        if (validatedParams.body) {
          updateData.body = {
            representation: validatedParams.representation || 'storage',
            value: validatedParams.body,
          };
        }
        if (validatedParams.status) {
          updateData.status = validatedParams.status;
        }

        const response = await apiClient.makeV2Request<ConfluenceBlogPost>({
          method: 'PUT',
          path: `/blogposts/${validatedParams.blogPostId}`,
          data: updateData,
        });

        if (response.success && response.data) {
          const blog = response.data;
          logger.info('Blog post updated', { blogId: blog.id });

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                blogPost: {
                  id: blog.id,
                  title: blog.title,
                  version: blog.version?.number,
                },
                message: 'Blog post updated successfully',
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to update blog post');
      } catch (error: any) {
        logger.error('Failed to update blog post', { error: error.message });

        let suggestion = 'Verify the blog post ID and version number are correct';
        const errorMsg = error.message?.toLowerCase() || '';

        if (errorMsg.includes('version') || errorMsg.includes('conflict')) {
          suggestion = 'Version conflict. Get the current version using "get_blog_post" and use that version number';
        } else if (errorMsg.includes('not found') || errorMsg.includes('404')) {
          suggestion = 'Blog post not found. Verify the blogPostId is correct';
        } else if (errorMsg.includes('validation')) {
          suggestion = 'Validation error. Ensure you provide body content when updating';
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'UPDATE_BLOG_POST_ERROR',
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

  // Tool: delete_blog_post
  server.registerTool(
    'delete_blog_post',
    {
      title: 'Delete Blog Post',
      description: '🗑️ DELETE: Delete a blog post. Moves to trash by default.',
      inputSchema: deleteBlogPostInputSchema,
      annotations: {
        title: 'Delete Blog Post',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = deleteBlogPostSchema.parse(params);

        const queryParams: Record<string, any> = {};
        if (validatedParams.purge) {
          queryParams.purge = true;
        }

        const response = await apiClient.makeV2Request<void>({
          method: 'DELETE',
          path: `/blogposts/${validatedParams.blogPostId}`,
          params: queryParams,
        });

        if (response.success) {
          logger.info('Blog post deleted', { blogPostId: validatedParams.blogPostId });

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                deletedBlogPostId: validatedParams.blogPostId,
                purged: validatedParams.purge,
                message: validatedParams.purge ? 'Blog post permanently deleted' : 'Blog post moved to trash',
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to delete blog post');
      } catch (error: any) {
        logger.error('Failed to delete blog post', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'DELETE_BLOG_POST_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: 'Verify the blog post ID is correct',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // =====================
  // Content Properties
  // =====================

  // Tool: get_content_properties
  server.registerTool(
    'get_content_properties',
    {
      title: 'Get Content Properties',
      description: '📖 READ: Get custom properties stored on content.',
      inputSchema: getContentPropertiesInputSchema,
      annotations: {
        title: 'Get Content Properties',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = getContentPropertiesSchema.parse(params);

        const response = await apiClient.makeV1Request<PaginatedResponse<ContentProperty>>({
          method: 'GET',
          path: `/content/${validatedParams.contentId}/property`,
        });

        if (response.success && response.data) {
          const properties = response.data.results;

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                contentId: validatedParams.contentId,
                properties: properties.map(p => ({
                  id: p.id,
                  key: p.key,
                  value: p.value,
                  version: p.version?.number,
                })),
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get content properties');
      } catch (error: any) {
        logger.error('Failed to get content properties', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_CONTENT_PROPERTIES_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: 'Verify the content ID is correct',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: get_content_property - REMOVED: V1 API returns 400 for property lookup by key
  // The endpoint /content/{id}/property/{key} does not work reliably in Cloud.
  // Use get_content_properties to list all properties, then filter by key.

  // Tool: create_content_property
  server.registerTool(
    'create_content_property',
    {
      title: 'Create Content Property',
      description: '🆕 CREATE: Create a custom property on content.',
      inputSchema: createContentPropertyInputSchema,
      annotations: {
        title: 'Create Content Property',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = createContentPropertySchema.parse(params);

        const response = await apiClient.makeV1Request<ContentProperty>({
          method: 'POST',
          path: `/content/${validatedParams.contentId}/property`,
          data: {
            key: validatedParams.key,
            value: validatedParams.value,
          },
        });

        if (response.success && response.data) {
          logger.info('Content property created', {
            contentId: validatedParams.contentId,
            key: validatedParams.key,
          });

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                property: {
                  id: response.data.id,
                  key: response.data.key,
                },
                message: 'Property created successfully',
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to create content property');
      } catch (error: any) {
        logger.error('Failed to create content property', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'CREATE_CONTENT_PROPERTY_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: 'Verify the content ID is correct',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: update_content_property
  server.registerTool(
    'update_content_property',
    {
      title: 'Update Content Property',
      description: '✏️ UPDATE: Update a content property value.',
      inputSchema: updateContentPropertyInputSchema,
      annotations: {
        title: 'Update Content Property',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = updateContentPropertySchema.parse(params);

        const response = await apiClient.makeV1Request<ContentProperty>({
          method: 'PUT',
          path: `/content/${validatedParams.contentId}/property/${validatedParams.propertyKey}`,
          data: {
            key: validatedParams.propertyKey,
            value: validatedParams.value,
            version: {
              number: validatedParams.version + 1,
            },
          },
        });

        if (response.success) {
          logger.info('Content property updated', {
            contentId: validatedParams.contentId,
            key: validatedParams.propertyKey,
          });

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                contentId: validatedParams.contentId,
                propertyKey: validatedParams.propertyKey,
                message: 'Property updated successfully',
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to update content property');
      } catch (error: any) {
        logger.error('Failed to update content property', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'UPDATE_CONTENT_PROPERTY_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: 'Verify the version number is correct',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: delete_content_property
  server.registerTool(
    'delete_content_property',
    {
      title: 'Delete Content Property',
      description: '🗑️ DELETE: Delete a content property.',
      inputSchema: deleteContentPropertyInputSchema,
      annotations: {
        title: 'Delete Content Property',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = deleteContentPropertySchema.parse(params);

        const response = await apiClient.makeV1Request<void>({
          method: 'DELETE',
          path: `/content/${validatedParams.contentId}/property/${validatedParams.propertyKey}`,
        });

        if (response.success) {
          logger.info('Content property deleted', {
            contentId: validatedParams.contentId,
            key: validatedParams.propertyKey,
          });

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                contentId: validatedParams.contentId,
                deletedKey: validatedParams.propertyKey,
                message: 'Property deleted successfully',
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to delete content property');
      } catch (error: any) {
        logger.error('Failed to delete content property', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'DELETE_CONTENT_PROPERTY_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: 'Verify the content ID and property key are correct',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // =====================
  // Watchers
  // =====================

  // Tool: get_content_watchers
  server.registerTool(
    'get_content_watchers',
    {
      title: 'Get Content Watchers',
      description: '📖 READ: Get users watching a piece of content.',
      inputSchema: getContentWatchersInputSchema,
      annotations: {
        title: 'Get Content Watchers',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = getContentWatchersSchema.parse(params);

        const response = await apiClient.makeV1Request<PaginatedResponse<any>>({
          method: 'GET',
          path: `/content/${validatedParams.contentId}/notification/child-created`,
        });

        if (response.success && response.data) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                contentId: validatedParams.contentId,
                watchers: response.data.results || [],
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get content watchers');
      } catch (error: any) {
        logger.error('Failed to get content watchers', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_CONTENT_WATCHERS_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: 'Verify the content ID is correct',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: add_content_watch
  server.registerTool(
    'add_content_watch',
    {
      title: 'Watch Content',
      description: '👁️ CREATE: Start watching content to receive notifications.',
      inputSchema: addContentWatchInputSchema,
      annotations: {
        title: 'Watch Content',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = addContentWatchSchema.parse(params);

        const response = await apiClient.makeV1Request<void>({
          method: 'POST',
          path: `/user/watch/content/${validatedParams.contentId}`,
        });

        if (response.success) {
          logger.info('Content watch added', { contentId: validatedParams.contentId });

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                contentId: validatedParams.contentId,
                message: 'Now watching this content',
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to add content watch');
      } catch (error: any) {
        logger.error('Failed to add content watch', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'ADD_CONTENT_WATCH_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: 'Verify the content ID is correct',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: remove_content_watch
  server.registerTool(
    'remove_content_watch',
    {
      title: 'Unwatch Content',
      description: '👁️ DELETE: Stop watching content.',
      inputSchema: removeContentWatchInputSchema,
      annotations: {
        title: 'Unwatch Content',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = removeContentWatchSchema.parse(params);

        const response = await apiClient.makeV1Request<void>({
          method: 'DELETE',
          path: `/user/watch/content/${validatedParams.contentId}`,
        });

        if (response.success) {
          logger.info('Content watch removed', { contentId: validatedParams.contentId });

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                contentId: validatedParams.contentId,
                message: 'No longer watching this content',
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to remove content watch');
      } catch (error: any) {
        logger.error('Failed to remove content watch', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'REMOVE_CONTENT_WATCH_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: 'Verify the content ID is correct',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: get_space_watchers
  server.registerTool(
    'get_space_watchers',
    {
      title: 'Get Space Watchers',
      description: '📖 READ: Get users watching a space.',
      inputSchema: getSpaceWatchersInputSchema,
      annotations: {
        title: 'Get Space Watchers',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = getSpaceWatchersSchema.parse(params);

        // Try V2 API first
        try {
          const response = await apiClient.makeV2Request<CursorPaginatedResponse<any>>({
            method: 'GET',
            path: `/spaces/${validatedParams.spaceId}/watchers`,
          });

          if (response.success && response.data) {
            return {
              content: [{
                type: 'text' as const,
                text: JSON.stringify({
                  success: true,
                  spaceId: validatedParams.spaceId,
                  watchers: response.data.results || [],
                }, null, 2),
              }],
            };
          }
        } catch {
          // V2 API doesn't support space watchers list - this is a Confluence API limitation
          logger.debug('Space watchers endpoint not available');
        }

        // Return informative response about API limitation
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              spaceId: validatedParams.spaceId,
              watchers: [],
              note: 'The Confluence API does not provide a direct endpoint to list all space watchers. Use the watch management tools to check if specific users are watching.',
              suggestion: 'Use add_content_watch/remove_content_watch to manage individual watches',
            }, null, 2),
          }],
        };
      } catch (error: any) {
        logger.error('Failed to get space watchers', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_SPACE_WATCHERS_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: 'Verify the space ID is correct',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // =====================
  // Admin Tools
  // =====================
  // NOTE: search_tools is now registered in index.ts FIRST for proper progressive disclosure

  // Tool: get_audit_records
  server.registerTool(
    'get_audit_records',
    {
      title: 'Get Audit Records',
      description: '📖 READ: Get audit log records. Admin only.',
      inputSchema: getAuditRecordsInputSchema,
      annotations: {
        title: 'Get Audit Records',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = getAuditRecordsSchema.parse(params);

        const queryParams: Record<string, any> = {};
        if (validatedParams.startDate) {
          queryParams.startDate = validatedParams.startDate;
        }
        if (validatedParams.endDate) {
          queryParams.endDate = validatedParams.endDate;
        }
        if (validatedParams.searchString) {
          queryParams.searchString = validatedParams.searchString;
        }
        if (validatedParams.limit) {
          queryParams.limit = validatedParams.limit;
        }

        const response = await apiClient.makeV1Request<PaginatedResponse<AuditRecord>>({
          method: 'GET',
          path: '/audit',
          params: queryParams,
        });

        if (response.success && response.data) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                auditRecords: response.data.results,
                pagination: {
                  returned: response.data.results?.length || 0,
                },
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get audit records');
      } catch (error: any) {
        logger.error('Failed to get audit records', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_AUDIT_RECORDS_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: 'Verify you have admin permissions',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: get_system_info
  server.registerTool(
    'get_system_info',
    {
      title: 'Get System Info',
      description: '📖 READ: Get Confluence system information.',
      inputSchema: getSystemInfoInputSchema,
      annotations: {
        title: 'Get System Info',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        getSystemInfoSchema.parse(params);
        const response = await apiClient.makeV1Request<SystemInfo>({
          method: 'GET',
          path: '/settings/systemInfo',
        });

        if (response.success && response.data) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                systemInfo: response.data,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get system info');
      } catch (error: any) {
        logger.error('Failed to get system info', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_SYSTEM_INFO_ERROR',
                message: sanitizeErrorMessage(error.message),
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: get_content_states
  server.registerTool(
    'get_content_states',
    {
      title: 'Get Content States',
      description: '📖 READ: Get available content states (like Draft, Review, Published).',
      inputSchema: getContentStatesInputSchema,
      annotations: {
        title: 'Get Content States',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = getContentStatesSchema.parse(params);

        const queryParams: Record<string, any> = {};
        if (validatedParams.spaceKey) {
          queryParams.spaceKey = validatedParams.spaceKey;
        }

        const response = await apiClient.makeV1Request<ContentState[]>({
          method: 'GET',
          path: '/content-states',
          params: queryParams,
        });

        if (response.success && response.data) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                contentStates: response.data,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get content states');
      } catch (error: any) {
        logger.error('Failed to get content states', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_CONTENT_STATES_ERROR',
                message: sanitizeErrorMessage(error.message),
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: set_content_state
  server.registerTool(
    'set_content_state',
    {
      title: 'Set Content State',
      description: '⚠️ PREREQUISITE: Use "get_content_states" first to find valid state IDs. State IDs must be numeric (e.g., "1", "2"). Sets the content publishing state (e.g., Draft, Review, Published).',
      inputSchema: setContentStateInputSchema,
      annotations: {
        title: 'Set Content State',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = setContentStateSchema.parse(params);

        // Parse stateId to integer - API expects numeric ID
        const numericStateId = parseInt(validatedParams.stateId, 10);
        if (isNaN(numericStateId)) {
          throw new Error(`Invalid stateId: '${validatedParams.stateId}' must be a numeric ID`);
        }

        const response = await apiClient.makeV1Request<void>({
          method: 'PUT',
          path: `/content/${validatedParams.contentId}/state`,
          data: { id: numericStateId },
        });

        if (response.success) {
          logger.info('Content state set', {
            contentId: validatedParams.contentId,
            stateId: validatedParams.stateId,
          });

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                contentId: validatedParams.contentId,
                stateId: validatedParams.stateId,
                message: 'Content state updated successfully',
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to set content state');
      } catch (error: any) {
        logger.error('Failed to set content state', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'SET_CONTENT_STATE_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: 'Verify the content ID and state ID are correct',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Admin tools registered successfully
}
