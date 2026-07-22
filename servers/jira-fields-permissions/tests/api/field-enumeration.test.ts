import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import {
  enumerateCustomFields,
  classifyFieldId,
  __fieldEnumeration,
} from '../../src/api/field-enumeration.js';
import { JiraApiClient } from '../../src/api/client.js';
import { JiraApiError } from '../../src/utils/errors.js';

/**
 * Cross-endpoint enumeration primitive.
 *
 * THE headline fail-before is `union_present`: the union must contain BOTH a
 * field present only in `/field` (a project-scoped JPD id) AND a field present
 * only in `/field/search`. A single-endpoint implementation provably cannot pass
 * it — a `/field`-only impl misses the search-only id (count ≤ 99); a
 * `/field/search`-only impl misses the JPD id (count ≤ 108). Only the 125-shaped
 * union passes.
 *
 * Cases marked PROOF fail against a wrong (single-endpoint / short-list) impl.
 * Cases marked GUARD exist to catch over-correction.
 */

// --- id fixtures (no per-tenant magic number anywhere) ---------------------
const mkIds = (prefix: string, n: number, start: number): string[] =>
  Array.from({ length: n }, (_, i) => `${prefix}${start + i}`);

const SHARED_IDS = mkIds('customfield_110', 82, 0); // in BOTH endpoints (82)
const FIELD_ONLY_IDS = ['customfield_10060', ...mkIds('customfield_120', 16, 1)]; // /field only (17), scope PROJECT JPD
const SEARCH_ONLY_IDS = ['customfield_10014', ...mkIds('customfield_130', 25, 1)]; // /field/search only (26)
const SYSTEM_IDS = ['summary', ...mkIds('sysfield_', 43, 1)]; // custom===false (44)

// --- row builders ----------------------------------------------------------
function fieldOnlyRow(id: string, customId: number) {
  return {
    id,
    name: `JPD ${id}`,
    custom: true,
    schema: { type: 'string', custom: 'jira.polaris:rating', customId },
    scope: { type: 'PROJECT', project: { id: '10000' } },
  };
}
function sharedFieldRow(id: string, customId: number) {
  return {
    id,
    name: `Shared ${id}`,
    custom: true,
    schema: { type: 'string', custom: 'com.atlassian.jira.plugin.system.customfieldtypes:textfield', customId },
    scope: { type: 'GLOBAL' },
  };
}
function systemRow(id: string) {
  return { id, name: `System ${id}`, custom: false, schema: { type: 'string', system: id } };
}
/** A `/field/search` row: no `custom` boolean, no `scope`. */
function searchRow(id: string, customId: number) {
  return { id, name: `Search ${id}`, schema: { type: 'string', custom: 'com.example:type', customId } };
}

function buildFieldArray(): any[] {
  const rows: any[] = [];
  FIELD_ONLY_IDS.forEach((id, i) => rows.push(fieldOnlyRow(id, 20000 + i)));
  SHARED_IDS.forEach((id, i) => rows.push(sharedFieldRow(id, 11000 + i)));
  SYSTEM_IDS.forEach((id) => rows.push(systemRow(id)));
  return rows; // 17 + 82 + 44 = 143
}
function buildSearchCombined(): any[] {
  const rows: any[] = [];
  SHARED_IDS.forEach((id, i) => rows.push(searchRow(id, 11000 + i)));
  SEARCH_ONLY_IDS.forEach((id, i) => rows.push(searchRow(id, 13000 + i)));
  return rows; // 82 + 26 = 108
}

function ok<T>(data: T) {
  return { success: true, data };
}
/** Page a combined array by a 50-row window keyed on the requested startAt. */
function searchPage(combined: any[], startAt: number, opts?: { total?: number; forceIsLast?: boolean }) {
  const slice = combined.slice(startAt, startAt + 50);
  const total = opts?.total ?? combined.length;
  const isLast = opts?.forceIsLast ?? startAt + slice.length >= combined.length;
  return ok({ values: slice, total, isLast, startAt, maxResults: 50 });
}

function makeClient(impl: (config: any) => any): JiraApiClient {
  const makeRequest = jest.fn(impl);
  return { makeRequest } as unknown as JiraApiClient;
}

