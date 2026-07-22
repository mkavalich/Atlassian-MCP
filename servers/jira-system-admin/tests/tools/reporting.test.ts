import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { JiraApiClient } from '../../src/api/client.js';
import { registerReportingTools, __usersPagination } from '../../src/tools/reporting.js';

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

/**
 * /users/search pagination.
 *
 * CANNOT be validated against the live instance: it has 55 accounts and the
 * previous single request asked for 1000, so the pagination path never executes
 * there. Any "verified working" claim from live probing would exercise zero new
 * code. These are mocked deliberately.
 */
describe('users/search bounded pagination', () => {
  const { fetchAllUsers, USERS_PAGE_SIZE, USERS_MAX_PAGES } = __usersPagination;

  const page = (n: number) => Array.from({ length: n }, (_, i) => ({ accountId: `a${i}`, active: true }));

  it('walks every page and stops on the empty page', async () => {
    const starts: number[] = [];
    const result = await fetchAllUsers(async (startAt: number) => {
      starts.push(startAt);
      if (startAt === 0) return { data: page(USERS_PAGE_SIZE) };
      if (startAt === USERS_PAGE_SIZE) return { data: page(USERS_PAGE_SIZE) };
      if (startAt === USERS_PAGE_SIZE * 2) return { data: page(55) };
      return { data: [] };
    });

    // The walk advances by rows RECEIVED, so after the 55-row final page the
    // next (empty) probe is at offset 455, not the stride-aligned 600. Under the
    // old fixed-stride code this asserted [0, 200, 400, 600]; that passed only
    // because this scenario's short page was the LAST one, so the stride skip
    // lost nothing. The contiguous offsets are the correct characterization.
    expect(result!.rows.length).toBe(USERS_PAGE_SIZE * 2 + 55);
    expect(starts).toEqual([0, 200, 400, 455]);
    expect(result!.truncated).toBe(false);
    expect(result!.partialFailure).toBe(false);
  });

  it('does not treat a short page as the end of the data', async () => {
    // A short-but-non-final page must not terminate the walk, AND the walk must
    // resume at a contiguous offset. The mock only has data at offsets 0 and 7;
    // fixed-stride code would probe offset 200 after the 7-row page, get [], and
    // stop at 7 rows -- skipping rows 7..9 silently while reporting truncated:false.
    const starts: number[] = [];
    const result = await fetchAllUsers(async (startAt: number) => {
      starts.push(startAt);
      if (startAt === 0) return { data: page(7) };
      if (startAt === 7) return { data: page(3) };
      return { data: [] };
    });

    expect(result!.rows.length).toBe(10);
    expect(starts).toEqual([0, 7, 10]);
    expect(result!.truncated).toBe(false);
    expect(result!.partialFailure).toBe(false);
  });

  it('flags truncation instead of stopping silently at the page cap', async () => {
    const result = await fetchAllUsers(async () => ({ data: page(USERS_PAGE_SIZE) }));

    expect(result!.truncated).toBe(true);
    expect(result!.partialFailure).toBe(true);
    expect(result!.rows.length).toBe(USERS_PAGE_SIZE * USERS_MAX_PAGES);
  });

  it('marks a mid-walk failure partial rather than returning a complete-looking prefix', async () => {
    const result = await fetchAllUsers(async (startAt: number) => {
      if (startAt === 0) return { data: page(USERS_PAGE_SIZE) };
      throw new Error('boom');
    });

    // The prefix is returned, but never as a finished count.
    expect(result!.rows.length).toBe(USERS_PAGE_SIZE);
    expect(result!.partialFailure).toBe(true);
  });

  it('returns null - not an empty array - when the first page fails', async () => {
    const result = await fetchAllUsers(async () => { throw new Error('boom'); });
    expect(result).toBeNull();
  });

  it('returns null for a non-array body rather than reporting zero users', async () => {
    const result = await fetchAllUsers(async () => ({ data: { notAnArray: true } }));
    expect(result).toBeNull();
  });
});