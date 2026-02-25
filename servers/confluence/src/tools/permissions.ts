import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ConfluenceApiClient } from '../api/client.js';
import {
  getSpacePermissionsSchema,
  addSpacePermissionSchema,
  removeSpacePermissionSchema,
  getSpacePermissionUsersSchema,
  copySpacePermissionsSchema,
  checkContentPermissionSchema,
  bulkUpdatePermissionsSchema,
} from '../validation/schemas.js';
import {
  getSpacePermissionsInputSchema,
  addSpacePermissionInputSchema,
  removeSpacePermissionInputSchema,
  getSpacePermissionUsersInputSchema,
  copySpacePermissionsInputSchema,
  checkContentPermissionInputSchema,
  bulkUpdatePermissionsInputSchema,
  getPermissionTypesInputSchema,
} from '../validation/input-schemas.js';
import {
  SpacePermission,
  CursorPaginatedResponse,
} from '../types/index.js';
import { logger } from '../utils/logger.js';

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
                usage_guidance: 'Use "add_space_permission" to grant new permissions, or "remove_space_permission" to revoke access.',
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
                message: error.message,
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
  /*
  server.registerTool(
    'add_space_permission',
    {
      title: 'Add Space Permission',
      description: '⚠️ KNOWN LIMITATION: Confluence Cloud space permission API is not accessible via basic auth. Requires OAuth 2.0 with write:confluence-space scope. Use Confluence UI instead.',
      inputSchema: addSpacePermissionInputSchema,
      annotations: {
        title: 'Add Space Permission',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = addSpacePermissionSchema.parse(params);

        const permissionData = {
          subject: {
            type: validatedParams.principalType,
            identifier: validatedParams.principalId,
          },
          operation: {
            key: validatedParams.operation,
            target: validatedParams.targetType || 'space',
          },
        };

        const response = await apiClient.makeV2Request<SpacePermission>({
          method: 'POST',
          path: `/spaces/${validatedParams.spaceId}/permissions`,
          data: permissionData,
        });

        if (response.success && response.data) {
          logger.info('Space permission added', {
            spaceId: validatedParams.spaceId,
            principalId: validatedParams.principalId,
            operation: validatedParams.operation,
          });

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                permission: {
                  id: response.data.id,
                  principal: response.data.principal,
                  operation: response.data.operation,
                },
                message: 'Permission added successfully',
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to add space permission');
      } catch (error: any) {
        logger.error('Failed to add space permission', { error: error.message });

        let suggestion = 'Verify the space ID and principal ID are correct';
        if (error.message?.includes('already exists')) {
          suggestion = 'This permission already exists for this user/group';
        } else if (error.message?.includes('not found')) {
          suggestion = 'User or group not found. Verify the principal ID';
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'ADD_SPACE_PERMISSION_ERROR',
                message: error.message,
                suggestion,
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: remove_space_permission
  server.registerTool(
    'remove_space_permission',
    {
      title: 'Remove Space Permission',
      description: '⚠️ KNOWN LIMITATION: Confluence Cloud space permission DELETE API may not be accessible via basic auth. Requires OAuth 2.0 with write:confluence-space scope. Use "get_space_permissions" first to find the permission ID.',
      inputSchema: removeSpacePermissionInputSchema,
      annotations: {
        title: 'Remove Space Permission',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = removeSpacePermissionSchema.parse(params);

        const response = await apiClient.makeV2Request<void>({
          method: 'DELETE',
          path: `/spaces/${validatedParams.spaceId}/permissions/${validatedParams.permissionId}`,
        });

        if (response.success) {
          logger.info('Space permission removed', {
            spaceId: validatedParams.spaceId,
            permissionId: validatedParams.permissionId,
          });

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                spaceId: validatedParams.spaceId,
                removedPermissionId: validatedParams.permissionId,
                message: 'Permission removed successfully',
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to remove space permission');
      } catch (error: any) {
        logger.error('Failed to remove space permission', { error: error.message });

        let suggestion = 'Verify the permission ID is correct';
        const errorMsg = error.message?.toLowerCase() || '';

        if (errorMsg.includes('not found') || errorMsg.includes('404')) {
          suggestion = 'Permission not found. Either the ID is invalid, or this API requires OAuth 2.0 with write:confluence-space scope. Use Confluence UI to remove permissions instead.';
        } else if (errorMsg.includes('unauthorized') || errorMsg.includes('403') || errorMsg.includes('forbidden')) {
          suggestion = 'Confluence Cloud space permission API requires OAuth 2.0 with write:confluence-space scope. Basic auth is not supported. Use Confluence UI instead.';
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'REMOVE_SPACE_PERMISSION_ERROR',
                message: error.message,
                suggestion,
                knownLimitation: 'Space permission write operations may require OAuth 2.0 authentication',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: get_space_permission_users
  server.registerTool(
    'get_space_permission_users',
    {
      title: 'Get Users with Permission',
      description: '📖 READ: Get all users who have a specific permission on a space.',
      inputSchema: getSpacePermissionUsersInputSchema,
      annotations: {
        title: 'Get Users with Permission',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = getSpacePermissionUsersSchema.parse(params);

        const queryParams: Record<string, any> = {};
        if (validatedParams.limit) {
          queryParams.limit = validatedParams.limit;
        }
        if (validatedParams.cursor) {
          queryParams.start = validatedParams.cursor;
        }

        // V1 API for getting users with permission
        const response = await apiClient.makeV1Request<any>({
          method: 'GET',
          path: `/space/${validatedParams.spaceKey}/permission/${validatedParams.permissionKey}`,
          params: queryParams,
        });

        if (response.success && response.data) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                spaceKey: validatedParams.spaceKey,
                permissionKey: validatedParams.permissionKey,
                users: response.data.results || response.data,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to get users with permission');
      } catch (error: any) {
        logger.error('Failed to get users with permission', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_PERMISSION_USERS_ERROR',
                message: error.message,
                suggestion: 'Verify the space key and permission key are correct',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: copy_space_permissions
  server.registerTool(
    'copy_space_permissions',
    {
      title: 'Copy Space Permissions',
      description: '📋 CREATE: Copy all permissions from one space to another. Useful for setting up similar access controls.',
      inputSchema: copySpacePermissionsInputSchema,
      annotations: {
        title: 'Copy Space Permissions',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = copySpacePermissionsSchema.parse(params);

        // First, get all permissions from source space
        const sourcePermissions = await apiClient.makeV2Request<CursorPaginatedResponse<SpacePermission>>({
          method: 'GET',
          path: `/spaces/${validatedParams.sourceSpaceId}/permissions`,
          params: { limit: 250 },
        });

        if (!sourcePermissions.success || !sourcePermissions.data) {
          throw new Error('Failed to get source space permissions');
        }

        const permissions = sourcePermissions.data.results;
        let copiedCount = 0;
        const errors: string[] = [];

        // Copy each permission to target space
        for (const perm of permissions) {
          try {
            await apiClient.makeV2Request<SpacePermission>({
              method: 'POST',
              path: `/spaces/${validatedParams.targetSpaceId}/permissions`,
              data: {
                subject: {
                  type: perm.principal.type,
                  identifier: perm.principal.id,
                },
                operation: perm.operation,
              },
            });
            copiedCount++;
          } catch (err: any) {
            errors.push(`Failed to copy permission ${perm.id}: ${err.message}`);
          }
        }

        logger.info('Space permissions copied', {
          sourceSpaceId: validatedParams.sourceSpaceId,
          targetSpaceId: validatedParams.targetSpaceId,
          copiedCount,
        });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              sourceSpaceId: validatedParams.sourceSpaceId,
              targetSpaceId: validatedParams.targetSpaceId,
              totalPermissions: permissions.length,
              copiedCount,
              errors: errors.length > 0 ? errors : undefined,
              message: `Copied ${copiedCount} of ${permissions.length} permissions`,
            }, null, 2),
          }],
        };
      } catch (error: any) {
        logger.error('Failed to copy space permissions', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'COPY_PERMISSIONS_ERROR',
                message: error.message,
                suggestion: 'Verify both space IDs are correct and you have admin permissions',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );
  */

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
    async (params: any) => {
      try {
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
              usage_guidance: 'Use these operation keys when adding permissions with "add_space_permission"',
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
                message: error.message,
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
                message: error.message,
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
  /*
  server.registerTool(
    'bulk_update_permissions',
    {
      title: 'Bulk Update Permissions',
      description: '🔄 UPDATE: Add multiple permissions to a space at once. More efficient than adding them one by one.',
      inputSchema: bulkUpdatePermissionsInputSchema,
      annotations: {
        title: 'Bulk Update Permissions',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params: any) => {
      try {
        const validatedParams = bulkUpdatePermissionsSchema.parse(params);

        let addedCount = 0;
        const errors: string[] = [];

        for (const perm of validatedParams.permissions) {
          try {
            await apiClient.makeV2Request<SpacePermission>({
              method: 'POST',
              path: `/spaces/${validatedParams.spaceId}/permissions`,
              data: {
                subject: {
                  type: perm.principalType,
                  identifier: perm.principalId,
                },
                operation: {
                  key: perm.operation,
                  target: perm.targetType || 'space',
                },
              },
            });
            addedCount++;
          } catch (err: any) {
            errors.push(`Failed to add permission for ${perm.principalId}: ${err.message}`);
          }
        }

        logger.info('Bulk permissions updated', {
          spaceId: validatedParams.spaceId,
          addedCount,
        });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              spaceId: validatedParams.spaceId,
              totalRequested: validatedParams.permissions.length,
              addedCount,
              errors: errors.length > 0 ? errors : undefined,
              message: `Added ${addedCount} of ${validatedParams.permissions.length} permissions`,
            }, null, 2),
          }],
        };
      } catch (error: any) {
        logger.error('Failed to bulk update permissions', { error: error.message });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'BULK_UPDATE_PERMISSIONS_ERROR',
                message: error.message,
                suggestion: 'Verify the space ID and permission data are correct',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );
  */

  // Permission tools registered successfully
}
