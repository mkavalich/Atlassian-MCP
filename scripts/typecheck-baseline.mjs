#!/usr/bin/env node
/**
 * typecheck-baseline.mjs
 *
 * Records and enforces a per-workspace TypeScript error-count baseline.
 *
 * WHY THIS EXISTS
 * ---------------
 * servers/<name>/build.mjs runs esbuild (transpile only, no typecheck) and then
 * runs `tsc -p tsconfig.declarations.json` inside a try/catch that SWALLOWS
 * failure -- it prints "Declaration files generated (tsc exited with error but
 * files exist)" followed by "Build completed successfully!". A green build is
 * therefore NOT a passing typecheck. ts-jest does not fail on these either.
 * This tool is the explicit gate.
 *
 * SCOPE
 * -----
 * Baseline half only. It does NOT make build.mjs fail on tsc error, and it does
 * NOT require any pre-existing error to be fixed. It fails on an INCREASE in a
 * workspace's error count, and also on a NET-ZERO SWAP (same count, a different
 * error code introduced) so a strictNullChecks error cannot ride in behind a
 * removed benign one.
 *
 * CONFIG (was: KNOWN BLIND SPOT)
 * -----------------------------
 * Workspaces are measured with their STRICT tsconfig.json (see pickConfig), not
 * the lenient tsconfig.declarations.json that build.mjs emits with. The gate
 * therefore SEES the null/undefined defect class (strictNullChecks) that
 * produces fabricated zeros -- that is the whole point of the strict config. The
 * effective strict flags are recorded per workspace in the baseline file. Any
 * workspace whose full tsconfig opts out of strict would be blind there; confirm
 * via strictFlags (all are strict:true today).
 *
 * Note: both npm scripts build packages/* first, because every server resolves
 * @atlassian-mcp/optimizations and @atlassian-mcp/shared types from their emitted
 * dist/*.d.ts. Without that, a clean checkout has no dist and every server import
 * fails TS2307 -- an inflated count that is not a real regression.
 *
 * USAGE
 *   node scripts/typecheck-baseline.mjs --write   # record baseline
 *   node scripts/typecheck-baseline.mjs --check   # fail on increase
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_PATH = join(REPO_ROOT, 'typecheck-baseline.json');

/** Errors here are always fatal: we never guess, never default to 0. */
class HardFail extends Error {}

