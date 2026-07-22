import { JiraApiClient } from './client.js';

/**
 * FOUNDATION — the union custom-field enumeration primitive.
 *
 * This module cures a single defect class: a component silently truncates an
 * enumeration and returns a confident, successful-looking WRONG negative. The
 * reverted `get_field_project_mapping` enumerated custom fields from ONE
 * hard-capped 50-row page of `/field/search`, then told the caller that 58 of
 * 108 real custom fields "are not a custom field" under `success:true` —
 * byte-identical to its answer for a genuine system field.
 *
 * The structural cure lives here: ONE primitive that
 *   1. reads BOTH field endpoints (`/field` and `/field/search?type=custom`),
 *      each paginated to a real `isLast`/`total`, striding by rows RECEIVED,
 *   2. unions and dedupes them by id,
 *   3. exposes an explicit `complete:boolean`, and
 *   4. a `classifyFieldId` gate that FORBIDS any negative verdict unless
 *      `complete===true`.
 *
 * `/field` (a bare unpaginated array) carries the 17 project-scoped JPD fields
 * (`jira.polaris:*`) that `/field/search` excludes; `/field/search?type=custom`
 * carries 26 that `/field` omits. Neither endpoint alone is authoritative — only
 * their union is. On this DEV mirror the union is 125 distinct custom fields, but
 * NO per-tenant constant appears in this module: every count is derived, and any
 * custom-plus-system reconciliation against the Jira UI Fields screen lives only
 * in the live checklist, never here.
 *
 * Fail-closed at every step. `JiraApiClient.makeRequest` THROWS on non-2xx, so
 * every call is wrapped; a page throw or a non-array body sets the relevant
 * `ok:false` and forces `complete:false` — a short list is never presented as
 * complete. Hitting the page cap warns and sets `complete:false`; it never throws.
 */

/** `/field/search` hard-caps 50 rows/page regardless of the requested maxResults. */
const FIELD_SEARCH_PAGE_SIZE = 50;
/**
 * Hard stop for the `/field/search` walk. 200 pages ⇒ 10,000 custom fields.
 * Reaching it is reported (warning + `complete:false`), never silently accepted
 * and never thrown.
 */
const FIELD_SEARCH_MAX_PAGES = 200;

export interface CustomFieldRecord {
  id: string;
  name: string;
  source: 'field' | 'field-search' | 'both';
  /** From `/field` `scope.type`; null when the field is only in `/field/search`. */
  scopeType: 'PROJECT' | 'GLOBAL' | null;
  /** From `/field` `scope.project.id` (advisory hint). */
  scopeProjectId?: string;
  /** From `schema.custom`, e.g. `jira.polaris:rating` — the JPD signal. */
  schemaCustom?: string;
  schemaCustomId?: number;
}

export interface CustomFieldEnumeration {
  fields: CustomFieldRecord[];
  byId: Map<string, CustomFieldRecord>;
  /** = byId.size. */
  count: number;
  /** GATES every negative verdict. `field.ok && fieldSearch.ok && fieldSearch.reachedIsLast`. */
  complete: boolean;
  sources: {
    field: { ok: boolean; custom: number; system: number };
    fieldSearch: { ok: boolean; count: number; pages: number; total: number | null; reachedIsLast: boolean };
  };
  /** `/field` rows with `custom===false` — distinguishes SYSTEM_FIELD from FIELD_NOT_FOUND. */
  systemFieldIds: Set<string>;
  warnings: string[];
}

/** The minimal shape read from a `/field` or `/field/search` row. */
interface RawFieldRow {
  id?: string;
  name?: string;
  custom?: boolean;
  schema?: { type?: string; custom?: string; customId?: number };
  scope?: { type?: string; project?: { id?: string | number } };
}

function readScopeType(row: RawFieldRow): 'PROJECT' | 'GLOBAL' | null {
  const t = row.scope?.type;
  if (t === 'PROJECT') return 'PROJECT';
  if (t === 'GLOBAL') return 'GLOBAL';
  return null;
}

