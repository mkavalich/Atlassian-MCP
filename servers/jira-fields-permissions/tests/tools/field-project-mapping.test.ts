import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerFieldContextTools } from '../../src/tools/field-contexts.js';
import { JiraApiError } from '../../src/utils/errors.js';

jest.mock('../../src/api/client.js');

/**
 * Fail-before suite for the rebuilt `get_field_project_mapping` (Tool 1).
 *
 * The reverted tool enumerated custom fields from ONE hard-capped 50-row page of
 * /field/search and then told the caller that fields it never saw "are not a
 * custom field" under success:true -- byte-identical to a genuine system field.
 * It also blanket-skipped scope-PROJECT fields, lacked a per-field try/catch
 * (so one 404 aborted the whole batch), and read /project/search unpaginated.
 *
 * PROOF cases fail against that reverted/absent impl. GUARD cases exist to catch
 * over-correction. Each PROOF names the parked defect (A single-page enum,
 * B pre-classification, C unpaginated projects, D missing per-field catch) or
 * the review item (MC3) it locks down.
 */

function parse(result: any) {
  return JSON.parse(result.content[0].text);
}

/** Pick the page whose cumulative row-offset equals startAt (stride-by-rows walk). */
function pickPageByStartAt(
  pages: Array<{ values: any[]; total?: number; isLast?: boolean }>,
  startAt: number
): { values: any[]; total?: number; isLast?: boolean } {
  let offset = 0;
  for (const p of pages) {
    if (offset === startAt) return p;
    offset += p.values.length;
  }
  const last = pages[pages.length - 1];
  return { values: [], total: last?.total, isLast: true };
}

interface MockCfg {
  field?: any[] | { throw: unknown };
  fieldSearchPages?: Array<{ values: any[]; total?: number; isLast?: boolean }>;
  projectPages?: Array<{ values: any[]; total?: number; isLast?: boolean }>;
  mapping?: Record<string, { pages?: Array<{ values: any[]; total?: number; isLast?: boolean }>; throw?: unknown }>;
}

function routeMock(cfg: MockCfg) {
  const makeRequest = jest.fn(async (req: any) => {
    const path = req.path as string;
    const startAt = (req.params?.startAt as number | undefined) ?? 0;

    if (path === '/field') {
      if (cfg.field && !Array.isArray(cfg.field) && 'throw' in cfg.field) throw cfg.field.throw;
      return { success: true, data: (cfg.field as any[]) ?? [] };
    }
    if (path === '/field/search') {
      const pages = cfg.fieldSearchPages ?? [{ values: [], total: 0, isLast: true }];
      return { success: true, data: pickPageByStartAt(pages, startAt) };
    }
    if (path === '/project/search') {
      const pages = cfg.projectPages ?? [{ values: [], total: 0, isLast: true }];
      return { success: true, data: pickPageByStartAt(pages, startAt) };
    }
    const m = path.match(/^\/field\/([^/]+)\/context\/projectmapping$/);
    if (m) {
      const fieldId = m[1];
      const entry = cfg.mapping?.[fieldId];
      if (!entry) throw new JiraApiError('NOT_FOUND', 'The custom field was not found.');
      if (entry.throw) throw entry.throw;
      const pages = entry.pages ?? [{ values: [], total: 0, isLast: true }];
      return { success: true, data: pickPageByStartAt(pages, startAt) };
    }
    throw new Error(`unexpected path in mock: ${path}`);
  });
  return { makeRequest } as any;
}

