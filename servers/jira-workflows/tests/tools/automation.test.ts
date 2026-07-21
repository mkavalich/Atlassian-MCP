import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAutomationTools, extractCursor } from '../../src/tools/automation.js';
import { JiraApiClient } from '../../src/api/client.js';
import { mapAtlassianError } from '../../src/utils/errors.js';

jest.mock('../../src/api/client.js');

/**
 * Truthfulness regressions for the Jira Automation tools.
 *
 * Verified against the live Automation API:
 *   GET /rule            -> HTTP 404, zero-byte body (no listing-with-details)
 *   GET /rule/summary    -> 200, {links, data}; honours ONLY `limit` + `cursor`
 *   GET /template/search -> 200, {links, data}  (NOT {values, total})
 * Passing enabled/name/authorAccountId/a nonsense param returns the
 * byte-identical full rule set, so they are inert rather than filtering.
 */
describe('Automation tools', () => {
  let server: McpServer;
  let mockApiClient: jest.Mocked<JiraApiClient>;
  let registeredTools: Map<string, any>;

  const ruleRows = [
    { uuid: '019c6bed-0001-0000-0000-000000000001', name: 'Rule A', state: 'DISABLED', authorAccountId: 'acc1', created: 1771337000000 },
    { uuid: '019c6bed-0002-0000-0000-000000000002', name: 'Rule B', state: 'ENABLED', authorAccountId: 'acc1', created: 1771337000001 },
  ];

  const call = async (tool: string, args: Record<string, unknown> = {}) => {
    const entry = registeredTools.get(tool);
    expect(entry).toBeDefined();
    const result = await entry.handler(args);
    return { result, payload: JSON.parse(result.content[0].text) };
  };

  beforeEach(() => {
    registeredTools = new Map();
    server = {
      registerTool: jest.fn((name: string, schema: any, handler: any) => {
        registeredTools.set(name, { schema, handler });
      }),
    } as any;
    mockApiClient = { makeAutomationRequest: jest.fn(), makeRequest: jest.fn() } as any;
    registerAutomationTools(server, mockApiClient);
  });

  describe('get_automation_rules', () => {
    it('emits no fabricated `total`', async () => {
      mockApiClient.makeAutomationRequest.mockResolvedValue({
        success: true,
        data: { data: ruleRows, links: { next: null } },
      } as any);

      const { payload } = await call('get_automation_rules');

      // Unfixed: total = rules.length, i.e. the page length presented as the
      // size of the whole rule set. The API returns no total at all.
      expect('total' in payload).toBe(false);
      expect(payload.count).toBe(2);
    });

    it('derives hasMore and nextCursor from links.next', async () => {
      mockApiClient.makeAutomationRequest.mockResolvedValue({
        success: true,
        data: { data: ruleRows, links: { next: '?cursor=OPAQUE123&limit=2' } },
      } as any);

      const { payload } = await call('get_automation_rules', { limit: 2 });

      // Unfixed: hasMore was `total > startAt + rules.length`, which reduces to
      // `n > 0 + n` -- structurally false for every permitted input.
      expect(payload.hasMore).toBe(true);
      expect(payload.nextCursor).toBe('OPAQUE123');
    });

    it('reports hasMore false when there is no next link', async () => {
      mockApiClient.makeAutomationRequest.mockResolvedValue({
        success: true,
        data: { data: ruleRows, links: { next: null } },
      } as any);

      const { payload } = await call('get_automation_rules');
      expect(payload.hasMore).toBe(false);
      expect(payload.nextCursor).toBeNull();
    });

    it('forwards only limit and cursor to the API', async () => {
      mockApiClient.makeAutomationRequest.mockResolvedValue({
        success: true,
        data: { data: ruleRows, links: {} },
      } as any);

      await call('get_automation_rules', { limit: 3, cursor: 'ABC' });

      expect(mockApiClient.makeAutomationRequest).toHaveBeenCalledWith({
        method: 'GET',
        path: '/rule/summary',
        params: { limit: 3, cursor: 'ABC' },
      });
    });

    it('rejects includeDetails loudly and issues no request to /rule', async () => {
      const { result } = await call('get_automation_rules', { includeDetails: true });

      const text = result.content[0].text;
      expect(text).toContain('get_automation_rule_details');
      // Unfixed: this issued GET /rule, which 404s with an empty body.
      expect(mockApiClient.makeAutomationRequest).not.toHaveBeenCalled();
    });

    it('rejects server-side filters the API silently ignores', async () => {
      for (const bad of [{ name: 'x' }, { enabled: true }, { authorAccountId: 'a' }, { projects: ['1'] }]) {
        mockApiClient.makeAutomationRequest.mockClear();
        const { result } = await call('get_automation_rules', bad);
        const text = result.content[0].text;
        expect(text).toMatch(/does not support|not supported/i);
        // Unfixed: forwarded the filter and returned the FULL set as success:true.
        expect(mockApiClient.makeAutomationRequest).not.toHaveBeenCalled();
      }
    });
  });

  describe('get_automation_templates', () => {
    it('reads the `data` key the API actually returns', async () => {
      const templates = Array.from({ length: 50 }, (_, i) => ({ id: `t_${i}`, description: `T${i}` }));
      mockApiClient.makeAutomationRequest.mockResolvedValue({
        success: true,
        data: { data: templates, links: { next: '?cursor=NEXT50&limit=50' } },
      } as any);

      const { payload } = await call('get_automation_templates', {});

      // Unfixed: read `.values` -> undefined -> `|| []` -> count:0, total:0,
      // hasMore:false against 50 real templates, under success:true.
      expect(payload.count).toBe(50);
      expect(payload.hasMore).toBe(true);
      expect(payload.nextCursor).toBe('NEXT50');
      expect('total' in payload).toBe(false);
    });

    it('fails loudly rather than reporting an empty catalogue on an unexpected shape', async () => {
      mockApiClient.makeAutomationRequest.mockResolvedValue({
        success: true,
        data: { unexpected: true },
      } as any);

      const { result, payload } = await call('get_automation_templates', {});

      expect(result.isError).toBe(true);
      expect(payload.success).toBe(false);
      expect(payload.templates).toBeNull();
      expect(payload.count).not.toBe(0);
    });
  });

  describe('extractCursor', () => {
    it('pulls the cursor out of a links.next value', () => {
      expect(extractCursor('?cursor=ABC%3D&limit=50')).toBe('ABC=');
    });

    it('returns null for absent or malformed links', () => {
      expect(extractCursor(null)).toBeNull();
      expect(extractCursor(undefined)).toBeNull();
      expect(extractCursor('?limit=50')).toBeNull();
    });
  });
});

describe('mapAtlassianError 404 handling', () => {
  it('does not put the error message in the identifier slot', () => {
    // Every Automation 404 has a zero-byte body, so this path is always taken.
    const err = mapAtlassianError(404, undefined) as any;
    expect(err.message).not.toContain("identifier 'Resource not found'");
    expect(err.message).not.toContain("identifier 'Unknown error'");
  });

  it('still names the real identifier when one is supplied', () => {
    const err = mapAtlassianError(404, { errorMessages: ['The rule was not found.'] }) as any;
    expect(err.message).toContain('The rule was not found.');
  });
});
