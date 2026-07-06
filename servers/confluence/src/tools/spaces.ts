import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ConfluenceApiClient } from '../api/client.js';
import {
  searchSpacesSchema,
  getSpaceSchema,
  createSpaceSchema,
  updateSpaceSchema,
  deleteSpaceSchema,
  archiveSpaceSchema,
  restoreSpaceSchema,
  getSpaceContentSchema,
  getSpaceSettingsSchema,
  updateSpaceSettingsSchema,
  getSpaceThemeSchema,
  setSpaceThemeSchema,
} from '../validation/schemas.js';
import {
  searchSpacesInputSchema,
  getSpaceInputSchema,
  createSpaceInputSchema,
  updateSpaceInputSchema,
  deleteSpaceInputSchema,
  archiveSpaceInputSchema,
  restoreSpaceInputSchema,
  getSpaceContentInputSchema,
  getSpaceSettingsInputSchema,
  updateSpaceSettingsInputSchema,
  getSpaceThemeInputSchema,
  setSpaceThemeInputSchema,
} from '../validation/input-schemas.js';
import {
  ConfluenceSpace,
  ConfluencePage,
  CursorPaginatedResponse,
} from '../types/index.js';
import { logger } from '../utils/logger.js';
import { sanitizeErrorMessage } from '../utils/errors.js';

