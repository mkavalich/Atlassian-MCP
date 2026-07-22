#!/usr/bin/env node
/**
 * Probe for get_my_permissions (Pass B follow-up item 3).
 *
 * Establishes the LIVE shape of GET /rest/api/3/mypermissions so the handler in
 * src/tools/permissions.ts can be narrowed to the real documented envelope and
 * fail loud on anything else, instead of passing the raw body through as
 * `permissions` under success:true.
 *
 * SAFETY: prints only HTTP status codes and STRUCTURE (top-level key names,
 * typeof, Array.isArray, entry counts, and the field-name set of ONE sample
 * entry). It never prints credential values, nor the havePermission booleans /
 * which permissions the caller actually holds.
 *
 * Run inside the container (creds come from its env):
 *   docker cp probe-mypermissions.mjs jira-fields-permissions-mcp:/tmp/
 *   docker exec jira-fields-permissions-mcp node /tmp/probe-mypermissions.mjs
 */

const site = (process.env.ATLASSIAN_SITE_URL || '').replace(/\/$/, '');
const email = process.env.ATLASSIAN_USER_EMAIL || '';
const token = process.env.ATLASSIAN_API_TOKEN || '';

if (!site || !email || !token) {
  console.error('missing one of ATLASSIAN_SITE_URL / ATLASSIAN_USER_EMAIL / ATLASSIAN_API_TOKEN');
  process.exit(2);
}

const auth = 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64');

function shape(x) {
  if (x === null) return 'null';
  if (Array.isArray(x)) return `array(len=${x.length})`;
  return typeof x;
}

async function probe(label, query) {
  const url = `${site}/rest/api/3/mypermissions${query ? `?${query}` : ''}`;
  let res, bodyText;
  try {
    res = await fetch(url, { headers: { Authorization: auth, Accept: 'application/json' } });
    bodyText = await res.text();
  } catch (e) {
    console.log(`\n[${label}] network error: ${e.message}`);
    return;
  }
  console.log(`\n[${label}] query=${query || '(none)'}`);
  console.log(`  HTTP ${res.status}`);
  let body;
  try {
    body = JSON.parse(bodyText);
  } catch {
    console.log(`  body is not JSON (first 120 chars of length ${bodyText.length}): ${bodyText.slice(0, 120)}`);
    return;
  }
  const topKeys = body && typeof body === 'object' && !Array.isArray(body) ? Object.keys(body) : [];
  console.log(`  top-level type: ${shape(body)}`);
  console.log(`  top-level keys: ${topKeys.length ? topKeys.join(', ') : '(none)'}`);
  if (body && typeof body === 'object' && 'permissions' in body) {
    const p = body.permissions;
    console.log(`  .permissions type: ${shape(p)}`);
    if (p && typeof p === 'object' && !Array.isArray(p)) {
      const keys = Object.keys(p);
      console.log(`  .permissions is an OBJECT MAP with ${keys.length} entries`);
      if (keys.length) {
        const sample = p[keys[0]];
        const fields = sample && typeof sample === 'object' ? Object.keys(sample).sort() : [];
        console.log(`  sample entry field names (structure only): ${fields.join(', ')}`);
      }
    }
  } else {
    console.log('  no top-level "permissions" property present');
  }
}

// 1) No params -- v3 /mypermissions requires an explicit permissions list; this
//    documents what the API does when the tool is called with nothing.
// 2) With a permissions list of well-known global+project keys -- the normal
//    successful path.
await probe('no-params', '');
await probe('with-permissions', 'permissions=BROWSE_PROJECTS,ADMINISTER,CREATE_ISSUES,ADMINISTER_PROJECTS');
