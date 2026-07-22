// PASS A implementer's own live characterisation probe. Read-only GETs.
// Prints NO credential values -- names and lengths only.
const email = process.env.ATLASSIAN_USER_EMAIL;
const token = process.env.ATLASSIAN_API_TOKEN;
const base = process.env.ATLASSIAN_SITE_URL;

console.log('cred presence: email set=' + Boolean(email) + ' len=' + (email ? email.length : 0) +
  ' | token set=' + Boolean(token) + ' len=' + (token ? token.length : 0) +
  ' | baseUrl set=' + Boolean(base));

const H = {
  Authorization: 'Basic ' + Buffer.from(email + ':' + token).toString('base64'),
  Accept: 'application/json',
};

async function j(url) {
  const r = await fetch(url, { headers: H });
  const text = await r.text();
  let body = null;
  try { body = JSON.parse(text); } catch { }
  return { status: r.status, body, raw: text.slice(0, 200) };
}

const myself = await j(base + '/rest/api/3/myself');
console.log('GET /rest/api/3/myself -> ' + myself.status + '   (only endpoint that proves auth)');
if (myself.status !== 200) process.exit(1);

const tenant = await j(base + '/_edge/tenant_info');
const cloudId = tenant.body && tenant.body.cloudId;
console.log('cloudId resolved=' + Boolean(cloudId) + ' len=' + (cloudId ? cloudId.length : 0));
const AUT = 'https://api.atlassian.com/automation/public/jira/' + cloudId + '/rest/v1';

async function walk(qs) {
  const ids = [];
  let url = AUT + '/template/search' + (qs ? '?' + qs : '');
  let pages = 0;
  while (url && pages++ < 40) {
    const r = await j(url);
    if (r.status !== 200) return { status: r.status, ids, pages, raw: r.raw };
    for (const t of (r.body && r.body.data) || []) ids.push(t.id);
    const nx = r.body && r.body.links && r.body.links.next;
    url = nx ? AUT + '/template/search' + nx : null;
  }
  return { status: 200, ids, pages };
}
function say(label, res) {
  console.log(label.padEnd(50) + ' status=' + res.status + ' rows=' + res.ids.length +
    ' unique=' + new Set(res.ids).size + ' pages=' + res.pages + ' first=' + (res.ids[0] || '-'));
  return res.ids;
}

console.log('\n=== full catalogue ===');
const all = say('walk: no params', await walk(''));

const p1 = await j(AUT + '/template/search');
console.log('single page: topKeys=' + Object.keys(p1.body || {}).join(',') +
  ' rows=' + ((p1.body && p1.body.data) || []).length +
  ' links.next=' + Boolean(p1.body && p1.body.links && p1.body.links.next));

console.log('\n=== ITEM 1a: is startAt honoured by the API? ===');
const A = ((await j(AUT + '/template/search?limit=5')).body.data || []).map(t => t.id);
const B = ((await j(AUT + '/template/search?limit=5&startAt=25')).body.data || []).map(t => t.id);
console.log('limit=5            -> ' + A.join(','));
console.log('limit=5&startAt=25 -> ' + B.join(','));
console.log('startAt HONOURED? ' + (JSON.stringify(A) !== JSON.stringify(B)));

console.log('\n=== ITEM 1b: is `category` (singular) honoured? ===');
const full = [];
{
  let url = AUT + '/template/search'; let g = 0;
  while (url && g++ < 40) {
    const r = await j(url);
    for (const t of (r.body && r.body.data) || []) full.push(t);
    const nx = r.body && r.body.links && r.body.links.next;
    url = nx ? AUT + '/template/search' + nx : null;
  }
}
const counts = {};
for (const t of full) for (const c of t.categories || []) counts[c.key] = (counts[c.key] || 0) + 1;
const keys = Object.entries(counts).sort((a, b) => b[1] - a[1]);
console.log('distinct category keys on this instance: ' + keys.length);
console.log('top keys: ' + keys.slice(0, 5).map(([k, n]) => k + '=' + n).join('  '));
const K = keys.find(([, n]) => n > 5 && n < full.length)[0];
console.log('probe key: ' + K + ' (client-side match set size ' + counts[K] + ')');