function die(msg) {
  console.error(`\nTYPECHECK GATE HARD FAIL\n  ${msg}\n`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Workspace discovery -- expanded from package.json "workspaces" globs on disk,
// never a hardcoded list. A workspace added later must not go silently
// unmeasured.
// ---------------------------------------------------------------------------
function discoverWorkspaces() {
  const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'));
  const globs = pkg.workspaces;
  if (!Array.isArray(globs) || globs.length === 0) {
    throw new HardFail('root package.json has no "workspaces" array');
  }
  const out = [];
  for (const g of globs) {
    if (!g.endsWith('/*')) {
      throw new HardFail(`unsupported workspace glob "${g}" (only "<dir>/*" is handled)`);
    }
    const parent = join(REPO_ROOT, g.slice(0, -2));
    if (!existsSync(parent)) {
      throw new HardFail(`workspace glob "${g}" points at a missing directory`);
    }
    for (const name of readdirSync(parent)) {
      const dir = join(parent, name);
      if (!statSync(dir).isDirectory()) continue;
      if (!existsSync(join(dir, 'package.json'))) continue;
      out.push(relative(REPO_ROOT, dir).split(sep).join('/'));
    }
  }
  return out.sort();
}

// ---------------------------------------------------------------------------
// tsc resolution -- explicit repo-local binary. Bare `npx tsc` can silently
// FETCH a different compiler from the registry, and error counts are
// compiler-version sensitive. A baseline compared under an unknown compiler is
// an authoritative-looking wrong answer.
// ---------------------------------------------------------------------------
function resolveTsc(workspaceDir) {
  const candidates = [
    join(workspaceDir, 'node_modules', 'typescript', 'bin', 'tsc'),
    join(REPO_ROOT, 'node_modules', 'typescript', 'bin', 'tsc'),
  ];
  for (const c of candidates) {
    if (existsSync(c)) {
      const pkgPath = join(dirname(dirname(c)), 'package.json');
      const version = JSON.parse(readFileSync(pkgPath, 'utf8')).version;
      return { bin: c, version };
    }
  }
  throw new HardFail(
    `no repo-local typescript found for ${workspaceDir}. ` +
      `Refusing to fall back to a registry fetch -- run "npm install" first.`
  );
}

function pickConfig(workspaceDir) {
  // Prefer the STRICT tsconfig.json. The gate MUST see the null/undefined defect
  // class (strictNullChecks) -- the fabricated-zero class this repo is being
  // cured of. tsconfig.declarations.json sets strict:false and is structurally
  // blind to it; it deliberately does NOT mirror build.mjs, which emits with the
  // lenient config. The declarations config is only a fallback for a workspace
  // that has no full tsconfig.json.
  if (existsSync(join(workspaceDir, 'tsconfig.json'))) return 'tsconfig.json';
  if (existsSync(join(workspaceDir, 'tsconfig.declarations.json'))) return 'tsconfig.declarations.json';
  throw new HardFail(`${workspaceDir} has neither tsconfig.json nor tsconfig.declarations.json`);
}

/** Read the effective strict-family flags so the gate's blind spot is on record. */
function effectiveFlags(workspaceDir, configName) {
  const seen = new Set();
  const merged = {};
  let current = join(workspaceDir, configName);
  while (current && !seen.has(current)) {
    seen.add(current);
    const raw = readFileSync(current, 'utf8').replace(/^\s*\/\/.*$/gm, '');
    const cfg = JSON.parse(raw);
    const co = cfg.compilerOptions || {};
    for (const k of ['strict', 'noImplicitAny', 'strictNullChecks']) {
      if (k in co && !(k in merged)) merged[k] = co[k];
    }
    current = cfg.extends ? resolve(dirname(current), cfg.extends) : null;
    if (current && !current.endsWith('.json')) current += '.json';
  }
  return merged;
}

const ERROR_LINE = /error TS\d+:/;

function runTsc(workspaceRel, { inPlace = false } = {}) {
  const workspaceDir = join(REPO_ROOT, workspaceRel);
  const config = pickConfig(workspaceDir);
  const { bin, version } = resolveTsc(workspaceDir);

  const args = ['-p', config];
  let scratch = null;
  if (!inPlace) {
    if (config === 'tsconfig.json') {
      // A full tsconfig typechecks cleanly with --noEmit, writing nothing.
      args.push('--noEmit');
    } else {
      // The declarations fallback sets emitDeclarationOnly, which forbids
      // --noEmit (TS5069); emit into a throwaway dir so dist/ is never touched.
      scratch = mkdtempSync(join(tmpdir(), 'tscbase-'));
      args.push('--outDir', scratch, '--declarationDir', scratch);
    }
  }

  const res = spawnSync(process.execPath, [bin, ...args], {
    cwd: workspaceDir,
    encoding: 'utf8',
    // Mirror build.mjs's memory setting; without it tsc can OOM on the largest
    // workspaces and the crash guard below would turn that into a false
    // regression signal.
    env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=8192' },
    timeout: 600000,
    maxBuffer: 64 * 1024 * 1024,
  });

  if (scratch) {
    try { rmSync(scratch, { recursive: true, force: true }); } catch { /* best effort */ }
  }

  if (res.error) {
    throw new HardFail(`${workspaceRel}: failed to spawn tsc -- ${res.error.message}`);
  }
  if (res.signal) {
    throw new HardFail(`${workspaceRel}: tsc killed by signal ${res.signal} (timeout or OOM)`);
  }

  const stdout = res.stdout || '';
  const stderr = res.stderr || '';
  const lines = (stdout + '\n' + stderr).split(/\r?\n/);
  const errorLines = lines.filter((l) => ERROR_LINE.test(l));
  const count = errorLines.length;
  const status = res.status;

  // THE GUARD THAT MATTERS MOST.
  // A tsc that fails to START emits zero "error TS" lines. Naive counting
  // reports 0 -> "no errors" -> green. That is the exact defect class this
  // tool exists to catch, so it must not be committed by the tool itself.
  if (status !== 0 && count === 0) {
    throw new HardFail(
      `${workspaceRel}: tsc exited ${status} but emitted NO parseable diagnostics. ` +
        `Refusing to record 0.\n--- stdout ---\n${stdout.slice(0, 2000)}\n--- stderr ---\n${stderr.slice(0, 2000)}`
    );
  }
  if (status === 0 && count > 0) {
    throw new HardFail(
      `${workspaceRel}: tsc exited 0 yet emitted ${count} "error TS" lines. ` +
        `Contradiction -- refusing to guess which is true.`
    );
  }

  const byCode = {};
  const byFile = {};
  for (const l of errorLines) {
    const code = l.match(/error (TS\d+):/)?.[1];
    if (code) byCode[code] = (byCode[code] || 0) + 1;
    const file = l.match(/^(.+?)\((\d+),(\d+)\)/)?.[1];
    if (file) {
      const norm = file.split(sep).join('/');
      byFile[norm] = (byFile[norm] || 0) + 1;
    }
  }

  return {
    config,
    tscVersion: version,
    errorCount: count,
    strictFlags: effectiveFlags(workspaceDir, config),
    byCode: sortObj(byCode),
    byFile: sortObj(byFile),
  };
}

function sortObj(o) {
  return Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1)));
}

