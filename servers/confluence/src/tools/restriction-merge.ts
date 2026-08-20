/**
 * Page restriction merge logic.
 *
 * Confluence's `PUT /content/{id}/restriction` replaces the page's ENTIRE
 * restriction set -- every operation, every principal. A caller that sends only
 * the principals it cares about therefore removes everyone else's access, and
 * a caller targeting `update` also drops all `read` restrictions.
 *
 * This module computes the full replacement payload from the page's current
 * state, so the write is always a deliberate read-modify-write rather than a
 * blind overwrite. It is a pure function specifically so the behaviour can be
 * tested without a live Confluence instance.
 */

export type RestrictionMode = 'add' | 'remove' | 'replace';
export type RestrictionOperation = 'read' | 'update';

/** A restriction entry as returned by GET /content/{id}/restriction. */
export interface ExistingRestriction {
  operation?: string;
  restrictions?: {
    user?: { results?: Array<{ accountId?: string }> };
    group?: { results?: Array<{ name?: string }> };
  };
}

/** A restriction entry as accepted by PUT /content/{id}/restriction. */
export interface RestrictionPayloadEntry {
  operation: string;
  restrictions: {
    user: Array<{ accountId: string }>;
    group: Array<{ name: string }>;
  };
}

export interface RestrictionUpdate {
  payload: RestrictionPayloadEntry[];
  resultingUsers: string[];
  resultingGroups: string[];
  preservedOperations: string[];
}

const accountIds = (entry?: ExistingRestriction): string[] =>
  (entry?.restrictions?.user?.results ?? [])
    .map((u) => u?.accountId)
    .filter((v): v is string => Boolean(v));

const groupNames = (entry?: ExistingRestriction): string[] =>
  (entry?.restrictions?.group?.results ?? [])
    .map((g) => g?.name)
    .filter((v): v is string => Boolean(v));

/**
 * Build the complete replacement payload for a restriction change.
 *
 * Restrictions on operations other than `operation` are always carried through
 * unchanged -- in every mode. Only the targeted operation is modified.
 */
export function computeRestrictionUpdate(
  existing: ExistingRestriction[],
  operation: RestrictionOperation,
  mode: RestrictionMode,
  users: string[] = [],
  groups: string[] = []
): RestrictionUpdate {
  const payload: RestrictionPayloadEntry[] = [];
  const preservedOperations: string[] = [];

  for (const entry of existing ?? []) {
    if (!entry || entry.operation === operation) continue;
    const u = accountIds(entry);
    const g = groupNames(entry);
    if (u.length === 0 && g.length === 0) continue;
    payload.push({
      operation: entry.operation as string,
      restrictions: {
        user: u.map((accountId) => ({ accountId })),
        group: g.map((name) => ({ name })),
      },
    });
    preservedOperations.push(entry.operation as string);
  }

  const currentEntry = (existing ?? []).find((e) => e?.operation === operation);
  const currentUsers = accountIds(currentEntry);
  const currentGroups = groupNames(currentEntry);

  let resultingUsers: string[];
  let resultingGroups: string[];

  if (mode === 'replace') {
    resultingUsers = [...new Set(users)];
    resultingGroups = [...new Set(groups)];
  } else if (mode === 'add') {
    resultingUsers = [...new Set([...currentUsers, ...users])];
    resultingGroups = [...new Set([...currentGroups, ...groups])];
  } else {
    const dropUsers = new Set(users);
    const dropGroups = new Set(groups);
    resultingUsers = currentUsers.filter((u) => !dropUsers.has(u));
    resultingGroups = currentGroups.filter((g) => !dropGroups.has(g));
  }

  if (resultingUsers.length > 0 || resultingGroups.length > 0) {
    // One entry per operation with the principals grouped. Pushing one entry
    // per principal -- the previous behaviour -- is not additive.
    payload.push({
      operation,
      restrictions: {
        user: resultingUsers.map((accountId) => ({ accountId })),
        group: resultingGroups.map((name) => ({ name })),
      },
    });
  }

  return { payload, resultingUsers, resultingGroups, preservedOperations };
}
