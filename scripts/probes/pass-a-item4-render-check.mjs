// ITEM 4 rendered-output check.
// Runs the REAL shared response formatter (packages/optimizations) over the
// REAL live /screenscheme payload, before and after the tool's flattening, at
// the DEFAULT `concise` format. The payload alone proves nothing -- the whole
// defect is that the formatter drops the nested `screens` object, so the fix
// must be verified at the layer that was failing.
import { readFileSync } from 'node:fs';
import { createResponseFormatterHook } from 'file:///E:/atlassian-mcp-fresh/packages/optimizations/dist/hooks/response-formatter.js';

const live = JSON.parse(readFileSync(process.argv[2], 'utf8').replace(/^﻿/, ''));
const rows = live.values;

// --- the flattening, mirrored from servers/jira-workflows/src/tools/screens.ts
const OPS = ['default', 'create', 'edit', 'view'];
function flatten(scheme) {
  const row = { ...scheme };
  const screens = scheme.screens;
  if (screens === null || screens === undefined || typeof screens !== 'object' || Array.isArray(screens)) {
    row.screenAssignments = 'unknown (no `screens` object returned for this scheme)';
    row.screenIds = null;
    return row;
  }
  const ids = {}; const nonScalar = []; const parts = [];
  const ordered = [
    ...OPS.filter((op) => op in screens),
    ...Object.keys(screens).filter((k) => !OPS.includes(k)),
  ];
  for (const op of ordered) {
    const v = screens[op];
    if (typeof v === 'number' || typeof v === 'string') { ids[op] = v; parts.push(`${op}=${v}`); }
    else nonScalar.push(op);
  }
  for (const op of OPS) if (!(op in ids) && !nonScalar.includes(op)) parts.push(`${op}->default`);
  row.screenAssignments = parts.length ? parts.join(' ') : '(none)';
  if (!('screenIds' in scheme)) row.screenIds = ids;
  if (nonScalar.length) row.nonScalarScreenOperations = nonScalar;
  return row;
}

const mk = (schemes) => ({
  content: [{ type: 'text', text: JSON.stringify({
    success: true,
    screenSchemes: schemes,
    pagination: { startAt: 0, maxResults: 50, total: live.total },
    count: schemes.length,
  }, null, 2) }],
});

const hook = createResponseFormatterHook({ defaultFormat: 'concise' });

const before = await hook.transformResponse('get_screen_schemes', mk(rows));
const after = await hook.transformResponse('get_screen_schemes', mk(rows.map(flatten)));

const text = (r) => r.content[0].text;

console.log('================ BEFORE (unfixed shape), concise ================');
console.log(text(before));
console.log('\n================ AFTER (flattened), concise =====================');
console.log(text(after));

console.log('\n================ VERDICT ================');
const a = text(after);
const linkVisible = a.includes('screenAssignments');
console.log('screenAssignments is a RENDERED column: ' + linkVisible);
// pick a multi-op scheme from the live data and check its mapping is legible
const multi = rows.find((r) => r.screens && Object.keys(r.screens).length > 1);
if (multi) {
  const f = flatten(multi);
  console.log('multi-op scheme id=' + multi.id + ' raw screens=' + JSON.stringify(multi.screens));
  console.log('  its screenAssignments = "' + f.screenAssignments + '"');
  console.log('  that exact string present in RENDERED output: ' + a.includes(f.screenAssignments));
}
console.log('BEFORE contained the word screens as a rendered column? ' + text(before).includes('screens'));
