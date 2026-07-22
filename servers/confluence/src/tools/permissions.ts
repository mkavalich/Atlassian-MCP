import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ConfluenceApiClient } from '../api/client.js';
import {
  getSpacePermissionsSchema,
  checkContentPermissionSchema,
  getPermissionTypesSchema,
} from '../validation/schemas.js';
import {
  getSpacePermissionsInputSchema,
  checkContentPermissionInputSchema,
  getPermissionTypesInputSchema,
} from '../validation/input-schemas.js';
import {
  SpacePermission,
  CursorPaginatedResponse,
} from '../types/index.js';
import { logger } from '../utils/logger.js';
import { sanitizeErrorMessage } from '../utils/errors.js';

export async function registerPermissionTools(server: McpServer, apiClient: ConfluenceApiClient) {
  // =====================
  // Space Permission Operations
  // =====================

  // Tool: get_space_permissions
  server.registerTool(
    'get_space_permissions',
    {
      title: 'Get Space Permissions',
      description: '🔍 DISCOVERY: Get all permissions configured for a space. Shows who can access the space and what they can do.',
      inputSchema: getSpacePermissionsInputSchema,
      annotations: {
        title: 'Get Space Permissions',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = getSpacePermissionsSchema.parse(params);

        const queryParams: Record<string, any> = {};
        if (validatedParams.limit) {
          queryParams.limit = validatedParams.limit;
        }
        if (validatedParams.cursor) {
          queryParams.cursor = validatedParams.cursor;
        }

        const response = await apiClient.makeV2Request<CursorPaginatedResponse<SpacePermission>>({
          method: 'GET',
          path: `/spaces/${validatedParams.spaceId}/permissions`,
          params: queryParams,
        });

        if (response.success && response.data) {
          const permissions = response.data.results;
          const nextCursor = response.data._links?.next
            ? new URL(response.data._links.next, 'http://localhost').searchParams.get('cursor')
            : null;

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                spaceId: validatedParams.spaceId,
                permissions: permissions.map(p => ({
                  id: p.id,
                  principal: p.principal,
                  operation: p.operation,
                })),
                pagination: {
                  returned: permissions.length,
                  hasMore: !!nextCursor,
                  nextCursor,
                },
                usage_guidance: 'This server exposes read-only permission tools. To grant or revoke space permissions, use the Confluence space settings UI.',
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get space permissions');
      } catch (error: any) {
        logger.error('Failed to get space permissions', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_SPACE_PERMISSIONS_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: 'Verify the space ID is correct and you have admin permissions',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // REMOVED: The following 5 permission tools require OAuth 2.0 with write:confluence-space scope
  // Tools removed: add_space_permission, remove_space_permission, get_space_permission_users, copy_space_permissions, bulk_update_permissions
  // See backlog.json for details. Use Confluence UI to manage permissions.

  // Tool: get_permission_types
  server.registerTool(
    'get_permission_types',
    {
      title: 'Get Permission Types',
      description: '🔍 DISCOVERY: Get all available permission types in Confluence. Use this to understand what operations can be granted.',
      inputSchema: getPermissionTypesInputSchema,
      annotations: {
        title: 'Get Permission Types',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        getPermissionTypesSchema.parse(params);
        // Return the standard Confluence permission types
        const permissionTypes = [
          { key: 'read', description: 'View content in the space' },
          { key: 'create', description: 'Create new content' },
          { key: 'delete', description: 'Delete content' },
          { key: 'export', description: 'Export space content' },
          { key: 'administer', description: 'Administer the space' },
          { key: 'archive', description: 'Archive pages' },
          { key: 'restrict_content', description: 'Apply content restrictions' },
        ];

        const targetTypes = [
          { key: 'space', description: 'Space-level permissions' },
          { key: 'page', description: 'Page permissions' },
          { key: 'blogpost', description: 'Blog post permissions' },
          { key: 'comment', description: 'Comment permissions' },
          { key: 'attachment', description: 'Attachment permissions' },
        ];

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              permissionTypes,
              targetTypes,
              usage_guidance: 'These are the operation keys Confluence uses. This server exposes read-only permission tools; manage space permissions via the Confluence space settings UI.',
            }, null, 2),
          }],
        };
      } catch (error: any) {
        logger.error('Failed to get permission types', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_PERMISSION_TYPES_ERROR',
                message: sanitizeErrorMessage(error.message),
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: check_content_permission
  server.registerTool(
    'check_content_permission',
    {
      title: 'Check Content Permission',
      description: '📖 READ: Check if a user has a specific permission on a piece of content.',
      inputSchema: checkContentPermissionInputSchema,
      annotations: {
        title: 'Check Content Permission',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = checkContentPermissionSchema.parse(params);

        // V1 API for permission check - Confluence API expects specific format
        const checkData: Record<string, any> = {
          subject: {
            type: 'user',
            identifier: validatedParams.accountId || 'current',
          },
          operation: validatedParams.operation,
        };

        try {
          const response = await apiClient.makeV1Request<any>({
            method: 'POST',
            path: `/content/${validatedParams.contentId}/permission/check`,
            data: checkData,
          });

          if (response.success && response.data) {
            return {
              content: [{
                type: 'text' as const,
                text: JSON.stringify({
                  success: true,
                  contentId: validatedParams.contentId,
                  operation: validatedParams.operation,
                  hasPermission: response.data.hasPermission,
                  accountId: validatedParams.accountId || 'current user',
                }, null, 2),
              }],
            };
          }
        } catch (apiError: any) {
          // If API returns 500, the endpoint may have issues - provide alternative guidance
          if (apiError.message?.includes('500') || apiError.message?.includes('Internal')) {
            logger.warn('Content permission check API returned server error', {
              contentId: validatedParams.contentId,
            });
            return {
              content: [{
                type: 'text' as const,
                text: JSON.stringify({
                  success: true,
                  contentId: validatedParams.contentId,
                  operation: validatedParams.operation,
                  hasPermission: null,
                  note: 'Permission check API returned an error. Check content restrictions using get_page_restrictions instead.',
                  suggestion: 'Use get_page_restrictions to view who has access to this content',
                }, null, 2),
              }],
            };
          }
          throw apiError;
        }

        throw new Error('Failed to check content permission');
      } catch (error: any) {
        logger.error('Failed to check content permission', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'CHECK_PERMISSION_ERROR',
                message: sanitizeErrorMessage(error.message),
                suggestion: 'Verify the content ID is correct. Use get_page_restrictions as an alternative.',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // REMOVED: bulk_update_permissions - Depends on add_space_permission which requires OAuth 2.0
  // See backlog.json for details.

  // Permission tools registered successfully
}
