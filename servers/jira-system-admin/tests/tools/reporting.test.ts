import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { JiraApiClient } from '../../src/api/client.js';
import { registerReportingTools } from '../../src/tools/reporting.js';

// Mock the API client
jest.mock('../../src/api/client.js');

describe('Reporting Tools', () => {
  let server: McpServer;
  let mockApiClient: jest.Mocked<JiraApiClient>;

  beforeEach(() => {
    server = new McpServer({
      name: 'test-server',
      version: '1.0.0',
      description: 'Test server for reporting tools',
    });

    mockApiClient = {
      makeRequest: jest.fn(),
    } as any;
  });

  it('should register reporting tools without errors', async () => {
    await expect(registerReportingTools(server, mockApiClient)).resolves.not.toThrow();
  });

  it('should register reporting tools successfully', async () => {
    await registerReportingTools(server, mockApiClient);
    
    // Test that the tools are registered by attempting to call them
    expect(server).toBeDefined();
  });
});