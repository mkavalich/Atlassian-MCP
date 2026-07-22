import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerIssueTypeScreenSchemeTools } from '../../src/tools/issue-type-screen-schemes.js';
import { JiraApiError } from '../../src/utils/errors.js';

/**
 * Fail-before suite for the three ITSS read tools (Tool 3: 3a/3b/3c).
 *
 * The defect class this suite guards: a paginated read that truncates at a page
 * cap and returns a confident, successful-looking wrong answer. Every walk must
 * report complete:false (verifiable:false / truncated) on cap exhaustion, never a
 * definite count. MC1: 3b's honest "uses the Default ITSS" verdict is reachable
 * ONLY on a COMPLETED walk; a truncated walk that has not seen the project is
 * assigned:null / verifiable:false, never usesDefaultItss.
 *
 * Cases marked PROOF fail against a truncating / ungated / scalar-id-reading /
 * shape-blind impl (and against the absent module before this build).
 */

function parse(result: any) {
  return JSON.parse(result.content[0].text);
}

type Page = { values: any; total?: number; isLast?: boolean };

// Strides by rows received: returns the page whose cumulative offset equals the
// requested startAt. Falls back to an empty terminal page (isLast:true) once the
// configured pages are exhausted.
function pickPageByStartAt(pages: Page[], startAt: number): Page {
  let offset = 0;
  for (const p of pages) {
    if (offset === startAt) return p;
    offset += Array.isArray(p.values) ? p.values.length : 0;
  }
  const last = pages[pages.length - 1];
  return { values: [], total: last?.total, isLast: true };
}

interface MockCfg {
  schemes?: { pages?: Page[]; throw?: unknown };
  project?: { pages?: Page[]; throw?: unknown };
  mappings?: { pages?: Page[]; throw?: unknown };
}

function routeMock(cfg: MockCfg) {
  const makeRequest = jest.fn(async (req: any) => {
    const path = req.path as string;
    const startAt = (req.params?.startAt as number | undefined) ?? 0;

    if (path === '/issuetypescreenscheme') {
      if (cfg.schemes?.throw) throw cfg.schemes.throw;
      return { success: true, data: pickPageByStartAt(cfg.schemes?.pages ?? [{ values: [], total: 0, isLast: true }], startAt) };
    }
    if (path === '/issuetypescreenscheme/project') {
      if (cfg.project?.throw) throw cfg.project.throw;
      return { success: true, data: pickPageByStartAt(cfg.project?.pages ?? [{ values: [], total: 0, isLast: true }], startAt) };
    }
    if (path === '/issuetypescreenscheme/mapping') {
      if (cfg.mappings?.throw) throw cfg.mappings.throw;
      return { success: true, data: pickPageByStartAt(cfg.mappings?.pages ?? [{ values: [], total: 0, isLast: true }], startAt) };
    }
    throw new Error(`unexpected path in mock: ${path}`);
  });
  return { makeRequest } as any;
}