function measureAll() {
  const workspaces = discoverWorkspaces();
  const result = {};
  for (const ws of workspaces) {
    process.stderr.write(`  measuring ${ws} ... `);
    const r = runTsc(ws);
    process.stderr.write(`${r.errorCount}\n`);
    result[ws] = r;
  }
  return result;
}

function currentCommit() {
  const r = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : 'unknown';
}

function writeBaseline() {
  const measured = measureAll();
  const total = Object.values(measured).reduce((a, w) => a + w.errorCount, 0);
  const doc = {
    _comment:
      'Per-workspace TypeScript error-count baseline. Only errorCount gates pass/fail; ' +
      'byCode and byFile are informational diff context. Regenerate with: npm run typecheck:baseline',
    generatedAtCommit: currentCommit(),
    invocation:
      'NODE_OPTIONS=--max-old-space-size=8192 node <repo>/node_modules/typescript/bin/tsc -p <config> ' +
      '--noEmit (full tsconfig.json) or --outDir <tmp> --declarationDir <tmp> (declarations fallback)',
    countedAs: 'lines matching /error TS\\d+:/ on stdout+stderr',
    configPolicy:
      'Workspaces are measured with their STRICT tsconfig.json (strict family enabled), NOT the lenient ' +
      'tsconfig.declarations.json that build.mjs emits with. The gate therefore sees the null/undefined ' +
      'defect class (strictNullChecks) -- the fabricated-zero class this repo is being cured of. Confirm ' +
      'per workspace via strictFlags; any workspace still showing strict:false is a full-tsconfig that ' +
      'opts out and remains blind there. NOTE: the Docker image and CI both build with ' +
      'SKIP_DECLARATIONS=true and run NO tsc at all, so this gate is the only type signal in the pipeline ' +
      'until it is wired into CI.',
    total,
    workspaces: Object.fromEntries(
      Object.entries(measured).sort(([a], [b]) => (a < b ? -1 : 1))
    ),
  };
  writeFileSync(BASELINE_PATH, JSON.stringify(doc, null, 2) + '\n', 'utf8');
  console.log(`\nBaseline written to ${BASELINE_PATH}`);
  console.log(`  commit ${doc.generatedAtCommit}`);
  console.log(`  total  ${total}`);
  for (const [ws, w] of Object.entries(doc.workspaces)) {
    console.log(`  ${ws.padEnd(32)} ${String(w.errorCount).padStart(3)}  (${w.config}, tsc ${w.tscVersion})`);
  }
}