export async function registerSpaceTools(server: McpServer, apiClient: ConfluenceApiClient) {
  // =====================
  // PHASE 1: Core Space CRUD Operations
  // =====================

  // Tool: search_spaces
  server.registerTool(
    'search_spaces',
    {
      title: 'Search Spaces',
      description: '🔍 DISCOVERY: Search for spaces in Confluence. Filter by type, status, or labels. This is the starting point for finding content - use this before searching for pages.',
      inputSchema: searchSpacesInputSchema,
      annotations: {
        title: 'Search Spaces',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = searchSpacesSchema.parse(params);

        const queryParams: Record<string, any> = {};
        if (validatedParams.keys && validatedParams.keys.length > 0) {
          queryParams.keys = validatedParams.keys.join(',');
        }
        if (validatedParams.type) {
          queryParams.type = validatedParams.type;
        }
        if (validatedParams.status) {
          queryParams.status = validatedParams.status;
        }
        if (validatedParams.labels && validatedParams.labels.length > 0) {
          queryParams.labels = validatedParams.labels.join(',');
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

        // Determine detail level based on fields
        if (validatedParams.fields === 'full') {
          queryParams['description-format'] = 'plain';
        }

        const response = await apiClient.makeV2Request<CursorPaginatedResponse<ConfluenceSpace>>({
          method: 'GET',
          path: '/spaces',
          params: queryParams,
        });

        if (response.success && response.data) {
          const spaces = response.data.results;
          const nextCursor = response.data._links?.next
            ? new URL(response.data._links.next, 'http://localhost').searchParams.get('cursor')
            : null;

          const spacesData = spaces.map(s => ({
            id: s.id,
            key: s.key,
            name: s.name,
            type: s.type,
            status: s.status,
            description: s.description?.plain?.value,
            homepageId: s.homepage?.id,
          }));

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                spaces: spacesData,
                pagination: {
                  returned: spaces.length,
                  hasMore: !!nextCursor,
                  nextCursor,
                },
                usage_guidance: spaces.length > 0
                  ? `Found ${spaces.length} space(s). Use "get_space" for details, or "search_pages" with spaceId to find pages.`
                  : 'No spaces found. Try adjusting your search filters.',
                suggested_next_steps: spaces.length > 0
                  ? [
                      `Use "search_pages" with spaceId="${spaces[0].id}" to find pages in "${spaces[0].name}"`,
                      `Use "get_space" with spaceId="${spaces[0].id}" for full space details`,
                    ]
                  : [
                      'Try searching without filters to see all spaces',
                    ],
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to search spaces');
      } catch (error: any) {
        logger.error('Failed to search spaces', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'SEARCH_SPACES_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: 'Check your search parameters and try again',
                related_tools: ['search_tools', 'search_cql'],
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: get_space
  server.registerTool(
    'get_space',
    {
      title: 'Get Space',
      description: '📖 READ: Retrieve detailed information about a specific space including its description and homepage.',
      inputSchema: getSpaceInputSchema,
      annotations: {
        title: 'Get Space',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = getSpaceSchema.parse(params);

        const queryParams: Record<string, any> = {};
        if (validatedParams.descriptionFormat) {
          queryParams['description-format'] = validatedParams.descriptionFormat;
        }

        const response = await apiClient.makeV2Request<ConfluenceSpace>({
          method: 'GET',
          path: `/spaces/${validatedParams.spaceId}`,
          params: queryParams,
        });

        if (response.success && response.data) {
          const space = response.data;

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                space: {
                  id: space.id,
                  key: space.key,
                  name: space.name,
                  type: space.type,
                  status: space.status,
                  description: space.description,
                  homepageId: space.homepage?.id,
                  icon: space.icon,
                  createdAt: space.createdAt,
                  authorId: space.authorId,
                  _links: space._links,
                },
                suggested_next_steps: [
                  `Use "search_pages" with spaceId="${space.id}" to find pages`,
                  `Use "get_space_content" to see all content in this space`,
                  `Use "get_space_permissions" to view access controls`,
                ],
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get space');
      } catch (error: any) {
        logger.error('Failed to get space', { error: error.message });

        let suggestion = 'Verify the space ID is correct';
        if (error.message?.includes('not found')) {
          suggestion = 'Space not found. Use "search_spaces" to find valid space IDs';
        } else if (error.message?.includes('permission')) {
          suggestion = 'You may not have permission to view this space';
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_SPACE_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion,
                related_tools: ['search_spaces'],
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: create_space
  server.registerTool(
    'create_space',
    {
      title: 'Create Space',
      description: '🆕 CREATE: Create a new space in Confluence. Requires a unique key (uppercase alphanumeric) and name.',
      inputSchema: createSpaceInputSchema,
      annotations: {
        title: 'Create Space',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = createSpaceSchema.parse(params);

        const spaceData: Record<string, any> = {
          key: validatedParams.key,
          name: validatedParams.name,
        };

        if (validatedParams.description) {
          spaceData.description = {
            plain: {
              value: validatedParams.description,
              representation: 'plain',
            },
          };
        }

        // V1 API for space creation
        const response = await apiClient.makeV1Request<ConfluenceSpace>({
          method: 'POST',
          path: '/space',
          data: spaceData,
        });

        if (response.success && response.data) {
          const space = response.data;
          logger.info('Space created successfully', { spaceKey: space.key });

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                space: {
                  id: space.id,
                  key: space.key,
                  name: space.name,
                  type: space.type,
                  _links: space._links,
                },
                message: `Space "${space.name}" created successfully with key "${space.key}"`,
                suggested_next_steps: [
                  `Use "create_page" with spaceId="${space.id}" to add content`,
                  `Use "add_space_permission" to grant access to users`,
                ],
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to create space');
      } catch (error: any) {
        logger.error('Failed to create space', { error: error.message });

        let suggestion = 'Check space key and name';
        if (error.message?.includes('key') && error.message?.includes('exists')) {
          suggestion = 'Space key already exists. Choose a different key';
        } else if (error.message?.includes('name') && error.message?.includes('exists')) {
          suggestion = 'Space name already exists. Choose a different name';
        } else if (error.message?.includes('invalid')) {
          suggestion = 'Space key must be uppercase alphanumeric and start with a letter';
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'CREATE_SPACE_ERROR',
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

  // REMOVED: update_space - Confluence Cloud REST API does not support updating space properties
  // See backlog.json for details. Use Confluence UI to update spaces.
  /*
  server.registerTool(
    'update_space',
    {
      title: 'Update Space',
      description: '⚠️ KNOWN LIMITATION: Confluence Cloud does not support updating space properties via REST API. Use Confluence UI instead.',
      inputSchema: updateSpaceInputSchema,
      annotations: {
        title: 'Update Space',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = updateSpaceSchema.parse(params);

        const updateData: Record<string, any> = {};

        if (validatedParams.name) {
          updateData.name = validatedParams.name;
        }
        if (validatedParams.description !== undefined) {
          updateData.description = {
            plain: {
              value: validatedParams.description,
              representation: 'plain',
            },
          };
        }
        if (validatedParams.homepageId) {
          updateData.homepage = { id: validatedParams.homepageId };
        }

        const response = await apiClient.makeV2Request<ConfluenceSpace>({
          method: 'PUT',
          path: `/spaces/${validatedParams.spaceId}`,
          data: updateData,
        });

        if (response.success && response.data) {
          const space = response.data;
          logger.info('Space updated successfully', { spaceId: space.id });

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                space: {
                  id: space.id,
                  key: space.key,
                  name: space.name,
                },
                updatedFields: Object.keys(updateData),
                message: `Space "${space.name}" updated successfully`,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to update space');
      } catch (error: any) {
        logger.error('Failed to update space', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'UPDATE_SPACE_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: 'Confluence Cloud does not support updating space properties via REST API. Use Confluence UI (Space Settings) to update space name, description, or homepage.',
                knownLimitation: true,
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );
  */

  // Tool: delete_space
  server.registerTool(
    'delete_space',
    {
      title: 'Delete Space',
      description: '🗑️ DELETE: Permanently delete a space and ALL its content. WARNING: This cannot be undone! All pages, blogs, and attachments will be deleted.',
      inputSchema: deleteSpaceInputSchema,
      annotations: {
        title: 'Delete Space',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = deleteSpaceSchema.parse(params);

        // Use V1 API for space deletion - more reliable than V2
        // V1 API accepts both space ID and space key
        const response = await apiClient.makeV1Request<void>({
          method: 'DELETE',
          path: `/space/${validatedParams.spaceId}`,
        });

        if (response.success) {
          logger.info('Space deleted successfully', { spaceId: validatedParams.spaceId });

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                deletedSpaceId: validatedParams.spaceId,
                message: 'Space and all content permanently deleted',
                warning: 'This action cannot be undone',
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to delete space');
      } catch (error: any) {
        logger.error('Failed to delete space', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'DELETE_SPACE_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: 'Verify the space exists and you have admin permissions. Space ID can be the numeric ID or the space key.',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // =====================
  // PHASE 2: Space Lifecycle Operations
  // =====================

  // REMOVED: archive_space - Archive endpoint doesn't exist in Confluence Cloud
  // See backlog.json for details. Use Confluence UI to archive spaces.
  /*
  server.registerTool(
    'archive_space',
    {
      title: 'Archive Space',
      description: '📦 UPDATE: Archive a space to hide it from normal views while preserving content. Archived spaces can be restored.',
      inputSchema: archiveSpaceInputSchema,
      annotations: {
        title: 'Archive Space',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = archiveSpaceSchema.parse(params);

        // V1 API for archiving
        const response = await apiClient.makeV1Request<any>({
          method: 'PUT',
          path: `/space/${validatedParams.spaceId}/archive`,
        });

        if (response.success) {
          logger.info('Space archived successfully', { spaceId: validatedParams.spaceId });

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                spaceId: validatedParams.spaceId,
                message: 'Space archived successfully',
                note: 'Use "restore_space" to unarchive',
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to archive space');
      } catch (error: any) {
        logger.error('Failed to archive space', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'ARCHIVE_SPACE_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: 'Verify the space exists and you have admin permissions',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );
  */

  // Tool: restore_space
  server.registerTool(
    'restore_space',
    {
      title: 'Restore Space',
      description: '📤 UPDATE: Restore an archived space to make it active again.',
      inputSchema: restoreSpaceInputSchema,
      annotations: {
        title: 'Restore Space',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = restoreSpaceSchema.parse(params);

        // V1 API for restoring
        const response = await apiClient.makeV1Request<any>({
          method: 'DELETE',
          path: `/space/${validatedParams.spaceId}/archive`,
        });

        if (response.success) {
          logger.info('Space restored successfully', { spaceId: validatedParams.spaceId });

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                spaceId: validatedParams.spaceId,
                message: 'Space restored from archive',
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to restore space');
      } catch (error: any) {
        logger.error('Failed to restore space', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'RESTORE_SPACE_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: 'Verify the space is archived and you have admin permissions',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // =====================
  // PHASE 3: Space Content Operations
  // =====================

  // Tool: get_space_content
  server.registerTool(
    'get_space_content',
    {
      title: 'Get Space Content',
      description: '📖 READ: Get all pages in a space. Use depth="root" for top-level pages only, or "all" for entire hierarchy.',
      inputSchema: getSpaceContentInputSchema,
      annotations: {
        title: 'Get Space Content',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = getSpaceContentSchema.parse(params);

        const queryParams: Record<string, any> = {};
        if (validatedParams.depth) {
          queryParams.depth = validatedParams.depth;
        }
        if (validatedParams.limit) {
          queryParams.limit = validatedParams.limit;
        }
        if (validatedParams.cursor) {
          queryParams.cursor = validatedParams.cursor;
        }

        const response = await apiClient.makeV2Request<CursorPaginatedResponse<ConfluencePage>>({
          method: 'GET',
          path: `/spaces/${validatedParams.spaceId}/pages`,
          params: queryParams,
        });

        if (response.success && response.data) {
          const pages = response.data.results;
          const nextCursor = response.data._links?.next
            ? new URL(response.data._links.next, 'http://localhost').searchParams.get('cursor')
            : null;

          const pagesData = pages.map(p => ({
            id: p.id,
            title: p.title,
            status: p.status,
            parentId: p.parentId,
            position: p.position,
          }));

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                spaceId: validatedParams.spaceId,
                pages: pagesData,
                pagination: {
                  returned: pages.length,
                  hasMore: !!nextCursor,
                  nextCursor,
                },
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get space content');
      } catch (error: any) {
        logger.error('Failed to get space content', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_SPACE_CONTENT_ERROR',
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
  // PHASE 4: Space Settings Operations
  // =====================

  // Tool: get_space_settings
  server.registerTool(
    'get_space_settings',
    {
      title: 'Get Space Settings',
      description: '📖 READ: Get settings for a space including routing and appearance options.',
      inputSchema: getSpaceSettingsInputSchema,
      annotations: {
        title: 'Get Space Settings',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = getSpaceSettingsSchema.parse(params);

        // V1 API for space settings
        const response = await apiClient.makeV1Request<any>({
          method: 'GET',
          path: `/space/${validatedParams.spaceKey}/settings`,
        });

        if (response.success && response.data) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                spaceKey: validatedParams.spaceKey,
                settings: response.data,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get space settings');
      } catch (error: any) {
        logger.error('Failed to get space settings', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_SPACE_SETTINGS_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: 'Verify the space key is correct and you have admin permissions',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: update_space_settings
  server.registerTool(
    'update_space_settings',
    {
      title: 'Update Space Settings',
      description: '✏️ UPDATE: Update space settings like routing options.',
      inputSchema: updateSpaceSettingsInputSchema,
      annotations: {
        title: 'Update Space Settings',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = updateSpaceSettingsSchema.parse(params);

        const settingsData: Record<string, any> = {};
        if (validatedParams.routeOverrideEnabled !== undefined) {
          settingsData.routeOverrideEnabled = validatedParams.routeOverrideEnabled;
        }

        // V1 API for space settings
        const response = await apiClient.makeV1Request<any>({
          method: 'PUT',
          path: `/space/${validatedParams.spaceKey}/settings`,
          data: settingsData,
        });

        if (response.success) {
          logger.info('Space settings updated', { spaceKey: validatedParams.spaceKey });

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                spaceKey: validatedParams.spaceKey,
                message: 'Space settings updated successfully',
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to update space settings');
      } catch (error: any) {
        logger.error('Failed to update space settings', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'UPDATE_SPACE_SETTINGS_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: 'Verify you have admin permissions for this space',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // REMOVED: get_space_theme - Returns NOT_FOUND when space has no custom theme
  // See backlog.json for details.
  /*
  server.registerTool(
    'get_space_theme',
    {
      title: 'Get Space Theme',
      description: '📖 READ: Get the current theme applied to a space.',
      inputSchema: getSpaceThemeInputSchema,
      annotations: {
        title: 'Get Space Theme',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = getSpaceThemeSchema.parse(params);

        // V1 API for space theme
        const response = await apiClient.makeV1Request<any>({
          method: 'GET',
          path: `/space/${validatedParams.spaceKey}/theme`,
        });

        if (response.success && response.data) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                spaceKey: validatedParams.spaceKey,
                theme: response.data,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get space theme');
      } catch (error: any) {
        logger.error('Failed to get space theme', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_SPACE_THEME_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: 'Verify the space key is correct',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );
  */

  // Tool: set_space_theme
  server.registerTool(
    'set_space_theme',
    {
      title: 'Set Space Theme',
      description: '⚠️ KNOWN LIMITATION: Confluence Cloud has limited theme support. Common theme keys include "default" and custom theme keys if installed. This feature works best in Confluence Data Center. Applies a theme to customize space appearance.',
      inputSchema: setSpaceThemeInputSchema,
      annotations: {
        title: 'Set Space Theme',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = setSpaceThemeSchema.parse(params);

        // V1 API for setting theme
        const response = await apiClient.makeV1Request<any>({
          method: 'PUT',
          path: `/space/${validatedParams.spaceKey}/theme`,
          data: { themeKey: validatedParams.themeKey },
        });

        if (response.success) {
          logger.info('Space theme set', {
            spaceKey: validatedParams.spaceKey,
            themeKey: validatedParams.themeKey,
          });

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                spaceKey: validatedParams.spaceKey,
                themeKey: validatedParams.themeKey,
                message: 'Space theme updated successfully',
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to set space theme');
      } catch (error: any) {
        logger.error('Failed to set space theme', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'SET_SPACE_THEME_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: 'Verify the theme key is valid and you have admin permissions',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Space tools registered successfully
}
