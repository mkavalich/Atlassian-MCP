import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerFieldContextTools } from '../../src/tools/field-contexts.js';
import { JiraApiClient } from '../../src/api/client.js';

// Mock the API client
jest.mock('../../src/api/client.js');

describe('Field Context Tools', () => {
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
    registerFieldContextTools(server, mockApiClient);
  });

  describe('get_custom_field_contexts', () => {
    it('should retrieve all custom field contexts successfully', async () => {
      const mockContexts = [
        {
          id: '10000',
          name: 'Default Configuration Context',
          description: 'Default context for all projects',
          isGlobalContext: true,
        },
        {
          id: '10001',
          name: 'Project-Specific Context',
          description: 'Context for specific projects',
          isGlobalContext: false,
          projectIds: ['10001', '10002'],
          issueTypeIds: ['10001'],
        },
      ];

      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: {
          values: mockContexts,
          total: 2,
          startAt: 0,
          maxResults: 50,
        },
      });

      const tool = registeredTools.get('get_custom_field_contexts');
      expect(tool).toBeDefined();

      const result = await tool.handler({
        fieldId: 'customfield_10000',
        startAt: 0,
        maxResults: 50,
      });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        path: '/field/customfield_10000/context',
        params: undefined,
      });

      expect(result.content[0].text).toContain('"success": true');
      expect(result.content[0].text).toContain('"customFieldContexts"');
      expect(result.content[0].text).toContain('Default Configuration Context');
      expect(result.content[0].text).toContain('Project-Specific Context');
    });

    it('should handle pagination parameters correctly', async () => {
      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: {
          values: [],
          total: 0,
          startAt: 10,
          maxResults: 25,
        },
      });

      const tool = registeredTools.get('get_custom_field_contexts');
      const result = await tool.handler({
        fieldId: 'customfield_10000',
        startAt: 10,
        maxResults: 25,
      });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        path: '/field/customfield_10000/context',
        params: {
          startAt: 10,
          maxResults: 25,
        },
      });

      expect(result.content[0].text).toContain('"success": true');
    });

    it('should handle API errors gracefully', async () => {
      const apiError = new Error('Field not found') as Error & { code: string };
      apiError.code = 'FIELD_NOT_FOUND';
      mockApiClient.makeRequest.mockRejectedValue(apiError);

      const tool = registeredTools.get('get_custom_field_contexts');
      const result = await tool.handler({
        fieldId: 'invalid_field',
      });

      expect(result.content[0].text).toContain('"success": false');
      expect(result.content[0].text).toContain('Field not found');
      expect(result.isError).toBe(true);
    });

    it('should validate input parameters', async () => {
      const tool = registeredTools.get('get_custom_field_contexts');
      
      // These should return error responses, not throw exceptions
      const result1 = await tool.handler({});
      expect(result1.isError).toBe(true);
      
      const result2 = await tool.handler({ fieldId: '' });
      expect(result2.isError).toBe(true);
      
      const result3 = await tool.handler({ fieldId: 'customfield_10000', maxResults: 200 });
      expect(result3.isError).toBe(true);
    });
  });

  describe('create_custom_field_context', () => {
    it('should create a custom field context successfully', async () => {
      const mockResponse = {
        id: '10000',
        name: 'New Context',
        description: 'A new context for testing',
        isGlobalContext: false,
        projectIds: ['10001'],
        issueTypeIds: ['10001'],
      };

      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: mockResponse,
      });

      const tool = registeredTools.get('create_custom_field_context');
      expect(tool).toBeDefined();

      const result = await tool.handler({
        fieldId: 'customfield_10000',
        name: 'New Context',
        description: 'A new context for testing',
        projectIds: ['10001'],
        issueTypeIds: ['10001'],
      });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'POST',
        path: '/field/customfield_10000/context',
        data: {
          name: 'New Context',
          description: 'A new context for testing',
          projectIds: ['10001'],
          issueTypeIds: ['10001'],
        },
      });

      expect(result.content[0].text).toContain('"success": true');
      expect(result.content[0].text).toContain('New Context');
      expect(result.content[0].text).toContain('created successfully');
    });

    it('should create a global context without project/issue type scoping', async () => {
      const mockResponse = {
        id: '10001',
        name: 'Global Context',
        isGlobalContext: true,
      };

      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: mockResponse,
      });

      const tool = registeredTools.get('create_custom_field_context');
      const result = await tool.handler({
        fieldId: 'customfield_10000',
        name: 'Global Context',
      });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'POST',
        path: '/field/customfield_10000/context',
        data: {
          name: 'Global Context',
        },
      });

      expect(result.content[0].text).toContain('"success": true');
    });

    it('should handle creation errors', async () => {
      const apiError = new Error('Insufficient permissions') as Error & { code: string };
      apiError.code = 'PERMISSION_DENIED';
      mockApiClient.makeRequest.mockRejectedValue(apiError);

      const tool = registeredTools.get('create_custom_field_context');
      const result = await tool.handler({
        fieldId: 'customfield_10000',
        name: 'Test Context',
      });

      expect(result.content[0].text).toContain('"success": false');
      expect(result.content[0].text).toContain('Insufficient permissions');
      expect(result.isError).toBe(true);
    });

    it('should validate required parameters', async () => {
      const tool = registeredTools.get('create_custom_field_context');
      
      const result1 = await tool.handler({});
      expect(result1.isError).toBe(true);
      
      const result2 = await tool.handler({ fieldId: 'customfield_10000' });
      expect(result2.isError).toBe(true);
      
      const result3 = await tool.handler({ name: 'Test' });
      expect(result3.isError).toBe(true);
    });
  });

  describe('update_custom_field_context', () => {
    it('should update a custom field context successfully', async () => {
      const mockResponse = {
        id: '10000',
        name: 'Updated Context',
        description: 'Updated description',
        isGlobalContext: false,
      };

      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: mockResponse,
      });

      const tool = registeredTools.get('update_custom_field_context');
      expect(tool).toBeDefined();

      const result = await tool.handler({
        fieldId: 'customfield_10000',
        contextId: '10000',
        name: 'Updated Context',
        description: 'Updated description',
      });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'PUT',
        path: '/field/customfield_10000/context/10000',
        data: {
          name: 'Updated Context',
          description: 'Updated description',
        },
      });

      expect(result.content[0].text).toContain('"success": true');
      expect(result.content[0].text).toContain('Updated Context');
      expect(result.content[0].text).toContain('updated successfully');
    });

    it('should update only specified fields', async () => {
      const mockResponse = {
        id: '10000',
        name: 'Only Name Updated',
        description: 'Original description',
      };

      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: mockResponse,
      });

      const tool = registeredTools.get('update_custom_field_context');
      const result = await tool.handler({
        fieldId: 'customfield_10000',
        contextId: '10000',
        name: 'Only Name Updated',
      });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'PUT',
        path: '/field/customfield_10000/context/10000',
        data: {
          name: 'Only Name Updated',
        },
      });

      expect(result.content[0].text).toContain('"success": true');
    });

    it('should handle update errors', async () => {
      const apiError = new Error('Context not found') as Error & { code: string };
      apiError.code = 'CONTEXT_NOT_FOUND';
      mockApiClient.makeRequest.mockRejectedValue(apiError);

      const tool = registeredTools.get('update_custom_field_context');
      const result = await tool.handler({
        fieldId: 'customfield_10000',
        contextId: '99999',
        name: 'Updated Name',
      });

      expect(result.content[0].text).toContain('"success": false');
      expect(result.content[0].text).toContain('Context not found');
      expect(result.isError).toBe(true);
    });
  });

  describe('delete_custom_field_context', () => {
    it('should delete a custom field context successfully', async () => {
      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
      });

      const tool = registeredTools.get('delete_custom_field_context');
      expect(tool).toBeDefined();

      const result = await tool.handler({
        fieldId: 'customfield_10000',
        contextId: '10000',
      });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'DELETE',
        path: '/field/customfield_10000/context/10000',
      });

      expect(result.content[0].text).toContain('"success": true');
      expect(result.content[0].text).toContain('deleted successfully');
    });

    it('should handle deletion errors', async () => {
      const apiError = new Error('Context is in use') as Error & { code: string };
      apiError.code = 'CONTEXT_IN_USE';
      mockApiClient.makeRequest.mockRejectedValue(apiError);

      const tool = registeredTools.get('delete_custom_field_context');
      const result = await tool.handler({
        fieldId: 'customfield_10000',
        contextId: '10000',
      });

      expect(result.content[0].text).toContain('"success": false');
      expect(result.content[0].text).toContain('Context is in use');
      expect(result.isError).toBe(true);
    });
  });

  describe('get_custom_field_options', () => {
    it('should retrieve custom field options successfully', async () => {
      const mockOptions = [
        {
          id: '10000',
          value: 'Option 1',
          disabled: false,
        },
        {
          id: '10001',
          value: 'Option 2',
          disabled: true,
        },
      ];

      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: {
          values: mockOptions,
          total: 2,
          startAt: 0,
          maxResults: 50,
        },
      });

      const tool = registeredTools.get('get_custom_field_options');
      expect(tool).toBeDefined();

      const result = await tool.handler({
        fieldId: 'customfield_10000',
        contextId: '10000',
      });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        path: '/field/customfield_10000/context/10000/option',
        params: undefined,
      });

      expect(result.content[0].text).toContain('"success": true');
      expect(result.content[0].text).toContain('"customFieldOptions"');
      expect(result.content[0].text).toContain('Option 1');
      expect(result.content[0].text).toContain('Option 2');
    });
  });

  describe('create_custom_field_options', () => {
    it('should create custom field options successfully', async () => {
      const mockResponse = {
        options: [
          {
            id: '10000',
            value: 'New Option 1',
            disabled: false,
          },
          {
            id: '10001',
            value: 'New Option 2',
            disabled: false,
          },
        ],
      };

      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: mockResponse,
      });

      const tool = registeredTools.get('create_custom_field_options');
      expect(tool).toBeDefined();

      const result = await tool.handler({
        fieldId: 'customfield_10000',
        contextId: '10000',
        options: [
          { value: 'New Option 1' },
          { value: 'New Option 2' },
        ],
      });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'POST',
        path: '/field/customfield_10000/context/10000/option',
        data: {
          options: [
            { value: 'New Option 1', disabled: false },
            { value: 'New Option 2', disabled: false },
          ],
        },
      });

      expect(result.content[0].text).toContain('"success": true');
      expect(result.content[0].text).toContain('2 custom field option(s) created successfully');
    });

    it('should validate options array is not empty', async () => {
      const tool = registeredTools.get('create_custom_field_options');
      
      const result = await tool.handler({
        fieldId: 'customfield_10000',
        contextId: '10000',
        options: [],
      });
      expect(result.isError).toBe(true);
    });
  });

  it('should register all expected tools', () => {
    expect(registeredTools.has('get_custom_field_contexts')).toBe(true);
    expect(registeredTools.has('create_custom_field_context')).toBe(true);
    expect(registeredTools.has('update_custom_field_context')).toBe(true);
    expect(registeredTools.has('delete_custom_field_context')).toBe(true);
    expect(registeredTools.has('get_custom_field_options')).toBe(true);
    expect(registeredTools.has('create_custom_field_options')).toBe(true);
    expect(registeredTools.size).toBe(6);
  });
});