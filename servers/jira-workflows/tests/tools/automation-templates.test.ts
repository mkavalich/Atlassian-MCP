import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAutomationTools } from '../../src/tools/automation.js';
import { JiraApiClient } from '../../src/api/client.js';

jest.mock('../../src/api/client.js');

/**
 * PASS A item 1: get_automation_templates advertised two parameters it did not
 * honour.
 *
 * Verified live against GET /template/search on the dev instance:
 *   - full catalogue walk: 281 templates over 6 pages, {links, data}
 *   - limit=5 and limit=5&startAt=25 return BYTE-IDENTICAL rows -> the API
 *     ignores startAt. The tool never forwarded it either, and .default(0) made
 *     it always-defined, so startAt:25 validated and vanished.
 *   - category=<real key>, category=zzz-nope and bogusParam=1 all return the
 *     identical 281-id list -> `category` is inert; the tool forwarded it, got
 *     200, and returned the whole catalogue as if filtered.
 *   - categories=<key> returns 39 of 281, exactly the client-side match set
 *     -> `categories` (plural, key form) is the real filter.
 *   - categories[]=<key> (what axios emits for an ARRAY, since this client sets
 *     no paramsSerializer) returns 50 unfiltered rows under 200 -> arrays must
 *     be rejected, not passed through.
 *
 * Cases marked PROOF fail against the unfixed source. Cases marked GUARD pass
 * before and after and exist as regression cover.
 */
describe('get_automation_templates (item 1)', () => {
  let server: McpServer;
  let mockApiClient: jest.Mocked<JiraApiClient>;
  let registeredTools: Map<string, any>;

  const page = (n: number, next: string | null = null) => ({
    success: true,
    data: {
      links: { self: null, next, prev: null },
      data: Array.from({ length: n }, (_, i) => ({
        id: `template_${i}`,
        name: `Template ${i}`,
        categories: [{ key: 'jira.rovo', displayName: 'Rovo AI Agents' }],
      })),
    },
  });

  const call = async (args: Record<string, unknown> = {}) => {
    const entry = registeredTools.get('get_automation_templates');
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

  it('PROOF: startAt is rejected loudly instead of silently discarded', async () => {
    mockApiClient.makeAutomationRequest.mockResolvedValue(page(50) as any);

    const { payload } = await call({ startAt: 25 });

    expect(payload.success).toBe(false);
    expect(payload.error).toContain('startAt');
    expect(payload.error).toContain('cursor');
    // The request must not have been issued at all.
    expect(mockApiClient.makeAutomationRequest).not.toHaveBeenCalled();
  });

  it('PROOF: category is rejected and names the working alternative', async () => {
    mockApiClient.makeAutomationRequest.mockResolvedValue(page(50) as any);

    const { payload } = await call({ category: 'jira.rovo' });

    expect(payload.success).toBe(false);
    expect(payload.error).toContain('categories');
    expect(mockApiClient.makeAutomationRequest).not.toHaveBeenCalled();
  });

  // LAYER NOTE, verified live and stated so this test is not read as more than
  // it proves: this asserts the HANDLER's behaviour. Over a real MCP call the
  // SDK validates against the ADVERTISED input schema first, where `categories`
  // is z.string(), so an array is rejected there with the generic
  // "Expected string, received array" and never reaches this refinement. That
  // is still a loud rejection -- no silent wrong answer -- but the actionable
  // message below is only delivered on the direct-handler path. The advertised
  // schema is deliberately NOT widened to accept arrays, because it must not
  // advertise a shape the tool always rejects.
  it('PROOF: an array of categories is rejected with a specific message', async () => {
    mockApiClient.makeAutomationRequest.mockResolvedValue(page(50) as any);

    const { payload } = await call({ categories: ['jira.rovo', 'jira.design'] });

    expect(payload.success).toBe(false);
    // Not the generic zod "Expected string, received array" -- the actionable one.
    expect(payload.error).toMatch(/single category key|repeated query parameter/i);
    expect(mockApiClient.makeAutomationRequest).not.toHaveBeenCalled();
  });

  it('PROOF: a single category key is forwarded as the plural scalar param', async () => {
    mockApiClient.makeAutomationRequest.mockResolvedValue(page(39) as any);

    const { payload } = await call({ categories: 'jira.rovo' });

    expect(payload.success).toBe(true);
    const sent = (mockApiClient.makeAutomationRequest as any).mock.calls[0][0];
    expect(sent.params.categories).toBe('jira.rovo');
    // The string assertion is load-bearing: if someone later "improves" this to
    // an array, axios emits categories[]= and the API silently returns
    // unfiltered rows under 200.
    expect(typeof sent.params.categories).toBe('string');
    expect(sent.params.category).toBeUndefined();
    expect(payload.count).toBe(39);
    expect(payload.categoryKeyRecognized).toBe(true);
  });

  it('PROOF: cursor is forwarded', async () => {
    mockApiClient.makeAutomationRequest.mockResolvedValue(page(3) as any);

    await call({ cursor: 'opaque-token' });

    const sent = (mockApiClient.makeAutomationRequest as any).mock.calls[0][0];
    expect(sent.params.cursor).toBe('opaque-token');
  });

  it('PROOF: an empty filtered result is flagged as ambiguous, not a confident zero', async () => {
    mockApiClient.makeAutomationRequest.mockResolvedValue(page(0) as any);

    const { payload } = await call({ categories: 'zzz-not-a-category' });

    expect(payload.success).toBe(true);
    expect(payload.count).toBe(0);
    // count 0 alone cannot distinguish "unknown key" from "known but empty".
    expect(payload.categoryKeyRecognized).toBeNull();
    expect(payload.usage_guidance).toMatch(/AMBIGUOUS/);
  });

  it('GUARD: unfiltered calls carry no category verdict fields', async () => {
    mockApiClient.makeAutomationRequest.mockResolvedValue(page(0) as any);

    const { payload } = await call({});

    expect(payload.success).toBe(true);
    expect(payload.count).toBe(0);
    expect('categoryKeyRecognized' in payload).toBe(false);
  });

  it('GUARD: maxResults still maps to limit, and no total is fabricated', async () => {
    mockApiClient.makeAutomationRequest.mockResolvedValue(page(5, null) as any);

    const { payload } = await call({ maxResults: 5 });

    const sent = (mockApiClient.makeAutomationRequest as any).mock.calls[0][0];
    expect(sent.params.limit).toBe(5);
    expect(sent.params.startAt).toBeUndefined();
    expect(payload.count).toBe(5);
    expect('total' in payload).toBe(false);
    expect(payload.hasMore).toBe(false);
  });

  it('GUARD: hasMore and nextCursor are reported when the API pages', async () => {
    mockApiClient.makeAutomationRequest.mockResolvedValue(page(50, '?cursor=abc&limit=50') as any);

    const { payload } = await call({});

    expect(payload.hasMore).toBe(true);
    expect(payload.nextCursor).toBe('abc');
  });

  it('GUARD: a non-array data key still fails loudly rather than reporting empty', async () => {
    mockApiClient.makeAutomationRequest.mockResolvedValue({
      success: true,
      data: { links: {}, data: 'not-an-array' },
    } as any);

    const { payload } = await call({});

    expect(payload.success).toBe(false);
    expect(payload.partialFailure).toBe(true);
    expect(payload.count).toBeNull();
  });
});
