// PASS A live verification + ground-truth regression sweep.
//
// Each server exposes MCP over StreamableHTTP at POST /mcp (enableJsonResponse)
// on a port published to 127.0.0.1. Talking to the published port means the
// RUNNING CONTAINER IMAGE answers -- not local source, not a stale dist.
// Containers were rebuilt and force-recreated before this ran.
//
// Prints no credential values.
const PORTS = {
  'jira-projects': 4001,
  'jira-workflows': 4002,
  'jira-fields-permissions': 4003,
  'jira-service-desk': 4004,
  'jira-organization': 4005,
  'jira-system-admin': 4006,
  'jira-product-discovery': 4007,
  confluence: 4008,
};

let nextId = 1;
async function rpcOne(server, method, params) {
  const res = await fetch(`http://127.0.0.1:${PORTS[server]}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: nextId++, method, params }),
  });
  const raw = await res.text();
  try { return JSON.parse(raw); } catch { }
  const line = raw.split('\n').find((l) => l.startsWith('data: '));
  if (line) { try { return JSON.parse(line.slice(6)); } catch { } }
  return { _raw: raw.slice(0, 400), _status: res.status };
}

const callTool = (server, name, args = {}) => rpcOne(server, 'tools/call', { name, arguments: args });
// jsonCall forces responseFormat:'detailed' so the payload is raw JSON. The
// concise default is TOON-formatted text and is exercised separately, on
// purpose, because that rendered layer is what item 4 was failing at.
const jsonCall = (server, name, args = {}) => callTool(server, name, { ...args, responseFormat: 'detailed' });

function text(m) {
  if (!m) return '(NO RESPONSE)';
  try { return m.result.content[0].text; } catch { return JSON.stringify(m.error || m).slice(0, 600); }
}
function j(m) { try { return JSON.parse(text(m)); } catch { return null; } }
function dump(label, m, max = 1200) {
  const t = text(m);
  console.log('\n--- ' + label + ' ---');
  console.log(t.length > max ? t.slice(0, max) + '\n  ...[truncated]' : t);
}

console.log('=========== ITEM 1: get_automation_templates ===========');

const dflt = j(await jsonCall('jira-workflows', 'get_automation_templates', {}));
console.log(`\n{}  -> success=${dflt.success} count=${dflt.count} hasMore=${dflt.hasMore} nextCursor=${dflt.nextCursor ? '(present)' : null} hasTotalKey=${'total' in dflt}`);

dump('startAt:25  MUST BE REJECTED', await callTool('jira-workflows', 'get_automation_templates', { startAt: 25 }));
dump('category:"jira.rovo"  MUST BE REJECTED', await callTool('jira-workflows', 'get_automation_templates', { category: 'jira.rovo' }));
dump('categories:["a","b"]  MUST BE REJECTED', await callTool('jira-workflows', 'get_automation_templates', { categories: ['jira.rovo', 'jira.design'] }));

for (const key of ['jsm.team-type.information-technology', 'jira-software.organize-tasks', 'jira.rovo']) {
  const r = j(await jsonCall('jira-workflows', 'get_automation_templates', { categories: key, maxResults: 100 }));
  console.log(`\ncategories:"${key}" -> success=${r.success} count=${r.count} categoryKeyRecognized=${r.categoryKeyRecognized} hasMore=${r.hasMore}`);
}
for (const key of ['zzz-not-a-category', 'Rovo AI Agents']) {
  const r = j(await jsonCall('jira-workflows', 'get_automation_templates', { categories: key }));
  console.log(`\ncategories:"${key}" -> success=${r.success} count=${r.count} categoryKeyRecognized=${r.categoryKeyRecognized}`);
  console.log('  guidance: ' + String(r.usage_guidance || '(none)').slice(0, 170) + '...');
}

const p1 = j(await jsonCall('jira-workflows', 'get_automation_templates', { maxResults: 3 }));
console.log('\ncursor round trip:');
console.log('  maxResults:3 page1 ids=' + p1.templates.map((t) => t.id).join(','));
const p2 = j(await jsonCall('jira-workflows', 'get_automation_templates', { maxResults: 3, cursor: p1.nextCursor }));
console.log('  cursor fed back  ids=' + p2.templates.map((t) => t.id).join(','));
console.log('  cursor ADVANCED? ' + (p1.templates[0].id !== p2.templates[0].id));

{
  let cursor = null, rows = 0, ids = new Set(), guard = 0;
  do {
    const r = j(await jsonCall('jira-workflows', 'get_automation_templates', cursor ? { maxResults: 100, cursor } : { maxResults: 100 }));
    for (const t of r.templates) ids.add(t.id);
    rows += r.count;
    cursor = r.hasMore ? r.nextCursor : null;
  } while (cursor && guard++ < 25);
  console.log('\nfull cursor walk THROUGH THE TOOL: rows=' + rows + ' unique ids=' + ids.size);
}

console.log('\n\n=========== ITEM 4: get_screen_schemes ===========');
console.log('\n--- DEFAULT (concise) RENDERED output, the layer that was failing ---');
console.log(text(await callTool('jira-workflows', 'get_screen_schemes', {})));

{
  const d = j(await jsonCall('jira-workflows', 'get_screen_schemes', { responseFormat: 'detailed' }));
  const find = (id) => (d.screenSchemes || []).find((x) => String(x.id) === id);
  console.log('\n--- detailed payload: scheme 10135 (default+create) ---');
  console.log(JSON.stringify(find('10135'), null, 1));
  console.log('--- detailed payload: scheme 1 (default only) ---');
  console.log(JSON.stringify(find('1'), null, 1));
  console.log('--- detailed payload: scheme 10437 (all four ops) ---');
  console.log(JSON.stringify(find('10437'), null, 1));
  console.log('\ncount=' + d.count + ' pagination.total=' + d.pagination.total);
}

console.log('\n\n=========== ITEMS 2 & 3 (latent bug: live values must be UNCHANGED) ===========');
{
  const c = j(await jsonCall('jira-fields-permissions', 'get_custom_field_contexts', { fieldId: 'customfield_10409', responseFormat: 'detailed' }));
  console.log('get_custom_field_contexts customfield_10409 -> success=' + c.success + ' count=' + c.count + ' pagination.total=' + c.pagination.total);
  const p = j(await jsonCall('jira-fields-permissions', 'get_permission_schemes', { responseFormat: 'detailed' }));
  console.log('get_permission_schemes                     -> success=' + p.success + ' count=' + p.count);
}

console.log('\n\n=========== GROUND-TRUTH REGRESSION SWEEP (actual observed) ===========');
const pick = (o, ...keys) => { for (const k of keys) { if (o && o[k] !== undefined) return o[k]; } return '(absent)'; };
{
  const f = j(await jsonCall('jira-fields-permissions', 'get_fields_paginated', { responseFormat: 'detailed' }));
  console.log('get_fields_paginated                 total=' + pick(f, 'total') + (f.pagination ? ' pagination.total=' + f.pagination.total : ''));
  const fc = j(await jsonCall('jira-fields-permissions', 'get_fields_paginated', { type: ['custom'], responseFormat: 'detailed' }));
  console.log('get_fields_paginated type:[custom]    total=' + pick(fc, 'total') + (fc.pagination ? ' pagination.total=' + fc.pagination.total : ''));
  console.log('  pageBreakdown=' + JSON.stringify(fc.pageBreakdown));
  const fg = j(await jsonCall('jira-fields-permissions', 'get_field_configurations', { responseFormat: 'detailed' }));
  console.log('get_field_configurations             count=' + pick(fg, 'count') + ' total=' + (fg.pagination ? fg.pagination.total : pick(fg, 'total')));

  const w = j(await jsonCall('jira-workflows', 'get_workflows', { responseFormat: 'detailed' }));
  console.log('get_workflows                        count=' + pick(w, 'count') + ' total=' + (w.pagination ? w.pagination.total : pick(w, 'total')));
  const s = j(await jsonCall('jira-workflows', 'get_screens', { responseFormat: 'detailed' }));
  console.log('get_screens                          count=' + pick(s, 'count') + ' total=' + (s.pagination ? s.pagination.total : pick(s, 'total')));
  const ss = j(await jsonCall('jira-workflows', 'get_screen_schemes', { responseFormat: 'detailed' }));
  console.log('get_screen_schemes                   count=' + pick(ss, 'count') + ' total=' + ss.pagination.total);
  const ar = j(await jsonCall('jira-workflows', 'get_automation_rules', { responseFormat: 'detailed' }));
  console.log('get_automation_rules                 count=' + pick(ar, 'count') + ' hasTotalKey=' + ('total' in ar) + ' hasMore=' + ar.hasMore);

  const sl = j(await jsonCall('jira-system-admin', 'get_system_limits', { responseFormat: 'detailed' }));
  console.log('get_system_limits                    ' + JSON.stringify(sl).slice(0, 430));
  const gu = j(await jsonCall('jira-system-admin', 'get_site_user_groups', { responseFormat: 'detailed' }));
  console.log('get_site_user_groups                 count=' + pick(gu, 'count', 'total'));
  const sr = j(await jsonCall('jira-system-admin', 'generate_system_report', { responseFormat: 'detailed' }));
  const srs = JSON.stringify(sr);
  console.log('generate_system_report               ' +
    (srs.match(/"activeUsers":\s*\d+/) || ['activeUsers:(not found)'])[0] + ' | ' +
    (srs.match(/"appAccounts":\s*\d+/) || ['appAccounts:(not found)'])[0]);

  const gm = j(await jsonCall('jira-organization', 'get_user_group_memberships', { responseFormat: 'detailed' }));
  console.log('get_user_group_memberships           count=' + pick(gm, 'count', 'total'));
}

console.log('\n\n=========== SMOKE: all 8 servers ===========');
for (const name of Object.keys(PORTS)) {
  const m = await rpcOne(name, 'tools/list', {});
  const n = m && m.result && m.result.tools ? m.result.tools.length : 'FAILED ' + JSON.stringify(m).slice(0, 120);
  const h = await fetch(`http://127.0.0.1:${PORTS[name]}/health`).then((r) => r.status).catch(() => 'ERR');
  console.log('  ' + name.padEnd(26) + 'tools/list=' + String(n).padEnd(8) + ' /health=' + h);
}
