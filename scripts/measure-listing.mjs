#!/usr/bin/env node
/**
 * Measure the `tools/list` payload of every server, with deferred schema
 * loading off and on.
 *
 * This exists because the README used to claim a 60-75% reduction from a
 * feature that was not actually wired up: the schema-registry hook captured
 * schemas but passed the tool config to the SDK unmodified, so every listing
 * still carried every full inputSchema. The claim went unchallenged for months
 * because nothing measured it.
 *
 * So: no number about listing size goes in the docs unless this script printed
 * it. Run it and paste the table.
 *
 *   node scripts/measure-listing.mjs
 *   node scripts/measure-listing.mjs --json
 *
 * Requires `npm run build:all` first. Uses placeholder credentials -- listing
 * tools never touches the Atlassian API.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const SERVERS = [
  'jira-projects',
  'jira-workflows',
  'jira-fields-permissions',
  'jira-service-desk',
  'jira-organization',
  'jira-system-admin',
  'jira-product-discovery',
  'confluence',
];

const PLACEHOLDER_ENV = {
  ATLASSIAN_SITE_URL: 'https://example.atlassian.net',
  ATLASSIAN_USER_EMAIL: 'measure@example.com',
  ATLASSIAN_API_TOKEN: 'placeholder-not-used-for-listing',
  ATLASSIAN_ORG_ID: 'placeholder-org',
  ATLASSIAN_ORG_ADMIN_TOKEN: 'placeholder-not-used-for-listing',
  TRANSPORT: 'stdio',
};

function listTools(server, defer) {
  return new Promise((resolve) => {
    const entry = path.join(ROOT, 'servers', server, 'dist', 'index.js');
    if (!existsSync(entry)) {
      return resolve({ error: `not built: ${path.relative(ROOT, entry)} (run npm run build:all)` });
    }

    const child = spawn(process.execPath, [entry], {
      cwd: ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...PLACEHOLDER_ENV, MCP_DEFER_TOOL_SCHEMAS: String(defer) },
    });

    let buf = '';
    const pending = new Map();
    const done = (v) => { child.kill(); resolve(v); };
    const timer = setTimeout(() => done({ error: 'timeout' }), 30000);

    child.stdout.on('data', (d) => {
      buf += d.toString();
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line) continue;
        let msg;
        try { msg = JSON.parse(line); } catch { continue; }
        if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
      }
    });
    child.stderr.on('data', () => {});
    child.on('error', (e) => { clearTimeout(timer); done({ error: String(e) }); });

    const send = (id, method, params) => new Promise((res) => {
      pending.set(id, res);
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });

    (async () => {
      await send(1, 'initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'measure-listing', version: '1.0.0' },
      });
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
      const res = await send(2, 'tools/list', {});
      clearTimeout(timer);

      const tools = res.result?.tools ?? [];
      const withSchema = tools.filter((t) => {
        const p = t.inputSchema?.properties;
        return p && Object.keys(p).length > 0;
      }).length;

      done({
        bytes: Buffer.byteLength(JSON.stringify(res.result), 'utf8'),
        toolCount: tools.length,
        withSchema,
      });
    })();
  });
}

const asJson = process.argv.includes('--json');
const rows = [];
let offTotal = 0, onTotal = 0, toolTotal = 0, offSchemas = 0, onSchemas = 0;

for (const server of SERVERS) {
  const off = await listTools(server, false);
  const on = await listTools(server, true);
  if (off.error || on.error) {
    rows.push({ server, error: off.error || on.error });
    continue;
  }
  offTotal += off.bytes;
  onTotal += on.bytes;
  toolTotal += off.toolCount;
  offSchemas += off.withSchema;
  onSchemas += on.withSchema;
  rows.push({
    server,
    tools: off.toolCount,
    offBytes: off.bytes,
    onBytes: on.bytes,
    offWithSchema: off.withSchema,
    onWithSchema: on.withSchema,
    reductionPercent: +(((off.bytes - on.bytes) / off.bytes) * 100).toFixed(1),
  });
}

const totalReduction = offTotal ? +(((offTotal - onTotal) / offTotal) * 100).toFixed(1) : 0;

if (asJson) {
  console.log(JSON.stringify({
    rows, toolTotal, offTotal, onTotal, offSchemas, onSchemas, totalReduction,
  }, null, 2));
} else {
  const kb = (b) => (b / 1024).toFixed(1).padStart(7) + 'K';
  console.log('\ntools/list payload — deferred schema loading off vs on\n');
  console.log('server                       tools      off       on   reduction');
  console.log('-'.repeat(64));
  for (const r of rows) {
    if (r.error) { console.log(`${r.server.padEnd(26)} ERROR: ${r.error}`); continue; }
    console.log(
      `${r.server.padEnd(26)} ${String(r.tools).padStart(5)} ${kb(r.offBytes)} ${kb(r.onBytes)}   ${String(r.reductionPercent).padStart(5)}%`
    );
  }
  console.log('-'.repeat(64));
  console.log(
    `${'TOTAL'.padEnd(26)} ${String(toolTotal).padStart(5)} ${kb(offTotal)} ${kb(onTotal)}   ${String(totalReduction).padStart(5)}%`
  );
  console.log(`\ntools carrying a full inputSchema: ${offSchemas}/${toolTotal} off -> ${onSchemas}/${toolTotal} on`);
  console.log(`approx tokens: ${Math.round(offTotal / 4).toLocaleString()} -> ${Math.round(onTotal / 4).toLocaleString()}\n`);
}