describe('enumerateCustomFields — union primitive', () => {
  let fieldArray: any[];
  let searchCombined: any[];

  beforeEach(() => {
    fieldArray = buildFieldArray();
    searchCombined = buildSearchCombined();
  });

  it('PROOF union_present: union carries BOTH a /field-only JPD id AND a /field/search-only id → count 125', async () => {
    const client = makeClient((config: any) => {
      if (config.path === '/field') return ok(fieldArray);
      if (config.path === '/field/search') return searchPage(searchCombined, config.params.startAt);
      throw new Error(`unexpected path ${config.path}`);
    });

    const e = await enumerateCustomFields(client);

    // 17 field-only + 82 shared + 26 search-only.
    expect(e.count).toBe(125);
    expect(e.byId.size).toBe(125);
    expect(e.complete).toBe(true);

    // The two ids a single-endpoint impl cannot both produce.
    expect(e.byId.has('customfield_10060')).toBe(true); // /field only
    expect(e.byId.has('customfield_10014')).toBe(true); // /field/search only
    expect(e.byId.get('customfield_10060')!.source).toBe('field');
    expect(e.byId.get('customfield_10014')!.source).toBe('field-search');
    // A field seen by both endpoints is tagged 'both'.
    expect(e.byId.get(SHARED_IDS[0])!.source).toBe('both');

    expect(e.sources.field.custom).toBe(99);
    expect(e.sources.field.system).toBe(44);
    expect(e.sources.fieldSearch.total).toBe(108);
    expect(e.sources.fieldSearch.reachedIsLast).toBe(true);
    expect(e.sources.fieldSearch.pages).toBe(3); // 50 + 50 + 8
  });

  it('PROOF systemFieldIds populated from custom===false (44), independent of the custom union', async () => {
    const client = makeClient((config: any) => {
      if (config.path === '/field') return ok(fieldArray);
      if (config.path === '/field/search') return searchPage(searchCombined, config.params.startAt);
      throw new Error(`unexpected path ${config.path}`);
    });

    const e = await enumerateCustomFields(client);

    expect(e.systemFieldIds.size).toBe(44);
    expect(e.systemFieldIds.has('summary')).toBe(true);
    // A system id is never in the custom union.
    expect(e.byId.has('summary')).toBe(false);
  });

  it('PROOF jpd_in_union: the /field-only JPD record carries scope + schema signal', async () => {
    const client = makeClient((config: any) => {
      if (config.path === '/field') return ok(fieldArray);
      if (config.path === '/field/search') return searchPage(searchCombined, config.params.startAt);
      throw new Error(`unexpected path ${config.path}`);
    });

    const e = await enumerateCustomFields(client);
    const rec = e.byId.get('customfield_10060')!;

    expect(rec.source).toBe('field');
    expect(rec.scopeType).toBe('PROJECT');
    expect(rec.scopeProjectId).toBe('10000');
    expect(rec.schemaCustom?.startsWith('jira.polaris:')).toBe(true);
  });

  it('PROOF stride_by_actual_rows: the second /field/search call uses startAt = rows received (50), not 100', async () => {
    const makeRequest = jest.fn((config: any) => {
      if (config.path === '/field') return ok([]);
      if (config.path === '/field/search') {
        const startAt = config.params.startAt;
        if (startAt === 0) {
          return ok({ values: mkIds('customfield_20', 50, 0).map((id, i) => searchRow(id, i)), total: 60, isLast: false, maxResults: 50 });
        }
        return ok({ values: mkIds('customfield_21', 10, 0).map((id, i) => searchRow(id, i)), total: 60, isLast: true, maxResults: 50 });
      }
      throw new Error(`unexpected path ${config.path}`);
    });
    const client = { makeRequest } as unknown as JiraApiClient;

    await enumerateCustomFields(client);

    const searchCalls = makeRequest.mock.calls
      .map((c: any[]) => c[0])
      .filter((cfg: any) => cfg.path === '/field/search');
    expect(searchCalls.length).toBe(2);
    expect(searchCalls[0].params.startAt).toBe(0);
    expect(searchCalls[1].params.startAt).toBe(50); // rows received, NOT 100
    // params must be a plain object, never URLSearchParams.
    expect(searchCalls[1].params instanceof URLSearchParams).toBe(false);
    expect(searchCalls[1].params.type).toBe('custom');
  });

  it('PROOF incomplete_gate: a page throw forbids any negative verdict (UNVERIFIABLE, never SYSTEM/NOT_FOUND)', async () => {
    const client = makeClient((config: any) => {
      if (config.path === '/field') return ok(fieldArray); // system set known
      if (config.path === '/field/search') {
        if (config.params.startAt === 0) {
          return searchPage(searchCombined, 0, { total: 108, forceIsLast: false });
        }
        throw new JiraApiError('SERVER_ERROR', 'boom mid-walk');
      }
      throw new Error(`unexpected path ${config.path}`);
    });

    const e = await enumerateCustomFields(client);

    expect(e.complete).toBe(false);
    expect(e.sources.fieldSearch.ok).toBe(false);

    // 'summary' IS in the system set, but !complete must win → UNVERIFIABLE.
    expect(classifyFieldId(e, 'summary')).toEqual({ custom: false, verdict: 'UNVERIFIABLE' });
    // A totally unknown id is likewise UNVERIFIABLE, never FIELD_NOT_FOUND.
    expect(classifyFieldId(e, 'customfield_99999')).toEqual({ custom: false, verdict: 'UNVERIFIABLE' });
  });

  it('PROOF field_endpoint_down: /field throws → field.ok false, complete false; search customs still classify custom:true', async () => {
    const client = makeClient((config: any) => {
      if (config.path === '/field') throw new JiraApiError('SERVER_ERROR', '/field down');
      if (config.path === '/field/search') return searchPage(searchCombined, config.params.startAt);
      throw new Error(`unexpected path ${config.path}`);
    });

    const e = await enumerateCustomFields(client);

    expect(e.sources.field.ok).toBe(false);
    expect(e.complete).toBe(false);
    // A custom in the search set is authoritatively custom.
    expect(classifyFieldId(e, 'customfield_10014')).toMatchObject({ custom: true });
    // But an unknown id cannot be judged system/not-found without /field.
    expect(classifyFieldId(e, 'customfield_99999')).toEqual({ custom: false, verdict: 'UNVERIFIABLE' });
  });

  it('PROOF page_cap: hitting FIELD_SEARCH_MAX_PAGES warns and sets complete:false — never throws', async () => {
    let searchCalls = 0;
    const client = makeClient((config: any) => {
      if (config.path === '/field') return ok(fieldArray.slice(0, 2)); // small valid array
      if (config.path === '/field/search') {
        searchCalls++;
        // Never isLast, no total → the walk can only stop at the page cap.
        return ok({ values: [searchRow(`customfield_9${config.params.startAt}`, config.params.startAt)], isLast: false, maxResults: 50 });
      }
      throw new Error(`unexpected path ${config.path}`);
    });

    const e = await enumerateCustomFields(client); // must resolve, not throw

    expect(e.complete).toBe(false);
    expect(e.sources.fieldSearch.reachedIsLast).toBe(false);
    expect(e.sources.fieldSearch.pages).toBe(__fieldEnumeration.FIELD_SEARCH_MAX_PAGES);
    expect(searchCalls).toBe(__fieldEnumeration.FIELD_SEARCH_MAX_PAGES);
    expect(e.warnings.some((w) => w.includes('page cap'))).toBe(true);
  });

  it('PROOF self_check_generic: a complete walk with count < total pushes a diagnostic warning', async () => {
    const client = makeClient((config: any) => {
      if (config.path === '/field') return ok([]); // no /field customs
      if (config.path === '/field/search') {
        // isLast true but total claims more than we returned → self-check fires.
        return ok({ values: SEARCH_ONLY_IDS.map((id, i) => searchRow(id, i)), total: 130, isLast: true, maxResults: 50 });
      }
      throw new Error(`unexpected path ${config.path}`);
    });

    const e = await enumerateCustomFields(client);

    expect(e.complete).toBe(true);
    expect(e.count).toBe(SEARCH_ONLY_IDS.length); // 26
    expect(e.warnings.some((w) => w.toLowerCase().includes('self-check') && w.includes('total'))).toBe(true);
  });

  it('PROOF no_literal_169: the shipped module contains no per-tenant magic number', () => {
    // Resolve from cwd (server dir when run locally, repo root under CI) — ts-jest
    // compiles these tests as CommonJS, so import.meta is unavailable.
    const candidates = [
      path.resolve(process.cwd(), 'src/api/field-enumeration.ts'),
      path.resolve(process.cwd(), 'servers/jira-fields-permissions/src/api/field-enumeration.ts'),
    ];
    const found = candidates.find(existsSync);
    expect(found).toBeDefined();
    const src = readFileSync(found as string, 'utf8');
    // The 125-vs-108-vs-99 reconciliation and the 125+44=169 external check live
    // only in the live checklist, never in shipped code.
    expect(src).not.toMatch(/169/);
  });

  it('GUARD genuine_empty: a complete walk with zero customs stays complete with count 0 (no false failure)', async () => {
    const client = makeClient((config: any) => {
      if (config.path === '/field') return ok([]); // only system-less empty
      if (config.path === '/field/search') return ok({ values: [], total: 0, isLast: true, maxResults: 50 });
      throw new Error(`unexpected path ${config.path}`);
    });

    const e = await enumerateCustomFields(client);

    expect(e.complete).toBe(true);
    expect(e.count).toBe(0);
    expect(e.warnings.length).toBe(0);
    // With complete===true and an empty system set, an unknown id is FIELD_NOT_FOUND.
    expect(classifyFieldId(e, 'customfield_99999')).toEqual({ custom: false, verdict: 'FIELD_NOT_FOUND' });
  });

  it('GUARD nonarray_field_body: a non-array /field body is undetermined, never an empty custom set', async () => {
    const client = makeClient((config: any) => {
      if (config.path === '/field') return ok({ oops: 'not-an-array' });
      if (config.path === '/field/search') return searchPage(searchCombined, config.params.startAt);
      throw new Error(`unexpected path ${config.path}`);
    });

    const e = await enumerateCustomFields(client);

    expect(e.sources.field.ok).toBe(false);
    expect(e.complete).toBe(false);
    // search-only customs still resolve, but the system set is unknown.
    expect(classifyFieldId(e, 'customfield_10014')).toMatchObject({ custom: true });
    expect(classifyFieldId(e, 'summary')).toEqual({ custom: false, verdict: 'UNVERIFIABLE' });
  });
});
