/**
 * Regression tests for page restriction merging.
 *
 * The bug: `set_page_restrictions` sent only the principals named in the call
 * to `PUT /content/{id}/restriction`, which replaces the page's ENTIRE
 * restriction set. Adding one group therefore removed every existing grant,
 * and targeting `update` silently dropped all `read` restrictions. It also
 * pushed one payload entry per principal, which the API does not treat as
 * additive, so setting three users did not reliably grant three users.
 *
 * Every test below is written against the losing case.
 */

import { computeRestrictionUpdate } from '../../src/tools/restriction-merge.js';
import type { ExistingRestriction } from '../../src/tools/restriction-merge.js';

const existing: ExistingRestriction[] = [
  {
    operation: 'read',
    restrictions: {
      user: { results: [{ accountId: 'alice' }, { accountId: 'bob' }] },
      group: { results: [{ name: 'engineering' }] },
    },
  },
  {
    operation: 'update',
    restrictions: {
      user: { results: [{ accountId: 'carol' }] },
      group: { results: [{ name: 'admins' }] },
    },
  },
];

const entryFor = (u: ReturnType<typeof computeRestrictionUpdate>, op: string) =>
  u.payload.find((e) => e.operation === op);

describe('computeRestrictionUpdate — the data-loss cases', () => {
  it('add keeps the grants that were already there', () => {
    const u = computeRestrictionUpdate(existing, 'read', 'add', ['dave']);
    expect(u.resultingUsers.sort()).toEqual(['alice', 'bob', 'dave']);
    expect(u.resultingGroups).toEqual(['engineering']);
  });

  it('never touches the operation it was not asked about', () => {
    const u = computeRestrictionUpdate(existing, 'read', 'replace', ['dave']);
    const update = entryFor(u, 'update');
    expect(update).toBeDefined();
    expect(update!.restrictions.user).toEqual([{ accountId: 'carol' }]);
    expect(update!.restrictions.group).toEqual([{ name: 'admins' }]);
    expect(u.preservedOperations).toEqual(['update']);
  });

  it('remove drops only the named principal', () => {
    const u = computeRestrictionUpdate(existing, 'read', 'remove', ['bob']);
    expect(u.resultingUsers).toEqual(['alice']);
    expect(u.resultingGroups).toEqual(['engineering']);
  });

  it('remove of someone who was never granted is a no-op, not a wipe', () => {
    const u = computeRestrictionUpdate(existing, 'read', 'remove', ['nobody']);
    expect(u.resultingUsers.sort()).toEqual(['alice', 'bob']);
    expect(u.resultingGroups).toEqual(['engineering']);
  });

  it('replace does replace within the targeted operation', () => {
    const u = computeRestrictionUpdate(existing, 'read', 'replace', ['dave'], ['ops']);
    expect(u.resultingUsers).toEqual(['dave']);
    expect(u.resultingGroups).toEqual(['ops']);
  });
});

describe('computeRestrictionUpdate — payload shape', () => {
  it('emits ONE entry per operation with principals grouped', () => {
    const u = computeRestrictionUpdate(existing, 'read', 'replace', ['x', 'y', 'z']);
    const read = entryFor(u, 'read');
    expect(u.payload.filter((e) => e.operation === 'read')).toHaveLength(1);
    expect(read!.restrictions.user).toEqual([
      { accountId: 'x' },
      { accountId: 'y' },
      { accountId: 'z' },
    ]);
  });

  it('deduplicates rather than sending a principal twice', () => {
    const u = computeRestrictionUpdate(existing, 'read', 'add', ['alice', 'alice', 'dave']);
    expect(u.resultingUsers.sort()).toEqual(['alice', 'bob', 'dave']);
  });

  it('omits an operation entirely once it has no principals left', () => {
    const u = computeRestrictionUpdate(existing, 'update', 'remove', ['carol'], ['admins']);
    expect(entryFor(u, 'update')).toBeUndefined();
    expect(entryFor(u, 'read')).toBeDefined();
  });

  it('replace with no principals clears the targeted operation only', () => {
    const u = computeRestrictionUpdate(existing, 'read', 'replace', [], []);
    expect(entryFor(u, 'read')).toBeUndefined();
    expect(entryFor(u, 'update')).toBeDefined();
  });
});

describe('computeRestrictionUpdate — edge cases', () => {
  it('handles a page with no restrictions at all', () => {
    const u = computeRestrictionUpdate([], 'read', 'add', ['alice']);
    expect(u.resultingUsers).toEqual(['alice']);
    expect(u.payload).toHaveLength(1);
  });

  it('handles a malformed or empty existing entry without throwing', () => {
    const messy: ExistingRestriction[] = [
      { operation: 'read' },
      { operation: 'update', restrictions: { user: { results: [] }, group: { results: [] } } },
    ];
    const u = computeRestrictionUpdate(messy, 'read', 'add', ['alice']);
    expect(u.resultingUsers).toEqual(['alice']);
    // An existing operation carrying nobody is not worth preserving.
    expect(u.preservedOperations).toEqual([]);
  });

  it('drops principals with missing identifiers rather than emitting nulls', () => {
    const messy: ExistingRestriction[] = [
      {
        operation: 'read',
        restrictions: {
          user: { results: [{ accountId: 'alice' }, {}] },
          group: { results: [{ name: 'eng' }, {}] },
        },
      },
    ];
    const u = computeRestrictionUpdate(messy, 'read', 'add', []);
    expect(u.resultingUsers).toEqual(['alice']);
    expect(u.resultingGroups).toEqual(['eng']);
  });
});
