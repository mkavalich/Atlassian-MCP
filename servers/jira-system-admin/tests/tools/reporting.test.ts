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

/**
 * Custom-field counting in reporting tools.
 *
 * Both sites below consume GET /rest/api/3/field, which returns a `custom`
 * boolean and no `isCustom`. The previous predicates read `isCustom`, so they
 * always matched nothing; `|| 0` and `: 0` then rendered that as a genuine zero.
 */
describe('Reporting Tools - custom field truthfulness', () => {
  let mockApiClient: jest.Mocked<JiraApiClient>;
  let registeredTools: Map<string, any>;

  const fieldRows = [
    { id: 'summary', name: 'Summary', custom: false },
    { id: 'customfield_10001', name: 'A', custom: true },
    { id: 'customfield_10002', name: 'B', custom: true },
    { id: 'customfield_10003', name: 'C', custom: true },
    { id: 'assignee', name: 'Assignee', custom: false },
  ];

  beforeEach(async () => {
    registeredTools = new Map();
    const captureServer = {
      registerTool: jest.fn((name: string, schema: any, handler: any) => {
        registeredTools.set(name, { schema, handler });
      }),
    } as any;
    mockApiClient = { makeRequest: jest.fn() } as any;
    await registerReportingTools(captureServer, mockApiClient);
  });

  describe('generate_health_check_report', () => {
    it('counts custom fields from the `custom` boolean', async () => {
      mockApiClient.makeRequest.mockImplementation(async (cfg: any) => {
        if (cfg.path === '/field') return { success: true, data: fieldRows } as any;
        if (cfg.path === '/project') return { success: true, data: [{ id: '1' }, { id: '2' }] } as any;
        return { success: true, data: {} } as any;
      });

      const tool = registeredTools.get('generate_health_check_report');
      const payload = JSON.parse(
        (await tool.handler({ checkLevel: 'comprehensive' })).content[0].text
      );

      const perf = payload.healthCheck.results.performance;
      // Unfixed: filter(f => f.isCustom).length || 0 -> 0
      expect(perf.metrics.customFieldCount).toBe(3);
      expect(perf.status).toBe('healthy');
    });

    it('reports an unavailable count as null, not zero, and refuses to claim healthy', async () => {
      mockApiClient.makeRequest.mockImplementation(async (cfg: any) => {
        if (cfg.path === '/field') return { success: false, data: undefined } as any;
        if (cfg.path === '/project') return { success: true, data: [{ id: '1' }] } as any;
        return { success: true, data: {} } as any;
      });

      const tool = registeredTools.get('generate_health_check_report');
      const payload = JSON.parse(
        (await tool.handler({ checkLevel: 'comprehensive' })).content[0].text
      );

      const perf = payload.healthCheck.results.performance;
      // The key must be PRESENT and explicitly null. `undefined` would be
      // dropped by JSON.stringify, and 0 would be a fabricated count.
      expect('customFieldCount' in perf.metrics).toBe(true);
      expect(perf.metrics.customFieldCount).toBeNull();
      expect(perf.metrics.customFieldCount).not.toBe(0);
      expect(perf.status).not.toBe('healthy');
      expect(perf.partialFailure).toBe(true);
    });
  });

  describe('export_project_data', () => {
    it('reports project-scoped custom fields as unobtainable instead of an empty list', async () => {
      mockApiClient.makeRequest.mockImplementation(async (cfg: any) => {
        if (cfg.path === '/field') return { success: true, data: fieldRows } as any;
        if (cfg.path.startsWith('/project/')) {
          return { success: true, data: { id: '10001', key: 'TEST', name: 'Test' } } as any;
        }
        return { success: true, data: {} } as any;
      });

      const tool = registeredTools.get('export_project_data');
      const payload = JSON.parse(
        (await tool.handler({
          projectKey: 'TEST',
          includeIssues: false,
          includeWorkflows: false,
          includePermissions: false,
          includeCustomFields: true,
        })).content[0].text
      );

      // Unfixed: customFields === [] with success:true and no partialFailure --
      // indistinguishable from a project that genuinely has none.
      expect(payload.exportData.customFields).toBeNull();
      expect(payload.exportData.customFields).not.toEqual([]);
      expect(payload.exportData.partialFailure).toBe(true);
      expect(payload.exportData.notes.join(' ')).toContain('projectmapping');
    });
  });
});