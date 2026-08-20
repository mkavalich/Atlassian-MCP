#!/usr/bin/env node
/**
 * Doc-count gate.
 *
 * Tool counts live in two places: the generated catalog (schemas/tools.json,
 * introspected from the servers themselves) and hand-written docs. The docs
 * drift, silently, and always downward -- the README badge sat at 275 for five
 * months after the tool count reached 280.
 *
 * This compares the hand-written numbers against the generated ones and fails
 * if they disagree. Run it immediately after `generate:tool-catalog` so the
 * catalog it reads is guaranteed fresh (see the `validate:all` script).
 *
 * Checks:
 *   - README badge          tools-<N>
 *   - README overview table  per-server rows + Total
 *   - llms.txt               summary line + tool-catalog reference
 *   - README badge           MCP SDK version vs the installed SDK
 *
 * Exit 0 = consistent. Exit 1 = drift, with a diff.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

const problems = [];
const note = (file, expected, actual, what) =>
  problems.push({ file, what, expected, actual });

// ---------------------------------------------------------------- source of truth

const catalogPath = join(ROOT, 'schemas', 'tools.json');
if (!existsSync(catalogPath)) {
  console.error('✖ schemas/tools.json not found. Run `npm run generate:tool-catalog` first.');
  process.exit(1);
}
const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));

const sizeOf = (tools) => {
  if (Array.isArray(tools)) return tools.length;
  if (tools && typeof tools === 'object') return Object.keys(tools).length;
  return null;
};

const perServer = new Map();
for (const [name, entry] of Object.entries(catalog.servers ?? {})) {
  // The generator writes an explicit toolCount alongside a `tools` map; prefer
  // it, but fall back to counting so a generator change doesn't silently pass.
  const counted = sizeOf(Array.isArray(entry) ? entry : entry?.tools);
  const declared = typeof entry?.toolCount === 'number' ? entry.toolCount : null;

  if (counted === null && declared === null) {
    console.error(`✖ Unexpected shape for server "${name}" in schemas/tools.json`);
    process.exit(1);
  }
  if (counted !== null && declared !== null && counted !== declared) {
    console.error(`✖ Catalog disagrees with itself for "${name}": toolCount=${declared}, tools has ${counted}.`);
    process.exit(1);
  }
  perServer.set(name, declared ?? counted);
}

const total = catalog.allTools?.length ?? [...perServer.values()].reduce((a, b) => a + b, 0);
const summed = [...perServer.values()].reduce((a, b) => a + b, 0);

if (summed !== total) {
  console.error(`✖ Catalog is internally inconsistent: allTools=${total} but per-server sums to ${summed}.`);
  process.exit(1);
}

// ---------------------------------------------------------------- README

const readme = read('README.md');

const badge = readme.match(/badge\/tools-(\d+)-/);
if (!badge) note('README.md', String(total), '<no tools badge found>', 'tools badge');
else if (Number(badge[1]) !== total) note('README.md', String(total), badge[1], 'tools badge');

for (const [server, count] of perServer) {
  const row = new RegExp(`^\\|\\s*\\*\\*${server}\\*\\*\\s*\\|\\s*(\\d+)\\s*\\|`, 'm');
  const m = readme.match(row);
  if (!m) note('README.md', String(count), '<row missing>', `overview row: ${server}`);
  else if (Number(m[1]) !== count) note('README.md', String(count), m[1], `overview row: ${server}`);
}

const totalRow = readme.match(/^\|\s*\*\*Total\*\*\s*\|\s*\*\*(\d+)\*\*\s*\|/m);
if (!totalRow) note('README.md', String(total), '<Total row missing>', 'overview total');
else if (Number(totalRow[1]) !== total) note('README.md', String(total), totalRow[1], 'overview total');

// ---------------------------------------------------------------- llms.txt

if (existsSync(join(ROOT, 'llms.txt'))) {
  const llms = read('llms.txt');
  for (const [label, re] of [
    ['summary line', /^>\s*(\d+)\s+MCP tools/m],
    ['tool-catalog reference', /Complete tool reference \((\d+) tools\)/],
  ]) {
    const m = llms.match(re);
    if (!m) note('llms.txt', String(total), '<not found>', label);
    else if (Number(m[1]) !== total) note('llms.txt', String(total), m[1], label);
  }
}

// ---------------------------------------------------------------- SDK badge

const sdkPkg = join(ROOT, 'node_modules', '@modelcontextprotocol', 'sdk', 'package.json');
if (existsSync(sdkPkg)) {
  const installed = JSON.parse(readFileSync(sdkPkg, 'utf8')).version;
  const m = readme.match(/badge\/MCP%20SDK-([\d.]+)-/);
  if (!m) note('README.md', installed, '<no SDK badge found>', 'MCP SDK badge');
  else if (m[1] !== installed) note('README.md', installed, m[1], 'MCP SDK badge');
} else {
  console.log('· MCP SDK not installed; skipping SDK badge check.');
}

// ---------------------------------------------------------------- report

if (problems.length === 0) {
  console.log(`✔ Doc counts consistent: ${total} tools across ${perServer.size} servers.`);
  process.exit(0);
}

console.error(`\n✖ ${problems.length} doc-count mismatch${problems.length === 1 ? '' : 'es'} against the generated catalog:\n`);
for (const p of problems) {
  console.error(`  ${p.file}  ${p.what}`);
  console.error(`    expected: ${p.expected}`);
  console.error(`    found:    ${p.actual}\n`);
}
console.error('The generated catalog is the source of truth. Update the docs to match,');
console.error('or regenerate the catalog with `npm run generate:tool-catalog` if the');
console.error('servers themselves changed.\n');
process.exit(1);