function readScopeProjectId(row: RawFieldRow): string | undefined {
  const id = row.scope?.project?.id;
  return id === undefined || id === null ? undefined : String(id);
}

function safeErrorMessage(error: unknown): string {
  // JiraApiError already sanitizes its message in the constructor.
  return error instanceof Error ? error.message : String(error);
}

/**
 * Read `/field` (bare array) and `/field/search?type=custom` (paginated),
 * union/dedupe by id, and return an enumeration whose `complete` flag gates
 * every downstream negative verdict.
 */
export async function enumerateCustomFields(apiClient: JiraApiClient): Promise<CustomFieldEnumeration> {
  const byId = new Map<string, CustomFieldRecord>();
  const systemFieldIds = new Set<string>();
  const warnings: string[] = [];

  const upsert = (row: RawFieldRow, from: 'field' | 'field-search'): void => {
    const id = row.id;
    if (typeof id !== 'string' || id.length === 0) return;
    const name = typeof row.name === 'string' ? row.name : id;
    const scopeType = readScopeType(row);
    const scopeProjectId = readScopeProjectId(row);
    const schemaCustom = typeof row.schema?.custom === 'string' ? row.schema.custom : undefined;
    const schemaCustomId = typeof row.schema?.customId === 'number' ? row.schema.customId : undefined;

    const existing = byId.get(id);
    if (!existing) {
      byId.set(id, { id, name, source: from, scopeType, scopeProjectId, schemaCustom, schemaCustomId });
      return;
    }
    // Same id seen from the other endpoint → it is in BOTH.
    if (existing.source !== from) existing.source = 'both';
    // Enrich only the fields the first sighting left blank; never overwrite.
    if (existing.scopeType === null && scopeType !== null) existing.scopeType = scopeType;
    if (existing.scopeProjectId === undefined && scopeProjectId !== undefined) existing.scopeProjectId = scopeProjectId;
    if (existing.schemaCustom === undefined && schemaCustom !== undefined) existing.schemaCustom = schemaCustom;
    if (existing.schemaCustomId === undefined && schemaCustomId !== undefined) existing.schemaCustomId = schemaCustomId;
  };

  // --- Step 1: GET /field once (bare array; no exposed ceiling) -------------
  let fieldOk = false;
  let fieldCustom = 0;
  let fieldSystem = 0;
  try {
    const res = await apiClient.makeRequest<RawFieldRow[]>({ method: 'GET', path: '/field' });
    const rows = res.data;
    if (Array.isArray(rows)) {
      fieldOk = true;
      for (const row of rows) {
        if (!row || typeof row.id !== 'string' || row.id.length === 0) continue;
        if (row.custom === true) {
          fieldCustom++;
          upsert(row, 'field');
        } else if (row.custom === false) {
          fieldSystem++;
          systemFieldIds.add(row.id);
        }
        // `custom` neither true nor false: not counted as custom OR system.
      }
    } else {
      // A degraded/non-array body is NEVER an empty custom set.
      warnings.push('/field returned a non-array body; the custom set is undetermined (complete:false).');
    }
  } catch (error) {
    warnings.push(`/field request failed: ${safeErrorMessage(error)} (complete:false).`);
  }

  // --- Step 2: walk GET /field/search?type=custom --------------------------
  let fieldSearchOk = true; // flips to false on a page throw / non-array body
  let reachedIsLast = false;
  let collected = 0;
  let pages = 0;
  let total: number | null = null;
  let startAt = 0;

  for (let page = 0; page < FIELD_SEARCH_MAX_PAGES; page++) {
    let body: { values?: RawFieldRow[]; total?: number; isLast?: boolean } | undefined;
    try {
      const res = await apiClient.makeRequest<{ values: RawFieldRow[]; total?: number; isLast?: boolean }>({
        method: 'GET',
        path: '/field/search',
        // Plain object, never URLSearchParams: the shared cache key is built from
        // Object.keys(params) and fails CLOSED (to one entry) on a non-enumerable
        // params object, which would serve one field's page for another's query.
        params: { startAt, maxResults: FIELD_SEARCH_PAGE_SIZE, type: 'custom' },
      });
      body = res.data;
    } catch (error) {
      warnings.push(`/field/search walk failed at startAt=${startAt}: ${safeErrorMessage(error)} (complete:false).`);
      fieldSearchOk = false;
      break;
    }

    const values = body?.values;
    if (!Array.isArray(values)) {
      warnings.push('/field/search returned a non-array `values` body; walk stopped (complete:false).');
      fieldSearchOk = false;
      break;
    }

    pages++;
    if (typeof body?.total === 'number') total = body.total;
    for (const row of values) upsert(row, 'field-search');
    collected += values.length;

    // Terminate on a real end signal — never on a short-but-non-final page.
    if (body?.isLast === true) { reachedIsLast = true; break; }
    if (total !== null && collected >= total) { reachedIsLast = true; break; }
    if (values.length === 0) { reachedIsLast = true; break; } // empty page = end

    // Advance by rows ACTUALLY received (server hard-caps + echoes 50); striding
    // by a requested maxResults would skip rows on any short-but-non-final page.
    startAt += values.length;
  }

  if (fieldSearchOk && !reachedIsLast) {
    // The loop ran to FIELD_SEARCH_MAX_PAGES without a terminal signal.
    warnings.push(
      `/field/search walk hit the page cap (${FIELD_SEARCH_MAX_PAGES} pages) before isLast/total; ` +
      'the enumeration is truncated (complete:false).'
    );
  }

  // --- Step 3 & 4: completeness -------------------------------------------
  const complete = fieldOk && fieldSearchOk && reachedIsLast;

  // --- Step 5: generic, scale-portable self-check (no per-tenant constant) --
  if (complete) {
    if (total !== null && byId.size < total) {
      warnings.push(
        `Self-check: union count ${byId.size} is below /field/search total ${total}; possible undercount.`
      );
    }
    if (byId.size < fieldCustom) {
      warnings.push(
        `Self-check: union count ${byId.size} is below /field custom count ${fieldCustom}; possible undercount.`
      );
    }
  }

  return {
    fields: [...byId.values()],
    byId,
    count: byId.size,
    complete,
    sources: {
      field: { ok: fieldOk, custom: fieldCustom, system: fieldSystem },
      fieldSearch: { ok: fieldSearchOk, count: collected, pages, total, reachedIsLast },
    },
    systemFieldIds,
    warnings,
  };
}

