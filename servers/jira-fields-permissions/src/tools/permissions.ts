import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { JiraApiClient } from '../api/client.js';
import {
  getPermissionSchemesSchema,
  createPermissionSchemeSchema,
  assignPermissionSchemeToProjectSchema,
  updatePermissionSchemeSchema,
  deletePermissionSchemeSchema,
  getPermissionGrantsSchema,
  createPermissionGrantSchema,
  deletePermissionGrantSchema,
  getGlobalPermissionsSchema,
  getMyPermissionsSchema,
  // REMOVED: getUserPermissionsSchema - Cloud API limitation
  // REMOVED: validatePermissionsSchema - Cloud API limitation
  // REMOVED: getPermissionSchemeUsersSchema - Cloud API limitation
  // REMOVED: getProjectPermissionsSchema - Cloud API limitation
} from '../validation/schemas.js';
import {
  getPermissionSchemesInputSchema,
  createPermissionSchemeInputSchema,
  assignPermissionSchemeToProjectInputSchema,
  updatePermissionSchemeInputSchema,
  deletePermissionSchemeInputSchema,
  getPermissionGrantsInputSchema,
  createPermissionGrantInputSchema,
  deletePermissionGrantInputSchema,
  getGlobalPermissionsInputSchema,
  getMyPermissionsInputSchema,
  // REMOVED: getUserPermissionsInputSchema - Cloud API limitation
  // REMOVED: validatePermissionsInputSchema - Cloud API limitation
  // REMOVED: getPermissionSchemeUsersInputSchema - Cloud API limitation
  // REMOVED: getProjectPermissionsInputSchema - Cloud API limitation
} from '../validation/input-schemas.js';
import { JiraPermissionScheme } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { toolExamples } from '../validation/tool-examples.js';


