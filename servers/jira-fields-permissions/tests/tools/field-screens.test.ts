import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerFieldScreenTools } from '../../src/tools/field-screens.js';
import { JiraApiError } from '../../src/utils/errors.js';

jest.mock('../../src/api/client.js');

/**
 * Fail-before suite for `get_field_screens` (Tool 2, NEW).
 *
 * The defect this tool must make impossible: conflating a 404 with a genuine
 * "field is on no screens". screens:[] / onNoScreens:true is reachable ONLY from
 * a real 200 total:0. A known-custom field whose /screens endpoint 404s is
 * SCREENS_UNAVAILABLE (verifiable:false, screens:null) -- MC2. A 404 for a system
 * field or a nonexistent id is classified via the union enumeration with a
 * distinct code, never as an empty screen list.
 *
 * PROOF cases fail against a "404 -> screens:[]" impl. GUARD cases catch
 * over-correction.
 */

function parse(result: any) {
  return JSON.parse(result.content[0].text);
}

function pickPageByStartAt(
  pages: Array<{ values: any; total?: number; isLast?: boolean }>,
  startAt: number
): { values: any; total?: number; isLast?: boolean } {
  let offset = 0;
  for (const p of pages) {
    if (offset === startAt) return p;
    offset += Array.isArray(p.values) ? p.values.length : 0;
  }
  const last = pages[pages.length - 1];
  return { values: [], total: last?.total, isLast: true };
}

interface MockCfg {
  /** /field/{id}/screens behaviour. */
  screens?: { pages?: Array<{ values: any; total?: number; isLast?: boolean }>; throw?: unknown };
  /** /field (bare array) for the lazy enumeration on a 404. */
  field?: any[] | { throw: unknown };
  /** /field/search pages for the lazy enumeration on a 404. */
  fieldSearchPages?: Array<{ values: any[]; total?: number; isLast?: boolean }>;
}

function routeMock(cfg: MockCfg) {
  const makeRequest = jest.fn(async (req: any) => {
    const path = req.path as string;
    const startAt = (req.params?.startAt as number | undefined) ?? 0;

    if (/^\/field\/[^/]+\/screens$/.test(path)) {
      if (cfg.screens?.throw) throw cfg.screens.throw;
      const pages = cfg.screens?.pages ?? [{ values: [], total: 0, isLast: true }];
      return { success: true, data: pickPageByStartAt(pages, startAt) };
    }
    if (path === '/field') {
      if (cfg.field && !Array.isArray(cfg.field) && 'throw' in cfg.field) throw cfg.field.throw;
      return { success: true, data: (cfg.field as any[]) ?? [] };
    }
    if (path === '/field/search') {
      const pages = cfg.fieldSearchPages ?? [{ values: [], total: 0, isLast: true }];
      return { success: true, data: pickPageByStartAt(pages, startAt) };
    }
    throw new Error(`unexpected path in mock: ${path}`);
  });
  return { makeRequest } as any;
}