/** Exported for tests. */
export const __fieldEnumeration = { FIELD_SEARCH_PAGE_SIZE, FIELD_SEARCH_MAX_PAGES, enumerateCustomFields };

export type FieldClass =
  | { custom: true; record: CustomFieldRecord }
  | { custom: false; verdict: 'UNVERIFIABLE' | 'SYSTEM_FIELD' | 'FIELD_NOT_FOUND' };

/**
 * The structural guarantee: a negative verdict is IMPOSSIBLE on a partial walk.
 *
 *   - id in the union            → custom:true.
 *   - not in union, !complete     → UNVERIFIABLE (absence proves nothing here).
 *   - not in union, in system set → SYSTEM_FIELD.
 *   - not in union, complete      → FIELD_NOT_FOUND.
 *
 * A low count can never coincide with a confident negative — the exact
 * invariant that makes the reverted defect unrepeatable.
 */
export function classifyFieldId(e: CustomFieldEnumeration, id: string): FieldClass {
  const rec = e.byId.get(id);
  if (rec) return { custom: true, record: rec };
  if (!e.complete) return { custom: false, verdict: 'UNVERIFIABLE' };
  if (e.systemFieldIds.has(id)) return { custom: false, verdict: 'SYSTEM_FIELD' };
  return { custom: false, verdict: 'FIELD_NOT_FOUND' };
}