describe('ITSS read tools (Tool 3: 3a/3b/3c)', () => {
  let registeredTools: Map<string, any>;

  function register(mockApiClient: any) {
    registeredTools = new Map();
    const server = {
      registerTool: jest.fn((name: string, schema: any, handler: any) => {
        registeredTools.set(name, { schema, handler });
      }),
    } as unknown as McpServer;
    registerIssueTypeScreenSchemeTools(server, mockApiClient);
  }

  beforeEach(() => {
    registeredTools = new Map();
  });

  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const entry = registeredTools.get(name);
    expect(entry).toBeDefined();
    return parse(await entry.handler(args));
  };

  it('registers exactly the three ITSS read tools', () => {
    register(routeMock({}));
    expect(registeredTools.has('get_issue_type_screen_schemes')).toBe(true);
    expect(registeredTools.has('get_project_issue_type_screen_scheme')).toBe(true);
    expect(registeredTools.has('get_issue_type_screen_scheme_mappings')).toBe(true);
    expect(registeredTools.size).toBe(3);
  });

  // ---- 3a: get_issue_type_screen_schemes ----------------------------------

  it('3a GUARD: lists all schemes to completion', async () => {
    register(routeMock({
      schemes: { pages: [{ values: [
        { id: '1', name: 'Default Issue Type Screen Scheme', description: 'd' },
        { id: '10331', name: 'DSMNT', description: 'd' },
      ], total: 2, isLast: true }] },
    }));
    const payload = await call('get_issue_type_screen_schemes');
    expect(payload.success).toBe(true);
    expect(payload.isLast).toBe(true);
    expect(payload.total).toBe(2);
    expect(payload.count).toBe(2);
    expect(payload.schemes.map((s: any) => s.id)).toEqual(['1', '10331']);
  });

  it('3a PROOF (schemes_paginate): two pages, striding startAt by rows received', async () => {
    const api = routeMock({
      schemes: { pages: [
        { values: [{ id: '1', name: 'A' }, { id: '10001', name: 'B' }], total: 3, isLast: false },
        { values: [{ id: '10002', name: 'C' }], total: 3, isLast: true },
      ] },
    });
    register(api);
    const payload = await call('get_issue_type_screen_schemes');
    expect(payload.schemes.map((s: any) => s.id)).toEqual(['1', '10001', '10002']);
    expect(payload.success).toBe(true);
    const startAts = (api.makeRequest as any).mock.calls
      .map((c: any[]) => c[0])
      .filter((r: any) => r.path === '/issuetypescreenscheme')
      .map((r: any) => r.params.startAt);
    expect(startAts).toEqual([0, 2]); // strode by rows received (2), not by maxResults
  });

  it('3a PROOF (fail-closed): a non-terminating walk is truncated / verifiable:false, not a definite list', async () => {
    // Full page every time, no isLast, no total -> never a natural stop.
    const api = {
      makeRequest: jest.fn(async (req: any) => {
        const path = req.path as string;
        const startAt = (req.params?.startAt as number | undefined) ?? 0;
        if (path === '/issuetypescreenscheme') return { success: true, data: { values: [{ id: String(startAt + 1), name: 'S' }] } };
        throw new Error(`unexpected path in mock: ${path}`);
      }),
    } as any;
    register(api);
    const payload = await call('get_issue_type_screen_schemes');
    expect(payload.success).toBe(false);
    expect(payload.isLast).toBe(false);
    expect(payload.truncated).toBe(true);
  });

  it('3a PROOF (fail-loud): an unrecognized 200 shape errors, never schemes:[]', async () => {
    register(routeMock({
      schemes: { pages: [{ values: 'nope' as any, total: undefined, isLast: undefined }] },
    }));
    const payload = await call('get_issue_type_screen_schemes');
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('GET_ISSUE_TYPE_SCREEN_SCHEMES_UNRECOGNIZED_SHAPE');
    expect(payload.schemes).toBeNull();
    expect(payload.schemes).not.toEqual([]);
  });

  // ---- 3b: get_project_issue_type_screen_scheme (MC1) ---------------------

  it('3b PROOF (project_required): missing projectId is a validation error, never {assigned:false}/empty', async () => {
    register(routeMock({}));
    const payload = await call('get_project_issue_type_screen_scheme', {});
    expect(payload.success).toBe(false);
    // Never a fabricated honest-absence or empty projects list.
    expect(payload.assigned).not.toBe(false);
    expect(payload.usesDefaultItss).toBeUndefined();
  });

  it('3b PROOF (project_required): a mocked 400 surfaces as an error, never {assigned:false}', async () => {
    register(routeMock({
      project: { throw: new JiraApiError('VALIDATION_ERROR', 'At least one projectId has to be provided.') },
    }));
    const payload = await call('get_project_issue_type_screen_scheme', { projectId: '10331' });
    expect(payload.success).toBe(false);
    expect(payload.assigned).toBeNull();
    expect(payload.usesDefaultItss).toBeUndefined();
  });

  it('3b PROOF (project_row_shape): reads ITSS id from .issueTypeScreenScheme.id, not a scalar', async () => {
    register(routeMock({
      project: { pages: [{ values: [
        { issueTypeScreenScheme: { id: '10331', name: 'DSMNT' }, projectIds: ['10331'] },
      ], total: 1, isLast: true }] },
    }));
    const payload = await call('get_project_issue_type_screen_scheme', { projectId: '10331' });
    expect(payload.success).toBe(true);
    expect(payload.assigned).toBe(true);
    // A scalar reader (row.issueTypeScreenSchemeId) would yield undefined here.
    expect(payload.issueTypeScreenSchemeId).toBe('10331');
  });

  it('3b GUARD (default_fallback_honest): total:0 + isLast:true -> assigned:false, usesDefaultItss:1', async () => {
    register(routeMock({
      project: { pages: [{ values: [], total: 0, isLast: true }] },
    }));
    const payload = await call('get_project_issue_type_screen_scheme', { projectId: '10000' });
    expect(payload.success).toBe(true);
    expect(payload.assigned).toBe(false);
    expect(payload.usesDefaultItss).toBe('1');
    // Honest absence: reachable ONLY because the walk completed.
  });

  it('3b PROOF (MC1: project_walk_truncated_unverifiable): a truncated walk is assigned:null, never usesDefaultItss', async () => {
    // Full pages of OTHER projects, never isLast, never total -> the queried
    // project is never seen and the walk exhausts the cap.
    const api = {
      makeRequest: jest.fn(async (req: any) => {
        const path = req.path as string;
        const startAt = (req.params?.startAt as number | undefined) ?? 0;
        if (path === '/issuetypescreenscheme/project')
          return { success: true, data: { values: [{ issueTypeScreenScheme: { id: '999' }, projectIds: ['888'] }] } };
        throw new Error(`unexpected path in mock: ${path}, startAt=${startAt}`);
      }),
    } as any;
    register(api);
    const payload = await call('get_project_issue_type_screen_scheme', { projectId: '10331' });
    expect(payload.assigned).toBeNull();
    expect(payload.verifiable).toBe(false);
    expect(payload.success).toBe(false);
    expect(payload.truncated).toBe(true);
    // MC1: MUST NOT fabricate the Default-ITSS fallback for an unseen project.
    expect(payload.usesDefaultItss).toBeUndefined();
    expect(payload.assigned).not.toBe(false);
  });

  it('3b GUARD (fail-loud): a matching row with a non-scalar ITSS id errors, never a fabricated assignment', async () => {
    register(routeMock({
      project: { pages: [{ values: [
        { issueTypeScreenScheme: { id: { nested: true } }, projectIds: ['10331'] },
      ], total: 1, isLast: true }] },
    }));
    const payload = await call('get_project_issue_type_screen_scheme', { projectId: '10331' });
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('GET_PROJECT_ITSS_UNRECOGNIZED_SHAPE');
    expect(payload.assigned).not.toBe(false);
  });

  // ---- 3c: get_issue_type_screen_scheme_mappings --------------------------

  it('3c GUARD (filter): rows for one ITSS incl the default catch-all', async () => {
    register(routeMock({
      mappings: { pages: [{ values: [
        { issueTypeScreenSchemeId: '10331', issueTypeId: 'default', screenSchemeId: '10436' },
        { issueTypeScreenSchemeId: '10331', issueTypeId: '10001', screenSchemeId: '10437' },
      ], total: 2, isLast: true }] },
    }));
    const payload = await call('get_issue_type_screen_scheme_mappings', { issueTypeScreenSchemeId: ['10331'] });
    expect(payload.success).toBe(true);
    expect(payload.count).toBe(2);
    const def = payload.mappings.find((m: any) => m.issueTypeId === 'default');
    expect(def.screenSchemeId).toBe('10436');
  });

  it('3c GUARD (client-side filter): rows for other ITSS are excluded even if the server returns them', async () => {
    register(routeMock({
      mappings: { pages: [{ values: [
        { issueTypeScreenSchemeId: '10331', issueTypeId: 'default', screenSchemeId: '10436' },
        { issueTypeScreenSchemeId: '99999', issueTypeId: 'default', screenSchemeId: '10500' },
      ], total: 2, isLast: true }] },
    }));
    const payload = await call('get_issue_type_screen_scheme_mappings', { issueTypeScreenSchemeId: ['10331'] });
    expect(payload.mappings.every((m: any) => m.issueTypeScreenSchemeId === '10331')).toBe(true);
    expect(payload.count).toBe(1);
  });

  it('3c PROOF (mappings_paginate): two pages, striding startAt by rows received', async () => {
    const api = routeMock({
      mappings: { pages: [
        { values: [
          { issueTypeScreenSchemeId: '1', issueTypeId: 'default', screenSchemeId: '5' },
          { issueTypeScreenSchemeId: '1', issueTypeId: '10001', screenSchemeId: '6' },
        ], total: 3, isLast: false },
        { values: [{ issueTypeScreenSchemeId: '10331', issueTypeId: 'default', screenSchemeId: '10436' }], total: 3, isLast: true },
      ] },
    });
    register(api);
    const payload = await call('get_issue_type_screen_scheme_mappings');
    expect(payload.count).toBe(3);
    expect(payload.success).toBe(true);
    const startAts = (api.makeRequest as any).mock.calls
      .map((c: any[]) => c[0])
      .filter((r: any) => r.path === '/issuetypescreenscheme/mapping')
      .map((r: any) => r.params.startAt);
    expect(startAts).toEqual([0, 2]);
  });

  it('3c PROOF (fail-closed): a non-terminating walk is truncated / verifiable:false', async () => {
    const api = {
      makeRequest: jest.fn(async (req: any) => {
        const path = req.path as string;
        const startAt = (req.params?.startAt as number | undefined) ?? 0;
        if (path === '/issuetypescreenscheme/mapping')
          return { success: true, data: { values: [{ issueTypeScreenSchemeId: String(startAt), issueTypeId: 'default', screenSchemeId: '1' }] } };
        throw new Error(`unexpected path in mock: ${path}`);
      }),
    } as any;
    register(api);
    const payload = await call('get_issue_type_screen_scheme_mappings');
    expect(payload.success).toBe(false);
    expect(payload.isLast).toBe(false);
    expect(payload.truncated).toBe(true);
  });

  it('3c PROOF (fail-loud): an unrecognized 200 shape errors, never mappings:[]', async () => {
    register(routeMock({
      mappings: { pages: [{ values: { not: 'an array' } as any }] },
    }));
    const payload = await call('get_issue_type_screen_scheme_mappings');
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('GET_ISSUE_TYPE_SCREEN_SCHEME_MAPPINGS_UNRECOGNIZED_SHAPE');
    expect(payload.mappings).toBeNull();
    expect(payload.mappings).not.toEqual([]);
  });
});