function checkBaseline() {
  if (!existsSync(BASELINE_PATH)) {
    throw new HardFail(`no baseline at ${BASELINE_PATH}. Run: npm run typecheck:baseline`);
  }
  let base;
  try {
    // strip a UTF-8 BOM if an editor added one -- but never silently tolerate
    // anything else malformed.
    base = JSON.parse(readFileSync(BASELINE_PATH, 'utf8').replace(/^﻿/, ''));
  } catch (e) {
    throw new HardFail(`baseline at ${BASELINE_PATH} is not valid JSON: ${e.message}`);
  }
  if (!base || typeof base.workspaces !== 'object' || base.workspaces === null) {
    throw new HardFail(`baseline at ${BASELINE_PATH} has no "workspaces" object.`);
  }
  const measured = measureAll();

  const problems = [];
  const decreases = [];

  const baseNames = Object.keys(base.workspaces || {});
  const diskNames = Object.keys(measured);

  for (const ws of diskNames) {
    if (!baseNames.includes(ws)) {
      // unknown != zero
      problems.push(`${ws}: present on disk but ABSENT from the baseline (unknown is not zero). Re-baseline deliberately.`);
    }
  }
  for (const ws of baseNames) {
    if (!diskNames.includes(ws)) {
      problems.push(`${ws}: in baseline but NOT on disk (cannot verify is not verified).`);
    }
  }

  for (const ws of diskNames) {
    const cur = measured[ws];
    const prev = base.workspaces?.[ws];
    if (!prev) continue;

    if (prev.errorCount === null || prev.errorCount === undefined || typeof prev.errorCount !== 'number') {
      problems.push(`${ws}: baseline errorCount is not a number (${JSON.stringify(prev.errorCount)}).`);
      continue;
    }
    // Compiler-version drift makes counts incomparable.
    if (prev.tscVersion && prev.tscVersion !== cur.tscVersion) {
      problems.push(
        `${ws}: tsc version drift -- baseline recorded ${prev.tscVersion}, measured ${cur.tscVersion}. ` +
          `Error counts are compiler-version sensitive; the comparison is not trustworthy.`
      );
    }
    if (prev.config !== cur.config) {
      problems.push(`${ws}: config changed -- baseline ${prev.config}, now ${cur.config}.`);
    }

    const delta = cur.errorCount - prev.errorCount;
    if (delta > 0) {
      const newCodes = Object.entries(cur.byCode)
        .filter(([c, n]) => n > (prev.byCode?.[c] || 0))
        .map(([c, n]) => `${c} ${prev.byCode?.[c] || 0}->${n}`);
      const newFiles = Object.entries(cur.byFile)
        .filter(([f, n]) => n > (prev.byFile?.[f] || 0))
        .map(([f, n]) => `${f} ${prev.byFile?.[f] || 0}->${n}`);
      problems.push(
        `${ws}: INCREASE ${prev.errorCount} -> ${cur.errorCount} (+${delta})` +
          (newCodes.length ? `\n      codes: ${newCodes.join(', ')}` : '') +
          (newFiles.length ? `\n      files: ${newFiles.join(', ')}` : '')
      );
    } else if (delta < 0) {
      decreases.push(`${ws}: ${prev.errorCount} -> ${cur.errorCount} (${delta})`);
    } else {
      // delta === 0. Same total is NOT the same errors. A net-zero swap --
      // removing one benign error (e.g. TS6133 unused-var) while introducing one
      // strictNullChecks error (TS2322/TS18048) in the same workspace -- keeps
      // errorCount constant, and a count-only ratchet would pass it silently:
      // the exact loud->quiet-wrong trade this gate exists to prevent. The
      // per-code data is already in hand, so compare byCode at equal totals and
      // fail if any code rose.
      const rose = Object.entries(cur.byCode)
        .filter(([c, n]) => n > (prev.byCode?.[c] || 0))
        .map(([c, n]) => `${c} ${prev.byCode?.[c] || 0}->${n}`);
      if (rose.length) {
        problems.push(
          `${ws}: NET-ZERO SWAP -- errorCount unchanged at ${cur.errorCount}, but a different error ` +
            `code was introduced while another was removed. A new error must not hide behind a fixed one.` +
            `\n      codes up: ${rose.join(', ')}\n      Re-baseline deliberately if this swap is intended.`
        );
      }
    }
  }

  const total = Object.values(measured).reduce((a, w) => a + w.errorCount, 0);
  const baseTotalParts = Object.values(base.workspaces || {}).reduce((a, w) => a + (w.errorCount || 0), 0);
  if (base.total !== baseTotalParts) {
    problems.push(`baseline "total" (${base.total}) != sum of workspace counts (${baseTotalParts}).`);
  }

  console.log('\nPer-workspace typecheck counts (baseline -> measured):');
  for (const ws of diskNames) {
    const prev = base.workspaces?.[ws]?.errorCount;
    const cur = measured[ws].errorCount;
    const mark = prev === undefined ? '  ??' : cur > prev ? '  ++' : cur < prev ? '  --' : '   =';
    console.log(`  ${ws.padEnd(32)} ${String(prev ?? '?').padStart(3)} -> ${String(cur).padStart(3)}${mark}`);
  }
  console.log(`  ${'TOTAL'.padEnd(32)} ${String(base.total ?? '?').padStart(3)} -> ${String(total).padStart(3)}`);

  if (decreases.length) {
    console.log('\n==============================================');
    console.log('BASELINE STALE (decrease) -- not a failure, but re-record it:');
    for (const d of decreases) console.log(`  ${d}`);
    console.log('  run: npm run typecheck:baseline');
    console.log('==============================================');
  }

  if (problems.length) {
    console.error('\nTYPECHECK GATE FAILED');
    for (const p of problems) console.error(`  ${p}`);
    console.error('');
    process.exit(1);
  }

  console.log('\nTypecheck gate PASSED (no workspace increased).');
}

// ---------------------------------------------------------------------------
const mode = process.argv[2];
try {
  if (mode === '--write') writeBaseline();
  else if (mode === '--check') checkBaseline();
  else die('usage: typecheck-baseline.mjs --write | --check');
} catch (e) {
  if (e instanceof HardFail) die(e.message);
  throw e;
}