describe('get_field_project_mapping (Tool 1)', () => {
  let registeredTools: Map<string, any>;

  function register(mockApiClient: any) {
    registeredTools = new Map();
    const server = {
      registerTool: jest.fn((name: string, schema: any, handler: any) => {
        registeredTools.set(name, { schema, handler });
      }),
    } as unknown as McpServer;
    registerFieldContextTools(server, mockApiClient);
  }

  beforeEach(() => {
    registeredTools = new Map();
  });

  // A JPD field lives only in /field (excluded from /field/search), so a
  // single-page /field/search enum never saw it -> reverted impl said
  // NOT_A_CUSTOM_FIELD. Union enum finds it; a byte-identical 404 -> UNVERIFIABLE.
  it('PROOF (MC3 + defects A/B): a JPD field, 404 from mapping, is project-scoped-jpd/UNVERIFIABLE, never NOT_A_CUSTOM_FIELD or 0', async () => {
    const api = routeMock({
      field: [
        { id: 'summary', custom: false },
        {
          id: 'customfield_10060',
          name: 'Impact',
          custom: true,
          schema: { type: 'number', custom: 'jira.polaris:rating', customId: 10060 },
          scope: { type: 'PROJECT', project: { id: '10000' } },
        },
      ],
      // /field/search does NOT contain customfield_10060 (JPD excluded) and reaches isLast.
      fieldSearchPages: [{ values: [{ id: 'customfield_10014', name: 'Sprint', schema: { customId: 10014 } }], total: 1, isLast: true }],
      // No mapping entry for customfield_10060 -> the mock throws a byte-identical 404.
    });
    register(api);
    const tool = registeredTools.get('get_field_project_mapping');
    const payload = parse(await tool.handler({ fieldIds: ['customfield_10060'] }));

    expect(payload.success).toBe(true);
    expect(payload.errors).toEqual([]); // NOT rejected as NOT_A_CUSTOM_FIELD
    expect(payload.mappings).toHaveLength(1);
    const m = payload.mappings[0];
    expect(m.scope).toBe('project-scoped-jpd');
    expect(m.verifiable).toBe(false);
    expect(m.projectsFromScope).toEqual([{ id: '10000' }]);
    expect(m.projectCount).toBeNull();
    expect(m.projectCount).not.toBe(0);
    expect(JSON.stringify(m)).not.toContain('NOT_A_CUSTOM_FIELD');
  });

  // A genuine non-JPD project-scoped field returns a 200 with real ids. An impl
  // that blanket-skips scope-PROJECT fields would drop these associations.
  it('PROOF (MC3): a scope-PROJECT field whose mapping returns 200 reports its REAL project ids', async () => {
    const api = routeMock({
      field: [
        { id: 'summary', custom: false },
        {
          id: 'customfield_20001',
          name: 'Team',
          custom: true,
          schema: { type: 'string', custom: 'com.atlassian.jira:teams', customId: 20001 },
          scope: { type: 'PROJECT', project: { id: '10005' } },
        },
      ],
      fieldSearchPages: [{ values: [], total: 0, isLast: true }],
      mapping: {
        customfield_20001: {
          pages: [
            {
              values: [
                { contextId: 'c1', projectId: '10001' },
                { contextId: 'c1', projectId: '10002' },
              ],
              total: 2,
              isLast: true,
            },
          ],
        },
      },
    });
    register(api);
    const tool = registeredTools.get('get_field_project_mapping');
    const payload = parse(await tool.handler({ fieldIds: ['customfield_20001'] }));

    expect(payload.success).toBe(true);
    const m = payload.mappings[0];
    expect(m.scope).toBe('project-scoped');
    expect(m.verifiable).toBe(true);
    expect(m.projects).toEqual(['10001', '10002']);
    expect(m.projectCount).toBe(2);
  });

  // A mapping walk that never reaches isLast (every page full, no total) exhausts
  // the page cap and returns a truncated prefix. It must fail closed --
  // verifiable:false, projectCount:null -- never a confident, possibly-short
  // count. Mirrors the primitive's own /field/search + resolveAllProjectIds walks.
  it('PROOF (fail-closed): a projectmapping walk that exhausts the page cap is verifiable:false, never a definite count', async () => {
    const api = {
      makeRequest: jest.fn(async (req: any) => {
        const path = req.path as string;
        const startAt = (req.params?.startAt as number | undefined) ?? 0;
        if (path === '/field')
          return { success: true, data: [{ id: 'customfield_20001', custom: true, schema: { customId: 20001 } }] };
        if (path === '/field/search')
          return { success: true, data: { values: [{ id: 'customfield_20001', schema: { customId: 20001 } }], total: 1, isLast: true } };
        if (/\/context\/projectmapping$/.test(path))
          // Non-terminal: full page, no isLast, no total -> the walk never stops naturally.
          return { success: true, data: { values: [{ contextId: 'c', projectId: String(startAt + 1) }] } };
        if (path === '/project/search') return { success: true, data: { values: [], total: 0, isLast: true } };
        throw new Error(`unexpected path in mock: ${path}`);
      }),
    } as any;
    register(api);
    const tool = registeredTools.get('get_field_project_mapping');
    const payload = parse(await tool.handler({ fieldIds: ['customfield_20001'] }));

    const m = payload.mappings.find((x: any) => x.fieldId === 'customfield_20001');
    expect(m.verifiable).toBe(false);
    expect(m.projectCount).toBeNull();
    expect(m.scope).toBe('unknown');
    expect(m.unverifiableReason).toContain('page cap');
    expect(payload.partialFailure).toBe(true);
  });

  it('PROOF (global): a global context is allProjects:true, never projects:[]/projectCount:0', async () => {
    const api = routeMock({
      field: [{ id: 'customfield_10026', name: 'Team', custom: true, schema: { customId: 10026 } }],
      fieldSearchPages: [{ values: [{ id: 'customfield_10026', schema: { customId: 10026 } }], total: 1, isLast: true }],
      mapping: {
        customfield_10026: { pages: [{ values: [{ contextId: 'ctx1', isGlobalContext: true }], total: 1, isLast: true }] },
      },
    });
    register(api);
    const tool = registeredTools.get('get_field_project_mapping');
    const payload = parse(await tool.handler({ fieldIds: ['customfield_10026'] }));

    const m = payload.mappings[0];
    expect(m.scope).toBe('global');
    expect(m.allProjects).toBe(true);
    expect(m.verifiable).toBe(true);
    expect(m.projects).toBeNull();
    expect(m.projectCount).toBeNull();
    expect(m.projectCount).not.toBe(0);
  });

  // Middle field's mapping throws a non-404 (5xx). Without a per-field catch the
  // whole batch would reject success:false (parked defect D).
  it('PROOF (defect D): one field failing does not abort the batch; the others resolve', async () => {
    const api = routeMock({
      field: [
        { id: 'customfield_1', custom: true, schema: { customId: 1 } },
        { id: 'customfield_2', custom: true, schema: { customId: 2 } },
        { id: 'customfield_3', custom: true, schema: { customId: 3 } },
      ],
      fieldSearchPages: [
        {
          values: [
            { id: 'customfield_1', schema: { customId: 1 } },
            { id: 'customfield_2', schema: { customId: 2 } },
            { id: 'customfield_3', schema: { customId: 3 } },
          ],
          total: 3,
          isLast: true,
        },
      ],
      mapping: {
        customfield_1: { pages: [{ values: [{ contextId: 'c', isGlobalContext: true }], total: 1, isLast: true }] },
        customfield_2: { throw: new JiraApiError('INTERNAL_SERVER_ERROR', 'Jira server error') },
        customfield_3: { pages: [{ values: [{ contextId: 'c', isGlobalContext: true }], total: 1, isLast: true }] },
      },
    });
    register(api);
    const tool = registeredTools.get('get_field_project_mapping');
    const payload = parse(await tool.handler({ fieldIds: ['customfield_1', 'customfield_2', 'customfield_3'] }));

    expect(payload.success).toBe(true);
    expect(payload.mappings.map((m: any) => m.fieldId).sort()).toEqual(['customfield_1', 'customfield_3']);
    expect(payload.partialFailure).toBe(true);
    const err = payload.errors.find((e: any) => e.fieldId === 'customfield_2');
    expect(err.code).toBe('MAPPING_UNAVAILABLE');
  });

  // Parked defect C: reverted read /project/search once with maxResults:100 and
  // took page 1 only. A two-page tenant would report the wrong count.
  it('PROOF (defect C): resolveGlobalToProjects paginates /project/search to isLast', async () => {
    const projects = Array.from({ length: 9 }, (_, i) => ({ id: 100 + i }));
    const api = routeMock({
      field: [{ id: 'customfield_10026', custom: true, schema: { customId: 10026 } }],
      fieldSearchPages: [{ values: [{ id: 'customfield_10026', schema: { customId: 10026 } }], total: 1, isLast: true }],
      projectPages: [
        { values: projects.slice(0, 5), total: 9, isLast: false },
        { values: projects.slice(5), total: 9, isLast: true },
      ],
      mapping: {
        customfield_10026: { pages: [{ values: [{ contextId: 'c', isGlobalContext: true }], total: 1, isLast: true }] },
      },
    });
    register(api);
    const tool = registeredTools.get('get_field_project_mapping');
    const payload = parse(await tool.handler({ fieldIds: ['customfield_10026'], resolveGlobalToProjects: true }));

    const m = payload.mappings[0];
    expect(m.scope).toBe('global');
    expect(m.allProjects).toBe(true);
    expect(m.projectCount).toBe(9);
    expect(m.projects).toHaveLength(9);
  });

  it('PROOF (gate): a system field and a nonexistent id get DISTINCT codes via the enumeration, not one 404 bucket', async () => {
    const api = routeMock({
      field: [
        { id: 'summary', custom: false },
        { id: 'customfield_10026', custom: true, schema: { customId: 10026 } },
      ],
      fieldSearchPages: [{ values: [{ id: 'customfield_10026', schema: { customId: 10026 } }], total: 1, isLast: true }],
    });
    register(api);
    const tool = registeredTools.get('get_field_project_mapping');
    const payload = parse(await tool.handler({ fieldIds: ['summary', 'customfield_99999'] }));

    expect(payload.mappings).toHaveLength(0);
    const summaryErr = payload.errors.find((e: any) => e.fieldId === 'summary');
    const ghostErr = payload.errors.find((e: any) => e.fieldId === 'customfield_99999');
    expect(summaryErr.code).toBe('SYSTEM_FIELD');
    expect(ghostErr.code).toBe('FIELD_NOT_FOUND');
  });

  // The gate's core invariant: on an incomplete enumeration, an unknown id is
  // UNVERIFIABLE, never a confident FIELD_NOT_FOUND.
  it('PROOF (gate): an incomplete enumeration yields UNVERIFIABLE, never FIELD_NOT_FOUND', async () => {
    const api = {
      makeRequest: jest.fn(async (req: any) => {
        if (req.path === '/field') return { success: true, data: [{ id: 'summary', custom: false }] };
        if (req.path === '/field/search') throw new JiraApiError('INTERNAL_SERVER_ERROR', 'boom');
        throw new Error(`unexpected ${req.path}`);
      }),
    } as any;
    register(api);
    const tool = registeredTools.get('get_field_project_mapping');
    const payload = parse(await tool.handler({ fieldIds: ['customfield_99999'] }));

    const err = payload.errors.find((e: any) => e.fieldId === 'customfield_99999');
    expect(err.code).toBe('UNVERIFIABLE');
    expect(err.code).not.toBe('FIELD_NOT_FOUND');
  });

  it('PROOF (no silent truncation): over 25 field ids is a hard validation error, never a truncated result', async () => {
    const api = routeMock({ field: [] });
    register(api);
    const tool = registeredTools.get('get_field_project_mapping');
    const ids = Array.from({ length: 26 }, (_, i) => `customfield_${10000 + i}`);
    const payload = parse(await tool.handler({ fieldIds: ids }));

    expect(payload.success).toBe(false);
    expect(payload.mappings).toBeUndefined();
  });

  it('GUARD: mapping calls use distinct plain-object params per field (never URLSearchParams)', async () => {
    const api = routeMock({
      field: [
        { id: 'customfield_1', custom: true, schema: { customId: 1 } },
        { id: 'customfield_2', custom: true, schema: { customId: 2 } },
      ],
      fieldSearchPages: [
        {
          values: [
            { id: 'customfield_1', schema: { customId: 1 } },
            { id: 'customfield_2', schema: { customId: 2 } },
          ],
          total: 2,
          isLast: true,
        },
      ],
      mapping: {
        customfield_1: { pages: [{ values: [{ contextId: 'c', isGlobalContext: true }], total: 1, isLast: true }] },
        customfield_2: { pages: [{ values: [{ contextId: 'c', isGlobalContext: true }], total: 1, isLast: true }] },
      },
    });
    register(api);
    const tool = registeredTools.get('get_field_project_mapping');
    await tool.handler({ fieldIds: ['customfield_1', 'customfield_2'] });

    const mappingCalls = (api.makeRequest as any).mock.calls
      .map((c: any[]) => c[0])
      .filter((r: any) => typeof r.path === 'string' && r.path.includes('/context/projectmapping'));
    expect(mappingCalls).toHaveLength(2);
    for (const call of mappingCalls) {
      expect(call.params).not.toBeInstanceOf(URLSearchParams);
      expect(Object.prototype.toString.call(call.params)).toBe('[object Object]');
      expect(call.params).toHaveProperty('startAt');
    }
    const paths = mappingCalls.map((c: any) => c.path);
    expect(new Set(paths).size).toBe(2);
  });

  it('GUARD: a normal complete run reports enumeration.complete:true and no partialFailure', async () => {
    const api = routeMock({
      field: [{ id: 'customfield_10026', custom: true, schema: { customId: 10026 } }],
      fieldSearchPages: [{ values: [{ id: 'customfield_10026', schema: { customId: 10026 } }], total: 1, isLast: true }],
      mapping: {
        customfield_10026: { pages: [{ values: [{ contextId: 'c', isGlobalContext: true }], total: 1, isLast: true }] },
      },
    });
    register(api);
    const tool = registeredTools.get('get_field_project_mapping');
    const payload = parse(await tool.handler({ fieldIds: ['customfield_10026'] }));

    expect(payload.success).toBe(true);
    expect(payload.partialFailure).toBe(false);
    expect(payload.enumeration.complete).toBe(true);
  });
});
