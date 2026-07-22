import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerScreenTools } from '../../src/tools/screens.js';
import { JiraApiClient } from '../../src/api/client.js';

jest.mock('../../src/api/client.js');

/**
 * PASS A item 4: get_screen_schemes dropped the only scheme -> screen link.
 *
 * The API returns `screens` as a NESTED OBJECT, e.g. {"default":10140,
 * "create":10139}. The shared response formatter renders only scalars and
 * merely discloses nested objects via _formatterOmitted.columns, so the fact
 * the tool exists to convey never reached the rendered table.
 *
 * Verified live on the dev instance: /rest/api/3/screenscheme returns total 17,
 * every row has a `screens` object, all values numeric, operation keys exactly
 * create/default/edit/view, shape histogram {default}x8, {create,default}x5,
 * {create,default,edit,view}x4. Row properties are id, name, description,
 * screens.
 *
 * Cases marked PROOF fail against the unfixed source.
 */
describe('get_screen_schemes (item 4)', () => {
  let server: McpServer;
  let mockApiClient: jest.Mocked<JiraApiClient>;
  let registeredTools: Map<string, any>;

  // First three entries mirror the live ordering (default-only rows first),
  // which is what makes per-operation columns fail the formatter's
  // "present in all 3 sampled rows" threshold. The last two are synthetic
  // hazards: an operation Jira does not document today, and a non-scalar value.
  const rows = [
    { id: '1', name: 'Default Screen Scheme', description: 'd', screens: { default: 1 } },
    { id: '10034', name: 'Scheme B', description: 'd', screens: { default: 10034 } },
    { id: '10035', name: 'Scheme C', description: 'd', screens: { default: 10035 } },
    { id: '10135', name: 'Scheme D', description: 'd', screens: { default: 10140, create: 10139 } },
    { id: '10200', name: 'Scheme E', description: 'd', screens: { default: 1, create: 2, edit: 3, view: 4 } },
    { id: '10300', name: 'Scheme F', description: 'd', screens: { default: 5, archive: 999 } },
    { id: '10400', name: 'Scheme G', description: 'd', screens: { default: 6, bulk: { a: 1 } } },
  ];

  const call = async (args: Record<string, unknown> = {}) => {
    const entry = registeredTools.get('get_screen_schemes');
    expect(entry).toBeDefined();
    const result = await entry.handler(args);
    return { result, payload: JSON.parse(result.content[0].text) };
  };

  const byId = (payload: any, id: string) =>
    payload.screenSchemes.find((s: any) => s.id === id);

  beforeEach(() => {
    registeredTools = new Map();
    server = {
      registerTool: jest.fn((name: string, schema: any, handler: any) => {
        registeredTools.set(name, { schema, handler });
      }),
    } as any;
    mockApiClient = { makeRequest: jest.fn(), makeAutomationRequest: jest.fn() } as any;
    registerScreenTools(server, mockApiClient);
  });

  it('PROOF: every row carries a scalar screenAssignments column', async () => {
    mockApiClient.makeRequest.mockResolvedValue({
      success: true,
      data: { values: rows, total: 7, startAt: 0, maxResults: 50 },
    } as any);

    const { payload } = await call({});

    expect(payload.success).toBe(true);
    for (const s of payload.screenSchemes) {
      expect(typeof s.screenAssignments).toBe('string');
      expect(s.screenAssignments.length).toBeGreaterThan(0);
    }
  });

  it('PROOF: the scheme -> screen link is legible for a multi-operation scheme', async () => {
    mockApiClient.makeRequest.mockResolvedValue({
      success: true,
      data: { values: rows, total: 7, startAt: 0, maxResults: 50 },
    } as any);

    const { payload } = await call({});
    const d = byId(payload, '10135');

    expect(d.screenAssignments).toContain('default=10140');
    expect(d.screenAssignments).toContain('create=10139');
    expect(d.screenIds).toEqual({ default: 10140, create: 10139 });
  });

  it('PROOF: an unset operation says it falls back to default, never 0', async () => {
    mockApiClient.makeRequest.mockResolvedValue({
      success: true,
      data: { values: rows, total: 7, startAt: 0, maxResults: 50 },
    } as any);

    const { payload } = await call({});
    const a = byId(payload, '1');

    expect(a.screenAssignments).toContain('default=1');
    expect(a.screenAssignments).toContain('create->default');
    // 0 is a plausible real screen id; it must never stand in for "not set".
    expect(a.screenIds.create).toBeUndefined();
    expect(a.screenIds.create).not.toBe(0);
    expect(a.screenAssignments).not.toContain('create=0');
  });

  it('PROOF: an operation Jira adds later is surfaced, not dropped', async () => {
    mockApiClient.makeRequest.mockResolvedValue({
      success: true,
      data: { values: rows, total: 7, startAt: 0, maxResults: 50 },
    } as any);

    const { payload } = await call({});
    const f = byId(payload, '10300');

    expect(f.screenIds.archive).toBe(999);
    expect(f.screenAssignments).toContain('archive=999');
  });

  it('PROOF: a non-scalar operation value is disclosed rather than lost', async () => {
    mockApiClient.makeRequest.mockResolvedValue({
      success: true,
      data: { values: rows, total: 7, startAt: 0, maxResults: 50 },
    } as any);

    const { payload } = await call({});
    const g = byId(payload, '10400');

    expect(g.screenIds.bulk).toBeUndefined();
    expect(g.nonScalarScreenOperations).toContain('bulk');
    expect(g.screenAssignments).not.toContain('bulk=');
  });

  it('PROOF: a scheme with no screens object is reported unknown, not empty', async () => {
    mockApiClient.makeRequest.mockResolvedValue({
      success: true,
      data: { values: [{ id: '99', name: 'No screens', description: 'd' }], total: 1, startAt: 0, maxResults: 50 },
    } as any);

    const { payload } = await call({});
    const s = payload.screenSchemes[0];

    expect(s.screenAssignments).toContain('unknown');
    expect(s.screenIds).toBeNull();
    // Must NOT assert a default fallback that was never observed.
    expect(s.screenAssignments).not.toContain('->default');
  });

  it('PROOF: a non-array payload fails loudly instead of passing rows through unflattened', async () => {
    mockApiClient.makeRequest.mockResolvedValue({
      success: true,
      data: { total: 17, startAt: 0, maxResults: 50, isLast: true },
    } as any);

    const { payload } = await call({});

    expect(payload.success).toBe(false);
    expect(payload.partialFailure).toBe(true);
    expect(payload.screenSchemes).toBeNull();
    expect(payload.count).toBeNull();
    expect(payload.count).not.toBe(0);
  });

  it('PROOF: the bare-array arm counts rows instead of reporting 0', async () => {
    mockApiClient.makeRequest.mockResolvedValue({
      success: true,
      data: rows,
    } as any);

    const { payload } = await call({});

    expect(payload.success).toBe(true);
    expect(payload.count).toBe(7);
    expect(payload.screenSchemes).toHaveLength(7);
  });

  it('GUARD: flattening is additive - raw screens is preserved untouched', async () => {
    mockApiClient.makeRequest.mockResolvedValue({
      success: true,
      data: { values: rows, total: 7, startAt: 0, maxResults: 50 },
    } as any);

    const { payload } = await call({});

    for (let i = 0; i < rows.length; i++) {
      expect(payload.screenSchemes[i].screens).toEqual(rows[i].screens);
      expect(payload.screenSchemes[i].id).toBe(rows[i].id);
      expect(payload.screenSchemes[i].name).toBe(rows[i].name);
    }
  });

  it('GUARD: count and pagination total are unchanged for the envelope arm', async () => {
    mockApiClient.makeRequest.mockResolvedValue({
      success: true,
      data: { values: rows, total: 17, startAt: 0, maxResults: 50 },
    } as any);

    const { payload } = await call({});

    expect(payload.count).toBe(7);
    expect(payload.pagination.total).toBe(17);
  });
});