const catReal = say('walk: category=' + K, await walk('category=' + encodeURIComponent(K)));
const catBogus = say('walk: category=zzz-nope', await walk('category=zzz-nope'));
const ctrl = say('walk: bogusParam=1 (control)', await walk('bogusParam=1'));
console.log('category HONOURED? ' + (JSON.stringify(catReal) !== JSON.stringify(all)));
console.log('category indistinguishable from a bogus param? ' + (JSON.stringify(catReal) === JSON.stringify(ctrl)));

console.log('\n=== ITEM 1c: does `categories` (plural) filter? ===');
const catsReal = say('walk: categories=' + K, await walk('categories=' + encodeURIComponent(K)));
const expect = full.filter(t => (t.categories || []).some(c => c.key === K)).map(t => t.id);
console.log('categories HONOURED? ' + (catsReal.length !== all.length));
console.log('equals client-side match set (' + expect.length + ')? ' +
  (JSON.stringify([...catsReal].sort()) === JSON.stringify([...expect].sort())));

console.log('\n=== the axios array-serialisation landmine ===');
const brk = await j(AUT + '/template/search?categories%5B%5D=' + encodeURIComponent(K) + '&limit=50');
const bre = await j(AUT + '/template/search?categories=' + encodeURIComponent(K) + '&limit=50');
console.log('categories[]=<key>&limit=50 -> ' + brk.status + ' rows=' + (brk.body.data || []).length + '   <- what axios emits for an array');
console.log('categories=<key>&limit=50   -> ' + bre.status + ' rows=' + (bre.body.data || []).length + '   <- bare form');

console.log('\n=== unrecognised category key ===');
const nope = await j(AUT + '/template/search?categories=zzz-not-a-category');
console.log('categories=zzz-not-a-category -> ' + nope.status + ' rows=' + (nope.body.data || []).length + ' body=' + nope.raw);
const dispName = (full.find(t => (t.categories || []).length) || {}).categories[0].displayName;
const disp = await j(AUT + '/template/search?categories=' + encodeURIComponent(dispName));
console.log('categories=<displayName "' + dispName + '"> -> ' + disp.status + ' rows=' + (disp.body.data || []).length);

console.log('\n=== cursor round trip ===');
const c1 = await j(AUT + '/template/search?limit=3');
const c1ids = (c1.body.data || []).map(t => t.id);
const nx = c1.body.links.next;
const c2 = await j(AUT + '/template/search' + nx);
console.log('page1=' + c1ids.join(',') + ' | page2=' + (c2.body.data || []).map(t => t.id).join(','));

console.log('\n=== ITEM 4: /rest/api/3/screenscheme ===');
const ss = await j(base + '/rest/api/3/screenscheme?maxResults=100');
const rows = (ss.body && ss.body.values) || [];
console.log('total=' + ss.body.total + ' isLast=' + ss.body.isLast + ' returned=' + rows.length);
const ops = new Set(); let missing = 0, empty = 0, nonNum = 0; const shapes = {};
for (const r of rows) {
  if (!r.screens || typeof r.screens !== 'object') { missing++; continue; }
  const ks = Object.keys(r.screens);
  if (!ks.length) empty++;
  for (const k of ks) { ops.add(k); if (typeof r.screens[k] !== 'number') nonNum++; }
  const sig = [...ks].sort().join('+');
  shapes[sig] = (shapes[sig] || 0) + 1;
}
console.log('op keys: ' + [...ops].sort().join(','));
console.log('rows missing screens=' + missing + ' empty=' + empty + ' nonNumericValues=' + nonNum);
console.log('shape histogram: ' + JSON.stringify(shapes));
console.log('row property keys: ' + JSON.stringify([...new Set(rows.flatMap(r => Object.keys(r)))]));
console.log('samples: ' + JSON.stringify(rows.slice(0, 4).map(r => ({ id: r.id, screens: r.screens }))));