export async function registerPermissionTools(server: McpServer, apiClient: JiraApiClient) {
  // Tool: getPermissionSchemes
  server.registerTool(
    'get_permission_schemes',
    {
      title: 'Get Permission Schemes',
      description: '🔍 DISCOVERY TOOL: Primary discovery method for permission scheme operations. Use this first to find available permission scheme IDs before using other permission scheme management tools. Returns comprehensive list with IDs, names, and key properties needed for subsequent operations.',
      inputSchema: getPermissionSchemesInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = getPermissionSchemesSchema.parse(params);

        const response = await apiClient.makeRequest<{ permissionSchemes: JiraPermissionScheme[] }>({
          method: 'GET',
          path: '/permissionscheme',
          params: validatedParams.expand ? { expand: validatedParams.expand } : undefined,
        });

        if (response.success && response.data) {
          const permissionSchemes = response.data.permissionSchemes || response.data;

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                permissionSchemes,
                count: permissionSchemes.length || 0,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to retrieve permission schemes');
      } catch (error: any) {
        logger.error('Failed to get permission schemes', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_PERMISSION_SCHEMES_ERROR',
                message: error.message,
                details: error.details,
                suggestion: error.suggestion,
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: createPermissionScheme
  server.registerTool(
    'create_permission_scheme',
    {
      title: 'Create Permission Scheme',
      description: '🆕 CREATE: Creates a new permission scheme with specified permissions. After creation, use the returned ID with other permission scheme management tools. Related tools: "get_permission_schemes", "update_permission_scheme".',
      inputSchema: createPermissionSchemeInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = createPermissionSchemeSchema.parse(params);
        
        const response = await apiClient.makeRequest<JiraPermissionScheme>({
          method: 'POST',
          path: '/permissionscheme',
          data: {
            name: validatedParams.name,
            description: validatedParams.description,
            permissions: validatedParams.permissions,
          },
        });

        if (response.success && response.data) {
          logger.info('Permission scheme created successfully', { 
            schemeId: response.data.id,
            schemeName: response.data.name 
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                permissionScheme: response.data,
                message: `Permission scheme '${response.data.name}' created successfully`,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to create permission scheme');
      } catch (error: any) {
        logger.error('Failed to create permission scheme', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'CREATE_PERMISSION_SCHEME_ERROR',
                message: error.message,
                details: error.details,
                suggestion: error.suggestion || 'Ensure you have Jira Administrator permissions',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: assignPermissionSchemeToProject - REMOVED: Requires project admin permissions and complex prerequisites
  // Use Jira UI: Project Settings → Permissions → Actions → Use a different scheme

  // Tool: updatePermissionScheme
  server.registerTool(
    'update_permission_scheme',
    {
      title: 'Update Permission Scheme',
      description: '⚠️ PREREQUISITE: Use "get_permission_schemes" first to find valid permission scheme IDs. Updates an existing permission scheme name and/or description. Supports partial updates - only provide the fields you want to change. If you get "Permission scheme not found" errors, the scheme likely doesn\'t exist - use the discovery tool to find valid IDs first.',
      inputSchema: updatePermissionSchemeInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = updatePermissionSchemeSchema.parse(params);

        // First, fetch the current scheme to get existing values (API requires name)
        const currentScheme = await apiClient.makeRequest<JiraPermissionScheme>({
          method: 'GET',
          path: `/permissionscheme/${validatedParams.schemeId}`,
        });

        if (!currentScheme.success || !currentScheme.data) {
          throw new Error(`Permission scheme ${validatedParams.schemeId} not found`);
        }

        // Merge provided updates with existing data (name is required by API)
        const updateData: any = {
          name: validatedParams.name || currentScheme.data.name,
          description: validatedParams.description !== undefined
            ? validatedParams.description
            : currentScheme.data.description,
        };

        const response = await apiClient.makeRequest<JiraPermissionScheme>({
          method: 'PUT',
          path: `/permissionscheme/${validatedParams.schemeId}`,
          data: updateData,
        });

        if (response.success && response.data) {
          logger.info('Permission scheme updated successfully', { 
            schemeId: validatedParams.schemeId,
            schemeName: response.data.name 
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                permissionScheme: response.data,
                message: `Permission scheme ${validatedParams.schemeId} updated successfully`,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to update permission scheme');
      } catch (error: any) {
        logger.error('Failed to update permission scheme', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'UPDATE_PERMISSION_SCHEME_ERROR',
                message: error.message,
                details: error.details,
                suggestion: error.suggestion || 'Ensure the permission scheme exists and you have admin permissions',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: deletePermissionScheme
  server.registerTool(
    'delete_permission_scheme',
    {
      title: 'Delete Permission Scheme',
      description: '⚠️ PREREQUISITE: Use "get_permission_schemes" first to find valid permission scheme IDs. Deletes a permission scheme by ID. If you get "Permission scheme not found" errors, the scheme likely doesn\'t exist - use the discovery tool to find valid IDs first.',
      inputSchema: deletePermissionSchemeInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
      },
    },
    async (params) => {
      try {
        const validatedParams = deletePermissionSchemeSchema.parse(params);
        
        const response = await apiClient.makeRequest<void>({
          method: 'DELETE',
          path: `/permissionscheme/${validatedParams.schemeId}`,
        });

        if (response.success) {
          logger.info('Permission scheme deleted successfully', { 
            schemeId: validatedParams.schemeId 
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Permission scheme ${validatedParams.schemeId} deleted successfully`,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to delete permission scheme');
      } catch (error: any) {
        logger.error('Failed to delete permission scheme', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'DELETE_PERMISSION_SCHEME_ERROR',
                message: error.message,
                details: error.details,
                suggestion: error.suggestion || 'Ensure the permission scheme exists, is not in use, and you have admin permissions',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: getPermissionGrants
  server.registerTool(
    'get_permission_grants',
    {
      title: 'Get Permission Grants',
      description: '⚠️ PREREQUISITE: Use "get_permission_schemes" first to find valid permission scheme IDs. Gets all permission grants for a specific permission scheme. If you get "Permission scheme not found" errors, the scheme likely doesn\'t exist - use the discovery tool to find valid IDs first.',
      inputSchema: getPermissionGrantsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = getPermissionGrantsSchema.parse(params);

        const queryParams: any = {};
        if (validatedParams.expand) queryParams.expand = validatedParams.expand;

        const response = await apiClient.makeRequest<any>({
          method: 'GET',
          path: `/permissionscheme/${validatedParams.schemeId}/permission`,
          params: queryParams,
        });

        if (response.success && response.data) {
          const permissions = response.data.permissions || response.data;

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                permissions,
                schemeId: validatedParams.schemeId,
                count: permissions.length || 0,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to retrieve permission grants');
      } catch (error: any) {
        logger.error('Failed to get permission grants', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_PERMISSION_GRANTS_ERROR',
                message: error.message,
                details: error.details,
                suggestion: error.suggestion || 'Ensure the permission scheme exists and you have view permissions',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: createPermissionGrant
  server.registerTool(
    'create_permission_grant',
    {
      title: 'Create Permission Grant',
      description: '⚠️ PREREQUISITE: Use "get_permission_schemes" first to find valid permission scheme IDs. Adds a permission grant to a permission scheme. If you get "Permission scheme not found" errors, the scheme likely doesn\'t exist - use the discovery tool to find valid IDs first.',
      inputSchema: createPermissionGrantInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
      },
      examples: toolExamples['create_permission_grant'],
    },
    async (params) => {
      try {
        const validatedParams = createPermissionGrantSchema.parse(params);
        
        const grantData = {
          permission: validatedParams.permission,
          holder: validatedParams.holder,
        };

        const response = await apiClient.makeRequest<any>({
          method: 'POST',
          path: `/permissionscheme/${validatedParams.schemeId}/permission`,
          data: grantData,
        });

        if (response.success && response.data) {
          logger.info('Permission grant created successfully', { 
            schemeId: validatedParams.schemeId,
            permission: validatedParams.permission,
            holderType: validatedParams.holder.type 
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                permissionGrant: response.data,
                message: `Permission grant for ${validatedParams.permission} created successfully in scheme ${validatedParams.schemeId}`,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to create permission grant');
      } catch (error: any) {
        logger.error('Failed to create permission grant', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'CREATE_PERMISSION_GRANT_ERROR',
                message: error.message,
                details: error.details,
                suggestion: error.suggestion || 'Verify the permission key, holder type, and that you have admin permissions',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: deletePermissionGrant
  server.registerTool(
    'delete_permission_grant',
    {
      title: 'Delete Permission Grant',
      description: '⚠️ PREREQUISITE: Use "get_permission_schemes" first to find valid permission scheme IDs. Removes a permission grant from a permission scheme. If you get "Permission scheme not found" errors, the scheme likely doesn\'t exist - use the discovery tool to find valid IDs first.',
      inputSchema: deletePermissionGrantInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
      },
    },
    async (params) => {
      try {
        const validatedParams = deletePermissionGrantSchema.parse(params);
        
        const response = await apiClient.makeRequest<void>({
          method: 'DELETE',
          path: `/permissionscheme/${validatedParams.schemeId}/permission/${validatedParams.permissionId}`,
        });

        if (response.success) {
          logger.info('Permission grant deleted successfully', { 
            schemeId: validatedParams.schemeId,
            permissionId: validatedParams.permissionId 
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Permission grant ${validatedParams.permissionId} deleted from scheme ${validatedParams.schemeId} successfully`,
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to delete permission grant');
      } catch (error: any) {
        logger.error('Failed to delete permission grant', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'DELETE_PERMISSION_GRANT_ERROR',
                message: error.message,
                details: error.details,
                suggestion: error.suggestion || 'Ensure the permission grant exists and you have admin permissions',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: getGlobalPermissions
  server.registerTool(
    'get_global_permissions',
    {
      title: 'Get Global Permissions',
      description: '🔍 DISCOVERY TOOL: Primary discovery method for global permission operations. Use this first to find available global permissions before configuring permission schemes. Returns comprehensive list with permission keys and descriptions needed for subsequent operations.',
      inputSchema: getGlobalPermissionsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = getGlobalPermissionsSchema.parse(params);

        const queryParams: any = {};
        if (validatedParams.expand) queryParams.expand = validatedParams.expand;

        const response = await apiClient.makeRequest<any>({
          method: 'GET',
          path: '/permissions',
          params: queryParams,
        });

        if (response.success && response.data) {
          const permissions = response.data.permissions || response.data;

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                permissions,
                count: permissions.length || Object.keys(permissions).length || 0,
                message: 'Global permissions retrieved successfully',
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to retrieve global permissions');
      } catch (error: any) {
        logger.error('Failed to get global permissions', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_GLOBAL_PERMISSIONS_ERROR',
                message: error.message,
                details: error.details,
                suggestion: error.suggestion || 'Ensure you have Jira Administrator permissions to view global permissions',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool: getMyPermissions
  server.registerTool(
    'get_my_permissions',
    {
      title: 'Get My Permissions',
      description: '🔍 DISCOVERY TOOL: Gets current user permissions for a specific project, issue, or globally. Use this to understand your current access levels before attempting other operations.',
      inputSchema: getMyPermissionsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (params) => {
      try {
        const validatedParams = getMyPermissionsSchema.parse(params);

        const queryParams: any = {};
        if (validatedParams.projectKey) queryParams.projectKey = validatedParams.projectKey;
        if (validatedParams.projectId) queryParams.projectId = validatedParams.projectId;
        if (validatedParams.issueKey) queryParams.issueKey = validatedParams.issueKey;
        if (validatedParams.issueId) queryParams.issueId = validatedParams.issueId;
        if (validatedParams.permissions) queryParams.permissions = validatedParams.permissions;

        const response = await apiClient.makeRequest<any>({
          method: 'GET',
          path: '/mypermissions',
          params: queryParams,
        });

        if (response.success && response.data) {
          const permissions = response.data.permissions || response.data;

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                permissions,
                context: {
                  projectKey: validatedParams.projectKey,
                  projectId: validatedParams.projectId,
                  issueKey: validatedParams.issueKey,
                  issueId: validatedParams.issueId,
                },
                message: 'User permissions retrieved successfully',
              }, null, 2),
            }],
          };
        }

        throw new Error('Failed to retrieve user permissions');
      } catch (error: any) {
        logger.error('Failed to get my permissions', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: {
                code: error.code || 'GET_MY_PERMISSIONS_ERROR',
                message: error.message,
                details: error.details,
                suggestion: error.suggestion || 'Ensure you have valid authentication and the specified project/issue exists',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // REMOVED: get_user_permissions - Cloud API limitation (permissions/check endpoint has inconsistent behavior)
  // REMOVED: validate_permissions - Cloud API limitation (permissions/check endpoint has inconsistent behavior)
  // REMOVED: get_permission_scheme_users - Cloud API limitation (endpoint not available)
  // REMOVED: get_project_permissions - Cloud API limitation (redundant with get_my_permissions)

  // Permission tools registered successfully (logging disabled for MCP compatibility)
}