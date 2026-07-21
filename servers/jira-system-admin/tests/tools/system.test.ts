import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerSystemTools } from '../../src/tools/system.js';
import { JiraApiClient } from '../../src/api/client.js';

// Mock the API client
jest.mock('../../src/api/client.js');

describe('System Tools', () => {
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
    registerSystemTools(server, mockApiClient);
  });

  describe('get_audit_records', () => {
    it('should retrieve audit records successfully', async () => {
      const mockAuditRecords = {
        records: [
          {
            id: 1001,
            summary: 'User created',
            category: 'USER_MANAGEMENT',
            eventSource: 'Jira',
            created: '2024-01-01T10:00:00.000Z',
            author: {
              accountId: 'user123',
              displayName: 'Admin User',
            },
          },
          {
            id: 1002,
            summary: 'Project created',
            category: 'PROJECT_MANAGEMENT',
            eventSource: 'Jira',
            created: '2024-01-01T11:00:00.000Z',
            author: {
              accountId: 'user123',
              displayName: 'Admin User',
            },
          },
        ],
        total: 2,
        offset: 0,
        limit: 100,
      };

      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: mockAuditRecords,
      });

      const tool = registeredTools.get('get_audit_records');
      const result = await tool.handler({});

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        path: '/auditing/record',
        params: {
          offset: 0,
          limit: 100,
        },
      });

      expect(result.isError).toBeUndefined();
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.records).toEqual(mockAuditRecords.records);
      expect(response.total).toBe(2);
    });

    it('should retrieve audit records with filters', async () => {
      const mockAuditRecords = {
        records: [
          {
            id: 1001,
            summary: 'User created',
            category: 'USER_MANAGEMENT',
            created: '2024-01-01T10:00:00.000Z',
          },
        ],
        total: 1,
        offset: 10,
        limit: 50,
      };

      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: mockAuditRecords,
      });

      const tool = registeredTools.get('get_audit_records');
      const result = await tool.handler({
        offset: 10,
        limit: 50,
        filter: 'category = USER_MANAGEMENT',
        from: '2024-01-01',
        to: '2024-01-31',
      });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        path: '/auditing/record',
        params: {
          offset: 10,
          limit: 50,
          filter: 'category = USER_MANAGEMENT',
          from: '2024-01-01',
          to: '2024-01-31',
        },
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.offset).toBe(10);
      expect(response.limit).toBe(50);
    });

    it('should handle direct records array response', async () => {
      const mockRecords = [
        {
          id: 1001,
          summary: 'User created',
          category: 'USER_MANAGEMENT',
        },
      ];

      // Some responses may return records directly
      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: mockRecords,
      });

      const tool = registeredTools.get('get_audit_records');
      const result = await tool.handler({});

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.records).toEqual(mockRecords);
    });

    it('should handle audit records errors', async () => {
      mockApiClient.makeRequest.mockRejectedValue(new Error('Access denied'));

      const tool = registeredTools.get('get_audit_records');
      const result = await tool.handler({});

      expect(result.isError).toBe(true);
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error.suggestion).toContain('Ensure you have audit log viewing permissions');
    });

    it('should validate limit parameter', async () => {
      const tool = registeredTools.get('get_audit_records');
      const result = await tool.handler({
        limit: 2000, // Exceeds max of 1000
      });

      expect(result.isError).toBe(true);
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
    });
  });

  describe('get_instance_info', () => {
    it('should retrieve instance information successfully', async () => {
      const mockInstanceInfo = {
        version: '9.4.7',
        versionNumbers: [9, 4, 7],
        deploymentType: 'Cloud',
        buildNumber: 904007,
        buildDate: '2024-01-15T10:30:00.000Z',
        databaseBuildNumber: 904007,
        serverTitle: 'Test Jira Instance',
        baseUrl: 'https://test.atlassian.net',
      };

      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: mockInstanceInfo,
      });

      const tool = registeredTools.get('get_instance_info');
      const result = await tool.handler({});

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        path: '/serverInfo',
      });

      expect(result.isError).toBeUndefined();
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.instanceInfo).toEqual(mockInstanceInfo);
      expect(response.instanceInfo.version).toBe('9.4.7');
      expect(response.instanceInfo.deploymentType).toBe('Cloud');
    });

    it('should handle instance info errors', async () => {
      mockApiClient.makeRequest.mockRejectedValue(new Error('Unauthorized'));

      const tool = registeredTools.get('get_instance_info');
      const result = await tool.handler({});

      expect(result.isError).toBe(true);
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error.code).toBe('GET_INSTANCE_INFO_ERROR');
    });
  });

  describe('get_system_limits', () => {
    it('should retrieve system limits successfully', async () => {
      // Mock multiple API calls
      mockApiClient.makeRequest
        .mockResolvedValueOnce({
          success: true,
          data: [
            { id: '10001', key: 'PROJECT1' },
            { id: '10002', key: 'PROJECT2' },
          ],
        })
        .mockResolvedValueOnce({
          success: true,
          // GET /rest/api/3/field returns a `custom` boolean. It has never
          // returned `isCustom`; mocking that name made the broken predicate
          // look correct and is what allowed the miscount to survive review.
          data: [
            { id: 'summary', name: 'Summary', custom: false },
            { id: 'customfield_10001', name: 'Custom Field 1', custom: true },
            { id: 'customfield_10002', name: 'Custom Field 2', custom: true },
          ],
        })
        .mockResolvedValueOnce({
          success: true,
          data: {
            values: [
              { id: { name: 'workflow1' } },
              { id: { name: 'workflow2' } },
              { id: { name: 'workflow3' } },
            ],
          },
        });

      const tool = registeredTools.get('get_system_limits');
      const result = await tool.handler({});

      expect(mockApiClient.makeRequest).toHaveBeenCalledTimes(3);
      expect(mockApiClient.makeRequest).toHaveBeenNthCalledWith(1, {
        method: 'GET',
        path: '/project',
      });
      expect(mockApiClient.makeRequest).toHaveBeenNthCalledWith(2, {
        method: 'GET',
        path: '/field',
      });
      expect(mockApiClient.makeRequest).toHaveBeenNthCalledWith(3, {
        method: 'GET',
        path: '/workflows/search',
      });

      expect(result.isError).toBeUndefined();
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.limits.projects.count).toBe(2);
      expect(response.limits.customFields.count).toBe(2);
      expect(response.limits.workflows.count).toBe(3);
      expect(response.message).toContain('System usage information retrieved');
    });

    it('should handle partial API failures gracefully', async () => {
      // Mock some successful and some failed calls
      mockApiClient.makeRequest
        .mockResolvedValueOnce({
          success: true,
          data: [{ id: '10001', key: 'PROJECT1' }],
        })
        .mockRejectedValueOnce(new Error('Fields API failed'))
        .mockResolvedValueOnce({
          success: true,
          data: { values: [{ id: { name: 'workflow1' } }] },
        });

      const tool = registeredTools.get('get_system_limits');
      const result = await tool.handler({});

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.limits.projects.count).toBe(1);
      expect(response.limits.customFields.count).toBe('unknown');
      expect(response.limits.workflows.count).toBe(1);
    });

    it('should handle projects API returning total count', async () => {
      mockApiClient.makeRequest
        .mockResolvedValueOnce({
          success: true,
          data: { total: 15, projects: [] },
        })
        .mockResolvedValueOnce({
          success: true,
          data: [],
        })
        .mockResolvedValueOnce({
          success: true,
          data: { values: [] },
        });

      const tool = registeredTools.get('get_system_limits');
      const result = await tool.handler({});

      const response = JSON.parse(result.content[0].text);
      expect(response.limits.projects.count).toBe(15);
    });

    it('should handle complete API failures gracefully', async () => {
      // All three API calls will fail, but Promise.allSettled will handle them
      mockApiClient.makeRequest
        .mockRejectedValueOnce(new Error('Projects API failed'))
        .mockRejectedValueOnce(new Error('Fields API failed'))
        .mockRejectedValueOnce(new Error('Workflows API failed'));

      const tool = registeredTools.get('get_system_limits');
      const result = await tool.handler({});

      // Should not error since Promise.allSettled handles failures gracefully
      expect(result.isError).toBeUndefined();
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.limits.projects.count).toBe('unknown');
      expect(response.limits.customFields.count).toBe('unknown');
      expect(response.limits.workflows.count).toBe('unknown');
    });
  });

  describe('create_filter', () => {
    it('should create a basic filter successfully', async () => {
      const mockFilter = {
        id: '10001',
        name: 'My Test Filter',
        jql: 'project = TEST',
        description: 'A test filter for the TEST project',
        favourite: false,
        owner: {
          accountId: 'user123',
          displayName: 'Test User',
        },
        sharePermissions: [],
      };

      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: mockFilter,
      });

      const tool = registeredTools.get('create_filter');
      const result = await tool.handler({
        name: 'My Test Filter',
        jql: 'project = TEST',
        description: 'A test filter for the TEST project',
      });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'POST',
        path: '/filter',
        data: {
          name: 'My Test Filter',
          jql: 'project = TEST',
          description: 'A test filter for the TEST project',
          favourite: false,
        },
      });

      expect(result.isError).toBeUndefined();
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.filter).toEqual(mockFilter);
      expect(response.message).toContain("Filter 'My Test Filter' created successfully with ID 10001");
    });

    it('should create a filter with all optional parameters', async () => {
      const mockFilter = {
        id: '10002',
        name: 'Comprehensive Filter',
        jql: 'project = TEST AND assignee = currentUser()',
        description: 'Filter with all options',
        favourite: true,
        sharePermissions: [
          { type: 'global' },
          { type: 'group', group: { name: 'developers' } },
        ],
      };

      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: mockFilter,
      });

      const tool = registeredTools.get('create_filter');
      const result = await tool.handler({
        name: 'Comprehensive Filter',
        jql: 'project = TEST AND assignee = currentUser()',
        description: 'Filter with all options',
        favourite: true,
        sharePermissions: [
          { type: 'global' },
          { type: 'group', group: { name: 'developers' } },
        ],
      });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'POST',
        path: '/filter',
        data: {
          name: 'Comprehensive Filter',
          jql: 'project = TEST AND assignee = currentUser()',
          description: 'Filter with all options',
          favourite: true,
          sharePermissions: [
            { type: 'global' },
            { type: 'group', group: { name: 'developers' } },
          ],
        },
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.filter.favourite).toBe(true);
      expect(response.filter.sharePermissions).toHaveLength(2);
    });

    it('should create filter with minimal parameters', async () => {
      const mockFilter = {
        id: '10003',
        name: 'Minimal Filter',
        jql: 'assignee = currentUser()',
        favourite: false,
        sharePermissions: [],
      };

      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: mockFilter,
      });

      const tool = registeredTools.get('create_filter');
      const result = await tool.handler({
        name: 'Minimal Filter',
        jql: 'assignee = currentUser()',
      });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'POST',
        path: '/filter',
        data: {
          name: 'Minimal Filter',
          jql: 'assignee = currentUser()',
          favourite: false,
        },
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
    });

    it('should create filter with different share permission types', async () => {
      const mockFilter = {
        id: '10004',
        name: 'Shared Filter',
        jql: 'project in (TEST, DEMO)',
        sharePermissions: [
          { type: 'project', project: { id: '10001', key: 'TEST' } },
          { type: 'user', user: { accountId: 'user456' } },
          { type: 'authenticated' },
        ],
      };

      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: mockFilter,
      });

      const tool = registeredTools.get('create_filter');
      const result = await tool.handler({
        name: 'Shared Filter',
        jql: 'project in (TEST, DEMO)',
        sharePermissions: [
          { type: 'project', project: { id: '10001', key: 'TEST' } },
          { type: 'user', user: { accountId: 'user456' } },
          { type: 'authenticated' },
        ],
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.filter.sharePermissions).toHaveLength(3);
      expect(response.filter.sharePermissions[0].type).toBe('project');
      expect(response.filter.sharePermissions[1].type).toBe('user');
      expect(response.filter.sharePermissions[2].type).toBe('authenticated');
    });

    it('should handle empty description explicitly set', async () => {
      const mockFilter = {
        id: '10005',
        name: 'No Description Filter',
        jql: 'project = TEST',
        description: '',
      };

      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: mockFilter,
      });

      const tool = registeredTools.get('create_filter');
      const result = await tool.handler({
        name: 'No Description Filter',
        jql: 'project = TEST',
        description: '',
      });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'POST',
        path: '/filter',
        data: {
          name: 'No Description Filter',
          jql: 'project = TEST',
          description: '',
          favourite: false,
        },
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
    });

    it('should handle filter creation errors', async () => {
      mockApiClient.makeRequest.mockRejectedValue(new Error('Invalid JQL syntax'));

      const tool = registeredTools.get('create_filter');
      const result = await tool.handler({
        name: 'Invalid Filter',
        jql: 'invalid jql syntax here',
      });

      expect(result.isError).toBe(true);
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error.code).toBe('CREATE_FILTER_ERROR');
      expect(response.error.suggestion).toContain('Check your JQL syntax and ensure you have filter creation permissions');
    });

    it('should validate filter name length', async () => {
      const tool = registeredTools.get('create_filter');
      const result = await tool.handler({
        name: '', // Empty name should fail validation
        jql: 'project = TEST',
      });

      expect(result.isError).toBe(true);
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
    });

    it('should validate share permission types', async () => {
      const tool = registeredTools.get('create_filter');
      const result = await tool.handler({
        name: 'Test Filter',
        jql: 'project = TEST',
        sharePermissions: [
          { type: 'invalid_type' as any },
        ],
      });

      expect(result.isError).toBe(true);
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
    });
  });

  describe('input validation', () => {
    it('should validate audit records limit', async () => {
      const tool = registeredTools.get('get_audit_records');
      const result = await tool.handler({
        limit: 1001, // Exceeds maximum
      });

      expect(result.isError).toBe(true);
    });

    it('should handle negative offset for audit records', async () => {
      const tool = registeredTools.get('get_audit_records');
      const result = await tool.handler({
        offset: -1,
      });

      expect(result.isError).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty audit records', async () => {
      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: {
          records: [],
          total: 0,
          offset: 0,
          limit: 100,
        },
      });

      const tool = registeredTools.get('get_audit_records');
      const result = await tool.handler({});

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.records).toEqual([]);
      expect(response.total).toBe(0);
    });

    it('should handle filter creation with empty sharePermissions array', async () => {
      const mockFilter = {
        id: '10006',
        name: 'Filter with Empty Permissions',
        jql: 'project = TEST',
        sharePermissions: [],
      };

      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: mockFilter,
      });

      const tool = registeredTools.get('create_filter');
      const result = await tool.handler({
        name: 'Filter with Empty Permissions',
        jql: 'project = TEST',
        sharePermissions: [],
      });

      // Should not include sharePermissions in the request data when empty
      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'POST',
        path: '/filter',
        data: {
          name: 'Filter with Empty Permissions',
          jql: 'project = TEST',
          favourite: false,
        },
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
    });
  });
});