describe('get_field_screens (Tool 2)', () => {
  let registeredTools: Map<string, any>;

  function register(mockApiClient: any) {
    registeredTools = new Map();
    const server = {
      registerTool: jest.fn((name: string, schema: any, handler: any) => {
        registeredTools.set(name, { schema, handler });
      }),
    } as unknown as McpServer;
    registerFieldScreenTools(server, mockApiClient);
  }

  beforeEach(() => {
    registeredTools = new Map();
  });

  // Two 0-ish outcomes must carry DIFFERENT codes. A "404 -> empty screens"
  // impl would collapse them into one indistinguishable screens:[].
  it('PROOF (MC2): a genuine 200 total:0 and a 404-system-field are DISTINCT, not both screens:[]', async () => {
    // (a) genuine zero from a 200 total:0
    const apiZero = routeMock({ screens: { pages: [{ values: [], total: 0, isLast: true }] } });
    register(apiZero);
    let tool = registeredTools.get('get_field_screens');
    const zero = parse(await tool.handler({ fieldId: 'customfield_10026' }));
    expect(zero.success).toBe(true);
    expect(zero.onNoScreens).toBe(true);
    expect(zero.verifiable).toBe(true);
    expect(zero.screens).toEqual([]);

    // (b) 404 + enumeration says it is a SYSTEM field
    const apiSys = routeMock({
      screens: { throw: new JiraApiError('NOT_FOUND', 'The field was not found.') },
      field: [{ id: 'summary', custom: false }],
      fieldSearchPages: [{ values: [], total: 0, isLast: true }],
    });
    register(apiSys);
    tool = registeredTools.get('get_field_screens');
    const sys = parse(await tool.handler({ fieldId: 'summary' }));
    expect(sys.success).toBe(false);
    expect(sys.error.code).toBe('SYSTEM_FIELD');
    expect(sys.onNoScreens).toBe(false);
    expect(sys.screens).toBeNull();
    // The two 0-ish results are NOT the same shape.
    expect(sys.onNoScreens).not.toBe(zero.onNoScreens);
  });

  it('PROOF (MC2): a known custom field whose /screens 404s is SCREENS_UNAVAILABLE, never screens:[]', async () => {
    const api = routeMock({
      screens: { throw: new JiraApiError('NOT_FOUND', 'The field was not found.') },
      // customfield_10104 IS in the union (custom), enumeration complete.
      field: [
        { id: 'summary', custom: false },
        { id: 'customfield_10104', custom: true, schema: { customId: 10104 } },
      ],
      fieldSearchPages: [{ values: [{ id: 'customfield_10104', schema: { customId: 10104 } }], total: 1, isLast: true }],
    });
    register(api);
    const tool = registeredTools.get('get_field_screens');
    const payload = parse(await tool.handler({ fieldId: 'customfield_10104' }));

    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('SCREENS_UNAVAILABLE');
    expect(payload.verifiable).toBe(false);
    expect(payload.screens).toBeNull();
    expect(payload.screens).not.toEqual([]);
    expect(payload.onNoScreens).toBe(false);
  });

  it('PROOF (gate): a 404 with an INCOMPLETE enumeration is UNVERIFIABLE, never FIELD_NOT_FOUND', async () => {
    const api = routeMock({
      screens: { throw: new JiraApiError('NOT_FOUND', 'The field was not found.') },
      // /field throws -> enumeration incomplete.
      field: { throw: new JiraApiError('INTERNAL_SERVER_ERROR', 'boom') },
      fieldSearchPages: [{ values: [], total: 0, isLast: true }],
    });
    register(api);
    const tool = registeredTools.get('get_field_screens');
    const payload = parse(await tool.handler({ fieldId: 'customfield_99999' }));

    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('UNVERIFIABLE');
    expect(payload.error.code).not.toBe('FIELD_NOT_FOUND');
    expect(payload.screens).toBeNull();
  });

  it('GUARD: a field on N screens returns them with verifiable:true', async () => {
    const screensRows = Array.from({ length: 7 }, (_, i) => ({ id: 100 + i, name: `Screen ${i}` }));
    const api = routeMock({
      screens: { pages: [{ values: screensRows, total: 7, isLast: true }] },
    });
    register(api);
    const tool = registeredTools.get('get_field_screens');
    const payload = parse(await tool.handler({ fieldId: 'customfield_10104' }));

    expect(payload.success).toBe(true);
    expect(payload.total).toBe(7);
    expect(payload.count).toBe(7);
    expect(payload.verifiable).toBe(true);
    expect(payload.onNoScreens).toBe(false);
    expect(payload.screens[0].id).toBe('100');
  });

  it('GUARD: /screens paginates to isLast, striding by rows received', async () => {
    const api = routeMock({
      screens: {
        pages: [
          { values: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }], total: 3, isLast: false },
          { values: [{ id: 3, name: 'C' }], total: 3, isLast: true },
        ],
      },
    });
    register(api);
    const tool = registeredTools.get('get_field_screens');
    const payload = parse(await tool.handler({ fieldId: 'customfield_10104' }));

    expect(payload.screens.map((s: any) => s.id)).toEqual(['1', '2', '3']);
    const screenCalls = (api.makeRequest as any).mock.calls
      .map((c: any[]) => c[0])
      .filter((r: any) => typeof r.path === 'string' && r.path.endsWith('/screens'));
    expect(screenCalls.map((c: any) => c.params.startAt)).toEqual([0, 2]); // strode by rows received, not by 100
  });

  it('GUARD: an unrecognized 200 shape fails loud, never screens:[]', async () => {
    const api = routeMock({
      screens: { pages: [{ values: 'nope' as any, total: undefined, isLast: undefined }] },
    });
    register(api);
    const tool = registeredTools.get('get_field_screens');
    const payload = parse(await tool.handler({ fieldId: 'customfield_10104' }));

    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('GET_FIELD_SCREENS_UNRECOGNIZED_SHAPE');
    expect(payload.screens).toBeNull();
    expect(payload.screens).not.toEqual([]);
  });

  it('registers exactly the get_field_screens tool', () => {
    const api = routeMock({});
    register(api);
    expect(registeredTools.has('get_field_screens')).toBe(true);
    expect(registeredTools.size).toBe(1);
  });
});
