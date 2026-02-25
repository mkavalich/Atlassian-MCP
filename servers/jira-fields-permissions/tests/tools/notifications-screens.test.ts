import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerNotificationScreenTools } from '../../src/tools/notifications-screens.js';
import { JiraApiClient } from '../../src/api/client.js';

// Mock the API client
jest.mock('../../src/api/client.js');

describe('Notification Screen Tools', () => {
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
    registerNotificationScreenTools(server, mockApiClient);
  });

  describe('get_notification_schemes', () => {
    it('should retrieve all notification schemes successfully', async () => {
      const mockSchemes = [
        {
          id: '10000',
          name: 'Default Notification Scheme',
          description: 'Default scheme for all projects',
          notificationSchemeEvents: [
            {
              event: { id: '1', name: 'Issue Created' },
              notifications: [
                { type: 'Reporter' },
                { type: 'CurrentAssignee' },
              ],
            },
          ],
        },
        {
          id: '10001',
          name: 'Custom Notification Scheme',
          description: 'Custom scheme for specific projects',
          notificationSchemeEvents: [
            {
              event: { id: '2', name: 'Issue Updated' },
              notifications: [
                { type: 'ProjectLead' },
                { type: 'User', parameter: 'user123' },
              ],
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

      const tool = registeredTools.get('get_notification_schemes');
      expect(tool).toBeDefined();

      const result = await tool.handler({
        startAt: 0,
        maxResults: 50,
      });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        path: '/notificationscheme',
        params: undefined,
      });

      expect(result.content[0].text).toContain('"success": true');
      expect(result.content[0].text).toContain('"notificationSchemes"');
      expect(result.content[0].text).toContain('Default Notification Scheme');
      expect(result.content[0].text).toContain('Custom Notification Scheme');
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

      const tool = registeredTools.get('get_notification_schemes');
      const result = await tool.handler({
        startAt: 10,
        maxResults: 25,
        expand: 'notificationSchemeEvents',
      });

      expect(result.content[0].text).toContain('"success": true');
      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        path: '/notificationscheme',
        params: {
          startAt: 10,
          maxResults: 25,
          expand: 'notificationSchemeEvents',
        },
      });
    });

    it('should handle API errors gracefully', async () => {
      mockApiClient.makeRequest.mockResolvedValue({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Insufficient permissions',
        },
      });

      const tool = registeredTools.get('get_notification_schemes');
      const result = await tool.handler({
        startAt: 0,
        maxResults: 50,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('"success": false');
      expect(result.content[0].text).toContain('GET_NOTIFICATION_SCHEMES_ERROR');
    });

    it('should validate input parameters using Zod schema', async () => {
      const tool = registeredTools.get('get_notification_schemes');
      const result = await tool.handler({
        startAt: -1, // Invalid value
        maxResults: 200, // Exceeds maximum
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('"success": false');
    });
  });

  describe('create_notification_scheme', () => {
    it('should create a notification scheme successfully', async () => {
      const mockCreatedScheme = {
        id: '10002',
        name: 'New Test Scheme',
        description: 'A test notification scheme',
        notificationSchemeEvents: [
          {
            event: { id: '1', name: 'Issue Created' },
            notifications: [
              { type: 'Reporter' },
              { type: 'CurrentAssignee' },
            ],
          },
        ],
      };

      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: mockCreatedScheme,
      });

      const tool = registeredTools.get('create_notification_scheme');
      expect(tool).toBeDefined();

      const result = await tool.handler({
        name: 'New Test Scheme',
        description: 'A test notification scheme',
        notificationSchemeEvents: [
          {
            event: { id: '1' },
            notifications: [
              { type: 'Reporter' },
              { type: 'CurrentAssignee' },
            ],
          },
        ],
      });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'POST',
        path: '/notificationscheme',
        data: {
          name: 'New Test Scheme',
          description: 'A test notification scheme',
          notificationSchemeEvents: [
            {
              event: { id: '1' },
              notifications: [
                { type: 'Reporter' },
                { type: 'CurrentAssignee' },
              ],
            },
          ],
        },
      });

      expect(result.content[0].text).toContain('"success": true');
      expect(result.content[0].text).toContain('"notificationScheme"');
      expect(result.content[0].text).toContain('New Test Scheme');
      expect(result.content[0].text).toContain('created successfully');
    });

    it('should handle creation without optional fields', async () => {
      const mockCreatedScheme = {
        id: '10003',
        name: 'Minimal Scheme',
      };

      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: mockCreatedScheme,
      });

      const tool = registeredTools.get('create_notification_scheme');
      const result = await tool.handler({
        name: 'Minimal Scheme',
      });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'POST',
        path: '/notificationscheme',
        data: {
          name: 'Minimal Scheme',
        },
      });

      expect(result.content[0].text).toContain('"success": true');
    });

    it('should handle API errors gracefully', async () => {
      mockApiClient.makeRequest.mockResolvedValue({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid notification scheme configuration',
        },
      });

      const tool = registeredTools.get('create_notification_scheme');
      const result = await tool.handler({
        name: 'Invalid Scheme',
        notificationSchemeEvents: [],
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('"success": false');
      expect(result.content[0].text).toContain('CREATE_NOTIFICATION_SCHEME_ERROR');
    });
  });

  describe('get_notification_screens', () => {
    it('should retrieve all screens successfully', async () => {
      const mockScreens = [
        {
          id: '10000',
          name: 'Default Screen',
          description: 'Default screen for all projects',
          tabs: [
            {
              id: '10000',
              name: 'Field Tab',
              fields: [
                { id: 'summary', name: 'Summary' },
                { id: 'description', name: 'Description' },
              ],
            },
          ],
        },
        {
          id: '10001',
          name: 'Bug Report Screen',
          description: 'Screen for bug reports',
          tabs: [
            {
              id: '10001',
              name: 'Details',
              fields: [
                { id: 'priority', name: 'Priority' },
                { id: 'components', name: 'Components' },
              ],
            },
          ],
        },
      ];

      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: {
          values: mockScreens,
          total: 2,
          startAt: 0,
          maxResults: 50,
        },
      });

      const tool = registeredTools.get('get_notification_screens');
      expect(tool).toBeDefined();

      const result = await tool.handler({
        startAt: 0,
        maxResults: 50,
      });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        path: '/screens',
        params: undefined,
      });

      expect(result.content[0].text).toContain('"success": true');
      expect(result.content[0].text).toContain('"screens"');
      expect(result.content[0].text).toContain('Default Screen');
      expect(result.content[0].text).toContain('Bug Report Screen');
    });

    it('should handle expand parameter correctly', async () => {
      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: {
          values: [],
          total: 0,
          startAt: 0,
          maxResults: 50,
        },
      });

      const tool = registeredTools.get('get_notification_screens');
      const result = await tool.handler({
        expand: 'tabs',
      });

      expect(result.content[0].text).toContain('"success": true');
      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        path: '/screens',
        params: {
          expand: 'tabs',
        },
      });
    });

    it('should handle API errors gracefully', async () => {
      mockApiClient.makeRequest.mockResolvedValue({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied',
        },
      });

      const tool = registeredTools.get('get_notification_screens');
      const result = await tool.handler({});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('"success": false');
      expect(result.content[0].text).toContain('GET_SCREENS_ERROR');
    });
  });

  describe('create_notification_screen', () => {
    it('should create a screen successfully', async () => {
      const mockCreatedScreen = {
        id: '10002',
        name: 'New Test Screen',
        description: 'A test screen',
        tabs: [
          {
            id: '10002',
            name: 'Main Tab',
            fields: [
              { id: 'summary', name: 'Summary' },
            ],
          },
        ],
      };

      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: mockCreatedScreen,
      });

      const tool = registeredTools.get('create_notification_screen');
      expect(tool).toBeDefined();

      const result = await tool.handler({
        name: 'New Test Screen',
        description: 'A test screen',
        tabs: [
          {
            name: 'Main Tab',
            fields: [
              { id: 'summary' },
            ],
          },
        ],
      });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'POST',
        path: '/screens',
        data: {
          name: 'New Test Screen',
          description: 'A test screen',
          tabs: [
            {
              name: 'Main Tab',
              fields: [
                { id: 'summary' },
              ],
            },
          ],
        },
      });

      expect(result.content[0].text).toContain('"success": true');
      expect(result.content[0].text).toContain('"screen"');
      expect(result.content[0].text).toContain('New Test Screen');
      expect(result.content[0].text).toContain('created successfully');
    });

    it('should handle creation without optional fields', async () => {
      const mockCreatedScreen = {
        id: '10003',
        name: 'Minimal Screen',
      };

      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: mockCreatedScreen,
      });

      const tool = registeredTools.get('create_notification_screen');
      const result = await tool.handler({
        name: 'Minimal Screen',
      });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'POST',
        path: '/screens',
        data: {
          name: 'Minimal Screen',
        },
      });

      expect(result.content[0].text).toContain('"success": true');
    });

    it('should handle API errors gracefully', async () => {
      mockApiClient.makeRequest.mockResolvedValue({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid screen configuration',
        },
      });

      const tool = registeredTools.get('create_notification_screen');
      const result = await tool.handler({
        name: 'Invalid Screen',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('"success": false');
      expect(result.content[0].text).toContain('CREATE_SCREEN_ERROR');
    });
  });

  describe('add_field_to_notification_screen', () => {
    it('should add field to screen successfully', async () => {
      mockApiClient.makeRequest.mockResolvedValue({
        success: true,
        data: { id: 'customfield_10000', name: 'Custom Field' },
      });

      const tool = registeredTools.get('add_field_to_notification_screen');
      expect(tool).toBeDefined();

      const result = await tool.handler({
        screenId: '10000',
        tabId: '10001',
        fieldId: 'customfield_10000',
      });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'POST',
        path: '/screens/10000/tabs/10001/fields',
        data: {
          fieldId: 'customfield_10000',
        },
      });

      expect(result.content[0].text).toContain('"success": true');
      expect(result.content[0].text).toContain('Field customfield_10000 added to screen 10000 tab 10001 successfully');
    });

    it('should handle API errors gracefully', async () => {
      mockApiClient.makeRequest.mockResolvedValue({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Screen or field not found',
        },
      });

      const tool = registeredTools.get('add_field_to_notification_screen');
      const result = await tool.handler({
        screenId: 'invalid',
        tabId: 'invalid',
        fieldId: 'invalid',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('"success": false');
      expect(result.content[0].text).toContain('ADD_FIELD_TO_SCREEN_ERROR');
    });

    it('should validate required parameters', async () => {
      const tool = registeredTools.get('add_field_to_notification_screen');
      const result = await tool.handler({
        screenId: '',
        tabId: '',
        fieldId: '',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('"success": false');
    });
  });

  it('should register all expected tools', () => {
    expect(registeredTools.has('get_notification_schemes')).toBe(true);
    expect(registeredTools.has('create_notification_scheme')).toBe(true);
    expect(registeredTools.has('get_notification_screens')).toBe(true);
    expect(registeredTools.has('create_notification_screen')).toBe(true);
    expect(registeredTools.has('add_field_to_notification_screen')).toBe(true);
    expect(registeredTools.size).toBe(5);
  });
});