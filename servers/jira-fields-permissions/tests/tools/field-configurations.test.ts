import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerFieldConfigurationTools } from '../../src/tools/field-configurations.js';
import { JiraApiClient } from '../../src/api/client.js';

// Mock the API client
jest.mock('../../src/api/client.js');

describe('Field Configuration Tools', () => {
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
    registerFieldConfigurationTools(server, mockApiClient);
  });

  describe('get_field_configurations', () => {
    it('should retrieve all field configurations successfully', async () => {
      const mockConfigurations = [
        {
          id: 1,
          name: 'Default Field Configuration',
          description: 'Default configuration for all fields',
          fieldConfigItems: [],
        },
        {
          id: 2,
          name: 'Custom Field Configuration',
          description: 'Custom configuration for specific projects',
          fieldConfigItems: [
            {
              fieldId: 'customfield_10000',
              isHidden: false,
              isRequired: true,
            },
          ],
        },
      ];

      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: {
          values: mockConfigurations,
          total: 2,
          startAt: 0,
          maxResults: 50,
        },
      });

      const tool = registeredTools.get('get_field_configurations');
      expect(tool).toBeDefined();

      const result = await tool.handler({
        startAt: 0,
        maxResults: 50,
      });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        path: '/fieldconfiguration',
        params: undefined,
      });

      expect(result.content[0].text).toContain('"success": true');
      expect(result.content[0].text).toContain('"fieldConfigurations"');
      expect(result.content[0].text).toContain('Default Field Configuration');
      expect(result.content[0].text).toContain('Custom Field Configuration');
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

      const tool = registeredTools.get('get_field_configurations');
      const result = await tool.handler({
        startAt: 10,
        maxResults: 25,
      });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        path: '/fieldconfiguration',
        params: {
          startAt: 10,
          maxResults: 25,
        },
      });

      expect(result.content[0].text).toContain('"success": true');
    });

    it('should handle API errors gracefully', async () => {
      const apiError = new Error('Access denied') as Error & { code: string };
      apiError.code = 'ACCESS_DENIED';
      mockApiClient.makeRequest.mockRejectedValue(apiError);

      const tool = registeredTools.get('get_field_configurations');
      const result = await tool.handler({});

      expect(result.content[0].text).toContain('"success": false');
      expect(result.content[0].text).toContain('Access denied');
      expect(result.isError).toBe(true);
    });

    it('should handle default parameters', async () => {
      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: { values: [], total: 0, startAt: 0, maxResults: 50 },
      });

      const tool = registeredTools.get('get_field_configurations');
      const result = await tool.handler({});

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        path: '/fieldconfiguration',
        params: undefined,
      });

      expect(result.content[0].text).toContain('"success": true');
    });
  });

  describe('create_field_configuration', () => {
    it('should create a field configuration successfully', async () => {
      const mockResponse = {
        id: 100,
        name: 'New Field Configuration',
        description: 'A new field configuration for testing',
        fieldConfigItems: [],
      };

      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: mockResponse,
      });

      const tool = registeredTools.get('create_field_configuration');
      expect(tool).toBeDefined();

      const result = await tool.handler({
        name: 'New Field Configuration',
        description: 'A new field configuration for testing',
      });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'POST',
        path: '/fieldconfiguration',
        data: {
          name: 'New Field Configuration',
          description: 'A new field configuration for testing',
        },
      });

      expect(result.content[0].text).toContain('"success": true');
      expect(result.content[0].text).toContain('New Field Configuration');
      expect(result.content[0].text).toContain('created successfully');
      expect(result.content[0].text).toContain('ID 100');
    });

    it('should create a field configuration without description', async () => {
      const mockResponse = {
        id: 101,
        name: 'Simple Configuration',
        fieldConfigItems: [],
      };

      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: mockResponse,
      });

      const tool = registeredTools.get('create_field_configuration');
      const result = await tool.handler({
        name: 'Simple Configuration',
      });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'POST',
        path: '/fieldconfiguration',
        data: {
          name: 'Simple Configuration',
        },
      });

      expect(result.content[0].text).toContain('"success": true');
    });

    it('should handle creation errors', async () => {
      const apiError = new Error('Name already exists') as Error & { code: string };
      apiError.code = 'DUPLICATE_NAME';
      mockApiClient.makeRequest.mockRejectedValue(apiError);

      const tool = registeredTools.get('create_field_configuration');
      const result = await tool.handler({
        name: 'Duplicate Name',
      });

      expect(result.content[0].text).toContain('"success": false');
      expect(result.content[0].text).toContain('Name already exists');
      expect(result.isError).toBe(true);
    });

    it('should validate required parameters', async () => {
      const tool = registeredTools.get('create_field_configuration');
      
      const result1 = await tool.handler({});
      expect(result1.isError).toBe(true);
      
      const result2 = await tool.handler({ description: 'Only description' });
      expect(result2.isError).toBe(true);
    });

    it('should validate name length constraints', async () => {
      const tool = registeredTools.get('create_field_configuration');
      
      const result1 = await tool.handler({ name: '' });
      expect(result1.isError).toBe(true);
      
      const result2 = await tool.handler({ name: 'a'.repeat(256) });
      expect(result2.isError).toBe(true);
    });
  });

  describe('update_field_configuration', () => {
    it('should update a field configuration successfully', async () => {
      const mockResponse = {
        id: 100,
        name: 'Updated Configuration',
        description: 'Updated description',
        fieldConfigItems: [],
      };

      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: mockResponse,
      });

      const tool = registeredTools.get('update_field_configuration');
      expect(tool).toBeDefined();

      const result = await tool.handler({
        id: 100,
        name: 'Updated Configuration',
        description: 'Updated description',
      });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'PUT',
        path: '/fieldconfiguration/100',
        data: {
          name: 'Updated Configuration',
          description: 'Updated description',
        },
      });

      expect(result.content[0].text).toContain('"success": true');
      expect(result.content[0].text).toContain('Updated Configuration');
      expect(result.content[0].text).toContain('updated successfully');
    });

    it('should update only specified fields', async () => {
      const mockResponse = {
        id: 100,
        name: 'Only Name Updated',
        description: 'Original description',
      };

      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: mockResponse,
      });

      const tool = registeredTools.get('update_field_configuration');
      const result = await tool.handler({
        id: 100,
        name: 'Only Name Updated',
      });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'PUT',
        path: '/fieldconfiguration/100',
        data: {
          name: 'Only Name Updated',
        },
      });

      expect(result.content[0].text).toContain('"success": true');
    });

    it('should handle update errors', async () => {
      const apiError = new Error('Configuration not found') as Error & { code: string };
      apiError.code = 'CONFIGURATION_NOT_FOUND';
      mockApiClient.makeRequest.mockRejectedValue(apiError);

      const tool = registeredTools.get('update_field_configuration');
      const result = await tool.handler({
        id: 99999,
        name: 'Updated Name',
      });

      expect(result.content[0].text).toContain('"success": false');
      expect(result.content[0].text).toContain('Configuration not found');
      expect(result.isError).toBe(true);
    });

    it('should validate required ID parameter', async () => {
      const tool = registeredTools.get('update_field_configuration');
      
      const result1 = await tool.handler({});
      expect(result1.isError).toBe(true);
      
      const result2 = await tool.handler({ name: 'No ID provided' });
      expect(result2.isError).toBe(true);
    });
  });

  describe('get_field_configuration_schemes', () => {
    it('should retrieve all field configuration schemes successfully', async () => {
      const mockSchemes = [
        {
          id: 1,
          name: 'Default Field Configuration Scheme',
          description: 'Default scheme for all projects',
          fieldConfigurations: [],
        },
        {
          id: 2,
          name: 'Custom Field Configuration Scheme',
          description: 'Custom scheme for specific issue types',
          fieldConfigurations: [
            {
              issueTypeId: '10001',
              fieldConfigurationId: 100,
            },
          ],
        },
      ];

      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: {
          values: mockSchemes,
          total: 2,
          startAt: 0,
          maxResults: 50,
        },
      });

      const tool = registeredTools.get('get_field_configuration_schemes');
      expect(tool).toBeDefined();

      const result = await tool.handler({});

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        path: '/fieldconfigurationscheme',
        params: undefined,
      });

      expect(result.content[0].text).toContain('"success": true');
      expect(result.content[0].text).toContain('"fieldConfigurationSchemes"');
      expect(result.content[0].text).toContain('Default Field Configuration Scheme');
      expect(result.content[0].text).toContain('Custom Field Configuration Scheme');
    });

    it('should handle pagination for schemes', async () => {
      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: {
          values: [],
          total: 0,
          startAt: 5,
          maxResults: 10,
        },
      });

      const tool = registeredTools.get('get_field_configuration_schemes');
      const result = await tool.handler({
        startAt: 5,
        maxResults: 10,
      });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        path: '/fieldconfigurationscheme',
        params: {
          startAt: 5,
          maxResults: 10,
        },
      });

      expect(result.content[0].text).toContain('"success": true');
    });

    it('should handle API errors for schemes', async () => {
      const apiError = new Error('Permission denied') as Error & { code: string };
      apiError.code = 'PERMISSION_DENIED';
      mockApiClient.makeRequest.mockRejectedValue(apiError);

      const tool = registeredTools.get('get_field_configuration_schemes');
      const result = await tool.handler({});

      expect(result.content[0].text).toContain('"success": false');
      expect(result.content[0].text).toContain('Permission denied');
      expect(result.isError).toBe(true);
    });
  });

  describe('create_field_configuration_scheme', () => {
    it('should create a field configuration scheme successfully', async () => {
      const mockResponse = {
        id: 200,
        name: 'New Scheme',
        description: 'A new field configuration scheme',
        fieldConfigurations: [
          {
            issueTypeId: '10001',
            fieldConfigurationId: 100,
          },
        ],
      };

      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: mockResponse,
      });

      const tool = registeredTools.get('create_field_configuration_scheme');
      expect(tool).toBeDefined();

      const result = await tool.handler({
        name: 'New Scheme',
        description: 'A new field configuration scheme',
        fieldConfigurationMappings: [
          {
            issueTypeId: '10001',
            fieldConfigurationId: 100,
          },
        ],
      });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'POST',
        path: '/fieldconfigurationscheme',
        data: {
          name: 'New Scheme',
          description: 'A new field configuration scheme',
          fieldConfigurationMappings: [
            {
              issueTypeId: '10001',
              fieldConfigurationId: 100,
            },
          ],
        },
      });

      expect(result.content[0].text).toContain('"success": true');
      expect(result.content[0].text).toContain('New Scheme');
      expect(result.content[0].text).toContain('created successfully');
      expect(result.content[0].text).toContain('ID 200');
    });

    it('should create a scheme without mappings', async () => {
      const mockResponse = {
        id: 201,
        name: 'Simple Scheme',
        fieldConfigurations: [],
      };

      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: mockResponse,
      });

      const tool = registeredTools.get('create_field_configuration_scheme');
      const result = await tool.handler({
        name: 'Simple Scheme',
      });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'POST',
        path: '/fieldconfigurationscheme',
        data: {
          name: 'Simple Scheme',
        },
      });

      expect(result.content[0].text).toContain('"success": true');
    });

    it('should handle scheme creation errors', async () => {
      const apiError = new Error('Invalid field configuration ID') as Error & { code: string };
      apiError.code = 'INVALID_FIELD_CONFIG_ID';
      mockApiClient.makeRequest.mockRejectedValue(apiError);

      const tool = registeredTools.get('create_field_configuration_scheme');
      const result = await tool.handler({
        name: 'Invalid Scheme',
        fieldConfigurationMappings: [
          {
            issueTypeId: '10001',
            fieldConfigurationId: 99999,
          },
        ],
      });

      expect(result.content[0].text).toContain('"success": false');
      expect(result.content[0].text).toContain('Invalid field configuration ID');
      expect(result.isError).toBe(true);
    });

    it('should validate required scheme parameters', async () => {
      const tool = registeredTools.get('create_field_configuration_scheme');
      
      const result1 = await tool.handler({});
      expect(result1.isError).toBe(true);
      
      const result2 = await tool.handler({ description: 'Only description' });
      expect(result2.isError).toBe(true);
    });

    it('should validate scheme name length constraints', async () => {
      const tool = registeredTools.get('create_field_configuration_scheme');
      
      const result1 = await tool.handler({ name: '' });
      expect(result1.isError).toBe(true);
      
      const result2 = await tool.handler({ name: 'a'.repeat(256) });
      expect(result2.isError).toBe(true);
    });
  });

  it('should register all expected tools', () => {
    expect(registeredTools.has('get_field_configurations')).toBe(true);
    expect(registeredTools.has('create_field_configuration')).toBe(true);
    expect(registeredTools.has('update_field_configuration')).toBe(true);
    expect(registeredTools.has('get_field_configuration_schemes')).toBe(true);
    expect(registeredTools.has('create_field_configuration_scheme')).toBe(true);
    expect(registeredTools.size).toBe(5);
  });

  describe('input validation edge cases', () => {
    it('should validate maxResults upper bound', async () => {
      const tool = registeredTools.get('get_field_configurations');
      
      const result = await tool.handler({ maxResults: 200 });
      expect(result.isError).toBe(true);
    });

    it('should handle empty field configuration mappings array', async () => {
      const mockResponse = {
        id: 202,
        name: 'Empty Mappings Scheme',
        fieldConfigurations: [],
      };

      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: mockResponse,
      });

      const tool = registeredTools.get('create_field_configuration_scheme');
      const result = await tool.handler({
        name: 'Empty Mappings Scheme',
        fieldConfigurationMappings: [],
      });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'POST',
        path: '/fieldconfigurationscheme',
        data: {
          name: 'Empty Mappings Scheme',
          fieldConfigurationMappings: [],
        },
      });

      expect(result.content[0].text).toContain('"success": true');
    });
  });
});