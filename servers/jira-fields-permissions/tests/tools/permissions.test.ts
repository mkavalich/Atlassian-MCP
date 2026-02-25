import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerPermissionTools } from '../../src/tools/permissions.js';
import { JiraApiClient } from '../../src/api/client.js';

// Mock the API client
jest.mock('../../src/api/client.js');

describe('Permission Tools', () => {
  let server: McpServer;
  let mockApiClient: jest.Mocked<JiraApiClient>;
  let registeredTools: Map<string, any>;

  beforeEach(() => {
    // Create mock server
    registeredTools = new Map();
    server = {
      registerTool: jest.fn((name: string, schema: any, handler: any) => {
        registeredTools.set(name, { schema, handler });
      }),
    } as any;

    // Create mock API client
    mockApiClient = {
      makeRequest: jest.fn(),
    } as any;

    // Register tools
    registerPermissionTools(server, mockApiClient);
  });

  describe('get_permission_schemes', () => {
    it('should retrieve all permission schemes successfully', async () => {
      const mockSchemes = [
        {
          id: 10000,
          name: 'Default Permission Scheme',
          description: 'Default scheme for all projects',
          permissions: [],
        },
        {
          id: 10001,
          name: 'Restricted Permission Scheme',
          description: 'Restricted access scheme',
          permissions: [],
        },
      ];

      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: { permissionSchemes: mockSchemes },
      });

      const tool = registeredTools.get('get_permission_schemes');
      const result = await tool.handler({});

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        path: '/permissionscheme',
        params: undefined,
      });

      expect(result.isError).toBeUndefined();
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.permissionSchemes).toEqual(mockSchemes);
      expect(response.count).toBe(2);
    });

    it('should retrieve permission schemes with expand parameter', async () => {
      const mockSchemes = [
        {
          id: 10000,
          name: 'Default Permission Scheme',
          description: 'Default scheme',
          permissions: [
            {
              permission: 'BROWSE_PROJECTS',
              holder: { type: 'anyone' },
            },
          ],
        },
      ];

      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: { permissionSchemes: mockSchemes },
      });

      const tool = registeredTools.get('get_permission_schemes');
      const result = await tool.handler({
        expand: 'permissions',
      });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        path: '/permissionscheme',
        params: { expand: 'permissions' },
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.permissionSchemes[0].permissions).toBeDefined();
    });

    it('should handle API errors', async () => {
      mockApiClient.makeRequest.mockRejectedValue(new Error('API Error'));

      const tool = registeredTools.get('get_permission_schemes');
      const result = await tool.handler({});

      expect(result.isError).toBe(true);
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error.code).toBe('GET_PERMISSION_SCHEMES_ERROR');
    });
  });

  describe('create_permission_scheme', () => {
    it('should create a permission scheme successfully', async () => {
      const mockScheme = {
        id: 10002,
        name: 'New Permission Scheme',
        description: 'A newly created scheme',
        permissions: [],
      };

      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: mockScheme,
      });

      const tool = registeredTools.get('create_permission_scheme');
      const result = await tool.handler({
        name: 'New Permission Scheme',
        description: 'A newly created scheme',
        permissions: [
          {
            permission: 'BROWSE_PROJECTS',
            holder: { type: 'anyone' },
          },
        ],
      });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'POST',
        path: '/permissionscheme',
        data: {
          name: 'New Permission Scheme',
          description: 'A newly created scheme',
          permissions: [
            {
              permission: 'BROWSE_PROJECTS',
              holder: { type: 'anyone' },
            },
          ],
        },
      });

      expect(result.isError).toBeUndefined();
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.permissionScheme).toEqual(mockScheme);
      expect(response.message).toContain('New Permission Scheme');
    });

    it('should create a minimal permission scheme', async () => {
      const mockScheme = {
        id: 10003,
        name: 'Minimal Scheme',
        permissions: [],
      };

      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: mockScheme,
      });

      const tool = registeredTools.get('create_permission_scheme');
      const result = await tool.handler({
        name: 'Minimal Scheme',
      });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'POST',
        path: '/permissionscheme',
        data: {
          name: 'Minimal Scheme',
          description: undefined,
          permissions: undefined,
        },
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
    });

    it('should handle validation errors', async () => {
      const tool = registeredTools.get('create_permission_scheme');
      const result = await tool.handler({
        name: '', // Invalid: empty name
      });

      expect(result.isError).toBe(true);
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error.code).toBe('CREATE_PERMISSION_SCHEME_ERROR');
    });
  });

  describe('update_permission_scheme', () => {
    it('should update permission scheme name and description', async () => {
      const mockCurrentScheme = {
        id: 10001,
        name: 'Old Name',
        description: 'Old description',
        permissions: [],
      };
      const mockUpdatedScheme = {
        id: 10001,
        name: 'Updated Scheme Name',
        description: 'Updated description',
        permissions: [],
      };

      mockApiClient.makeRequest
        .mockResolvedValueOnce({ success: true, data: mockCurrentScheme })
        .mockResolvedValueOnce({ success: true, data: mockUpdatedScheme });

      const tool = registeredTools.get('update_permission_scheme');
      const result = await tool.handler({
        schemeId: 10001,
        name: 'Updated Scheme Name',
        description: 'Updated description',
      });

      expect(mockApiClient.makeRequest).toHaveBeenNthCalledWith(2, {
        method: 'PUT',
        path: '/permissionscheme/10001',
        data: {
          name: 'Updated Scheme Name',
          description: 'Updated description',
        },
      });

      expect(result.isError).toBeUndefined();
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.permissionScheme).toEqual(mockUpdatedScheme);
      expect(response.message).toContain('Permission scheme 10001 updated successfully');
    });

    it('should update only the name', async () => {
      const mockCurrentScheme = {
        id: 10001,
        name: 'Original Name',
        description: 'Original description',
        permissions: [],
      };
      const mockUpdatedScheme = {
        id: 10001,
        name: 'New Name Only',
        description: 'Original description',
        permissions: [],
      };

      // First call: GET current scheme, second call: PUT update
      mockApiClient.makeRequest
        .mockResolvedValueOnce({ success: true, data: mockCurrentScheme })
        .mockResolvedValueOnce({ success: true, data: mockUpdatedScheme });

      const tool = registeredTools.get('update_permission_scheme');
      const result = await tool.handler({
        schemeId: 10001,
        name: 'New Name Only',
      });

      expect(mockApiClient.makeRequest).toHaveBeenNthCalledWith(1, {
        method: 'GET',
        path: '/permissionscheme/10001',
      });
      expect(mockApiClient.makeRequest).toHaveBeenNthCalledWith(2, {
        method: 'PUT',
        path: '/permissionscheme/10001',
        data: {
          name: 'New Name Only',
          description: 'Original description',
        },
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
    });

    it('should clear description when set to empty string', async () => {
      const mockCurrentScheme = {
        id: 10001,
        name: 'Scheme Name',
        description: 'Old description',
        permissions: [],
      };
      const mockUpdatedScheme = {
        id: 10001,
        name: 'Scheme Name',
        description: '',
        permissions: [],
      };

      mockApiClient.makeRequest
        .mockResolvedValueOnce({ success: true, data: mockCurrentScheme })
        .mockResolvedValueOnce({ success: true, data: mockUpdatedScheme });

      const tool = registeredTools.get('update_permission_scheme');
      const result = await tool.handler({
        schemeId: 10001,
        description: '',
      });

      expect(mockApiClient.makeRequest).toHaveBeenNthCalledWith(2, {
        method: 'PUT',
        path: '/permissionscheme/10001',
        data: {
          name: 'Scheme Name',
          description: '',
        },
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
    });

    it('should handle update errors', async () => {
      mockApiClient.makeRequest.mockRejectedValue(new Error('Scheme not found'));

      const tool = registeredTools.get('update_permission_scheme');
      const result = await tool.handler({
        schemeId: 99999,
        name: 'Updated Name',
      });

      expect(result.isError).toBe(true);
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error.suggestion).toContain('Ensure the permission scheme exists and you have admin permissions');
    });
  });

  describe('delete_permission_scheme', () => {
    it('should delete permission scheme successfully', async () => {
      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
      });

      const tool = registeredTools.get('delete_permission_scheme');
      const result = await tool.handler({
        schemeId: 10002,
      });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'DELETE',
        path: '/permissionscheme/10002',
      });

      expect(result.isError).toBeUndefined();
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.message).toContain('Permission scheme 10002 deleted successfully');
    });

    it('should handle deletion errors', async () => {
      mockApiClient.makeRequest.mockRejectedValue(new Error('Scheme is in use'));

      const tool = registeredTools.get('delete_permission_scheme');
      const result = await tool.handler({
        schemeId: 10000,
      });

      expect(result.isError).toBe(true);
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error.suggestion).toContain('Ensure the permission scheme exists, is not in use, and you have admin permissions');
    });
  });

  describe('get_permission_grants', () => {
    it('should retrieve permission grants successfully', async () => {
      const mockPermissions = [
        {
          id: 10100,
          permission: 'BROWSE_PROJECTS',
          holder: { type: 'anyone' },
        },
        {
          id: 10101,
          permission: 'CREATE_ISSUES',
          holder: { type: 'projectRole', parameter: 'developers' },
        },
      ];

      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: { permissions: mockPermissions },
      });

      const tool = registeredTools.get('get_permission_grants');
      const result = await tool.handler({
        schemeId: 10001,
      });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        path: '/permissionscheme/10001/permission',
        params: {},
      });

      expect(result.isError).toBeUndefined();
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.permissions).toEqual(mockPermissions);
      expect(response.schemeId).toBe(10001);
      expect(response.count).toBe(2);
    });

    it('should retrieve permission grants with expand parameter', async () => {
      const mockPermissions = [
        {
          id: 10100,
          permission: 'BROWSE_PROJECTS',
          holder: { 
            type: 'projectRole',
            parameter: 'developers',
            expand: 'user,group'
          },
        },
      ];

      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: { permissions: mockPermissions },
      });

      const tool = registeredTools.get('get_permission_grants');
      const result = await tool.handler({
        schemeId: 10001,
        expand: 'user,group',
      });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        path: '/permissionscheme/10001/permission',
        params: { expand: 'user,group' },
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.permissions[0].holder.expand).toBeDefined();
    });

    it('should handle direct permissions array response', async () => {
      const mockPermissions = [
        {
          id: 10100,
          permission: 'BROWSE_PROJECTS',
          holder: { type: 'anyone' },
        },
      ];

      // Some API responses return permissions directly instead of wrapped
      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: mockPermissions,
      });

      const tool = registeredTools.get('get_permission_grants');
      const result = await tool.handler({
        schemeId: 10001,
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.permissions).toEqual(mockPermissions);
    });

    it('should handle errors when retrieving permission grants', async () => {
      mockApiClient.makeRequest.mockRejectedValue(new Error('Scheme not found'));

      const tool = registeredTools.get('get_permission_grants');
      const result = await tool.handler({
        schemeId: 99999,
      });

      expect(result.isError).toBe(true);
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error.suggestion).toContain('Ensure the permission scheme exists and you have view permissions');
    });
  });

  describe('create_permission_grant', () => {
    it('should create permission grant for anyone', async () => {
      const mockGrant = {
        id: 10200,
        permission: 'BROWSE_PROJECTS',
        holder: { type: 'anyone' },
      };

      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: mockGrant,
      });

      const tool = registeredTools.get('create_permission_grant');
      const result = await tool.handler({
        schemeId: 10001,
        permission: 'BROWSE_PROJECTS',
        holder: { type: 'anyone' },
      });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'POST',
        path: '/permissionscheme/10001/permission',
        data: {
          permission: 'BROWSE_PROJECTS',
          holder: { type: 'anyone' },
        },
      });

      expect(result.isError).toBeUndefined();
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.permissionGrant).toEqual(mockGrant);
      expect(response.message).toContain('Permission grant for BROWSE_PROJECTS created successfully');
    });

    it('should create permission grant for group', async () => {
      const mockGrant = {
        id: 10201,
        permission: 'CREATE_ISSUES',
        holder: { type: 'group', parameter: 'developers' },
      };

      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: mockGrant,
      });

      const tool = registeredTools.get('create_permission_grant');
      const result = await tool.handler({
        schemeId: 10001,
        permission: 'CREATE_ISSUES',
        holder: { type: 'group', parameter: 'developers' },
      });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'POST',
        path: '/permissionscheme/10001/permission',
        data: {
          permission: 'CREATE_ISSUES',
          holder: { type: 'group', parameter: 'developers' },
        },
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.permissionGrant.holder.parameter).toBe('developers');
    });

    it('should create permission grant for project role', async () => {
      const mockGrant = {
        id: 10202,
        permission: 'ADMINISTER_PROJECTS',
        holder: { type: 'projectRole', parameter: '10002' },
      };

      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: mockGrant,
      });

      const tool = registeredTools.get('create_permission_grant');
      const result = await tool.handler({
        schemeId: 10001,
        permission: 'ADMINISTER_PROJECTS',
        holder: { type: 'projectRole', parameter: '10002' },
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.permissionGrant.holder.type).toBe('projectRole');
    });

    it('should handle permission grant creation errors', async () => {
      mockApiClient.makeRequest.mockRejectedValue(new Error('Invalid permission key'));

      const tool = registeredTools.get('create_permission_grant');
      const result = await tool.handler({
        schemeId: 10001,
        permission: 'INVALID_PERMISSION',
        holder: { type: 'anyone' },
      });

      expect(result.isError).toBe(true);
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error.suggestion).toContain('Verify the permission key, holder type, and that you have admin permissions');
    });

    it('should validate holder types', async () => {
      const tool = registeredTools.get('create_permission_grant');
      const result = await tool.handler({
        schemeId: 10001,
        permission: 'BROWSE_PROJECTS',
        holder: { type: 'invalid_type' as any },
      });

      expect(result.isError).toBe(true);
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error.code).toBe('CREATE_PERMISSION_GRANT_ERROR');
    });
  });

  describe('delete_permission_grant', () => {
    it('should delete permission grant successfully', async () => {
      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
      });

      const tool = registeredTools.get('delete_permission_grant');
      const result = await tool.handler({
        schemeId: 10001,
        permissionId: 10200,
      });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'DELETE',
        path: '/permissionscheme/10001/permission/10200',
      });

      expect(result.isError).toBeUndefined();
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.message).toContain('Permission grant 10200 deleted from scheme 10001 successfully');
    });

    it('should handle permission grant deletion errors', async () => {
      mockApiClient.makeRequest.mockRejectedValue(new Error('Permission grant not found'));

      const tool = registeredTools.get('delete_permission_grant');
      const result = await tool.handler({
        schemeId: 10001,
        permissionId: 99999,
      });

      expect(result.isError).toBe(true);
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error.suggestion).toContain('Ensure the permission grant exists and you have admin permissions');
    });
  });

  describe('input validation', () => {
    it('should validate schemeId as number for update_permission_scheme', async () => {
      const tool = registeredTools.get('update_permission_scheme');
      const result = await tool.handler({
        schemeId: 'invalid' as any,
        name: 'New Name',
      });

      expect(result.isError).toBe(true);
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
    });

    it('should validate permission holder types for create_permission_grant', async () => {
      const tool = registeredTools.get('create_permission_grant');
      const result = await tool.handler({
        schemeId: 10001,
        permission: 'BROWSE_PROJECTS',
        holder: { type: 'unknownType' as any },
      });

      expect(result.isError).toBe(true);
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
    });
  });
});