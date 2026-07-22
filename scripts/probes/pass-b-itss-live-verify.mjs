// PASS B (PR2 / Tool 3) live verification: the three ITSS read tools, driven
// THROUGH the running jira-workflows container over MCP StreamableHTTP at
// POST /mcp (127.0.0.1:4002). Talking to the published port means the running
// container image answers -- not local source, not a stale dist. Rebuild and
// force-recreate the container before running.
//
// Prints no credential values (the tool authenticates with the container's env).
// Reports status / shape / counts only. Mirrors scripts/probes/pass-a-live-verify.mjs.
const PORT = 4002; // jira-workflows

let nextId = 1;
async function rpcOne(method, params) {
  const res = await fetch(`http://127.0.0.1:${PORT}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: nextId++, method, params }),
  });
  const raw = await res.text();
  try { return JSON.parse(raw); } catch {}
  const line = raw.split('\n').find((l) => l.startsWith('data: '));
  if (line) { try { return JSON.parse(line.slice(6)); } catch {} }
  return { _raw: raw.slice(0, 400), _status: res.status };
}
const callTool = (name, args = {}) => rpcOne('tools/call', { name, arguments: args });
// Force responseFormat:'detailed' so the payload is raw JSON (the concise default
// is TOON-formatted text).
const jsonCall = (name, args = {}) => callTool(name, { ...args, responseFormat: 'detailed' });
function text(m) { try { return m.result.content[0].text; } catch { return JSON.stringify(m.error || m).slice(0, 600); } }
function j(m) { try { return JSON.parse(text(m)); } catch { return null; } }

console.log('=========== tools/list: the three new ITSS tools registered ===========');
{
  const m = await rpcOne('tools/list', {});
  const tools = (m.result && m.result.tools) || [];
  const names = new Set(tools.map((t) => t.name));
  const want = ['get_issue_type_screen_schemes', 'get_project_issue_type_screen_scheme', 'get_issue_type_screen_scheme_mappings'];
  console.log('total tools on jira-workflows = ' + tools.length);
  for (const w of want) console.log('  ' + w.padEnd(42) + (names.has(w) ? 'PRESENT' : 'MISSING !!'));
}

console.log('\n=========== §7 row 7: 3a get_issue_type_screen_schemes (list all) ===========');
{
  const r = j(await jsonCall('get_issue_type_screen_schemes', {}));
  console.log('success=' + r.success + ' isLast=' + r.isLast + ' total=' + r.total + ' count=' + r.count);
  console.log('has Default id "1"? ' + (r.schemes || []).some((s) => String(s.id) === '1'));
  console.log('sample ids: ' + (r.schemes || []).slice(0, 12).map((s) => s.id).join(','));
}

console.log('\n=========== §7 row 7 (cont): 3b DSMNT project 10331 -> assigned:true, ITSS 10331 ===========');
{
  const r = j(await jsonCall('get_project_issue_type_screen_scheme', { projectId: '10331' }));
  console.log('success=' + r.success + ' assigned=' + r.assigned + ' issueTypeScreenSchemeId=' + r.issueTypeScreenSchemeId);
}

console.log('\n=========== §7 row 8: 3c mappings filter 10331 -> 8 rows incl {default -> 10436} ===========');
{
  const r = j(await jsonCall('get_issue_type_screen_scheme_mappings', { issueTypeScreenSchemeId: ['10331'] }));
  console.log('success=' + r.success + ' isLast=' + r.isLast + ' count=' + r.count + ' total=' + r.total);
  const def = (r.mappings || []).find((m) => m.issueTypeId === 'default');
  console.log('default catch-all row: ' + JSON.stringify(def));
  console.log('all rows for 10331? ' + (r.mappings || []).every((m) => m.issueTypeScreenSchemeId === '10331'));
}

console.log('\n=========== §7 row 9: 3b MDP project 10000 (JPD) -> honest no-ITSS, walk complete ===========');
{
  const r = j(await jsonCall('get_project_issue_type_screen_scheme', { projectId: '10000' }));
  console.log('success=' + r.success + ' assigned=' + r.assigned + ' usesDefaultItss=' + r.usesDefaultItss);
  console.log('note: ' + String(r.note || '(none)'));
}

console.log('\n=========== §7 row 10: 3b no projectId -> validation error, NOT an empty result ===========');
{
  const m = await jsonCall('get_project_issue_type_screen_scheme', {});
  const raw = text(m);
  const parsed = j(m);
  const isValidationError = /validation error/i.test(raw) || (parsed && parsed.success === false);
  console.log('isError=' + (m.result && m.result.isError) + ' isValidationError=' + isValidationError);
  console.log('  detail: ' + raw.replace(/\s+/g, ' ').slice(0, 140));
  console.log('  fabricated {assigned:false}/usesDefaultItss? ' + Boolean(parsed && (parsed.assigned === false || parsed.usesDefaultItss)));
}

console.log('\n=========== fail-closed sanity: 3c unfiltered total (all schemes) ===========');
{
  const r = j(await jsonCall('get_issue_type_screen_scheme_mappings', {}));
  console.log('success=' + r.success + ' isLast=' + r.isLast + ' count=' + r.count + ' total=' + r.total);
}
