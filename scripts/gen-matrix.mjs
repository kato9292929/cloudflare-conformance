#!/usr/bin/env node
// gen-matrix.mjs — collect every CONFORMANCE-TAG marker in the repo and render
// docs/conformance/matrix.md. The matrix is GENERATED, never hand-written
// (per the M0 brief: "手書きの一覧は作らない").
//
// Marker format (single line, works inside any file type):
//
//   CONFORMANCE-TAG: <LABEL> | framework=<slug> | <summary> | ref=<url-or-note>
//
//   - <LABEL> ∈ { VERIFIED, UNVERIFIED, PENDING-B }   (see docs/conformance/LABELS.md)
//   - framework=<slug>   REQUIRED, must exist in docs/conformance/frameworks.json
//   - <summary>          REQUIRED free text describing the tagged thing
//   - ref=<...>          OPTIONAL primary-source URL or short note; id=<...> also allowed
//
// Any malformed marker (unknown label, unknown framework, empty summary) makes
// this script fail loudly with a non-zero exit — we do not silently drop tags.
//
// Usage:
//   node scripts/gen-matrix.mjs           # write docs/conformance/matrix.md
//   node scripts/gen-matrix.mjs --check   # verify matrix.md is up to date (CI); no write

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MATRIX_PATH = join(REPO_ROOT, 'docs/conformance/matrix.md');
const FRAMEWORKS_PATH = join(REPO_ROOT, 'docs/conformance/frameworks.json');

const VALID_LABELS = ['VERIFIED', 'PENDING-B', 'UNVERIFIED'];
const MARKER = 'CONFORMANCE-TAG:';
const SKIP_DIRS = new Set(['.git', 'node_modules']);

function die(msg) {
  console.error(`gen-matrix: ${msg}`);
  process.exit(1);
}

export function loadFrameworks() {
  const data = JSON.parse(readFileSync(FRAMEWORKS_PATH, 'utf8'));
  const bySlug = new Map();
  for (const f of data.frameworks) bySlug.set(f.slug, f);
  return bySlug;
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) yield* walk(full);
    else if (st.isFile()) yield full;
  }
}

function isProbablyText(buf) {
  // Reject files containing NUL in the first chunk (binary heuristic).
  const n = Math.min(buf.length, 8000);
  for (let i = 0; i < n; i++) if (buf[i] === 0) return false;
  return true;
}

// A label-shaped first field (e.g. VERIFIED, PENDING-B) marks a genuine marker.
// Prose that merely mentions the token (this file's own docstrings, LABELS.md,
// CLAUDE.md) has a first field like "<LABEL>" or "marker, ..." and is skipped.
// A first field that LOOKS like a label but isn't valid (a real typo) still
// fails loudly.
const LABEL_SHAPED = /^[A-Z][A-Z-]{2,}$/;

// Decide whether a marker payload is a real tag worth parsing. Returns false for
// documentation references (skip silently), true for genuine tags (parse/validate).
export function looksLikeMarker(payload) {
  const first = stripTerminators(payload).split('|')[0].trim();
  return LABEL_SHAPED.test(first);
}

function stripTerminators(payload) {
  // Strip trailing comment terminators so markers work in /* */ and <!-- --> too.
  return payload.replace(/\s*(\*\/|-->|#>|"""|''')\s*$/g, '').trim();
}

// Parse one marker payload (everything after "CONFORMANCE-TAG:") into a record.
// Throws on any malformation — the caller adds file:line context.
export function parseMarker(payload) {
  const p = stripTerminators(payload);
  const parts = p.split('|').map((s) => s.trim()).filter((s) => s.length > 0);
  if (parts.length === 0) throw new Error('empty marker');

  const label = parts[0];
  if (!VALID_LABELS.includes(label)) {
    throw new Error(`unknown label "${label}" (expected one of ${VALID_LABELS.join(', ')})`);
  }

  const meta = {};
  const summaryParts = [];
  for (const field of parts.slice(1)) {
    const m = field.match(/^([A-Za-z][\w-]*)=(.*)$/);
    if (m) meta[m[1].toLowerCase()] = m[2].trim();
    else summaryParts.push(field);
  }

  if (!meta.framework) throw new Error('missing required field framework=<slug>');
  const summary = summaryParts.join(' | ').trim();
  if (!summary) throw new Error('missing summary text');

  return { label, framework: meta.framework, summary, ref: meta.ref || '', id: meta.id || '' };
}

function collect(frameworks) {
  const records = [];
  const errors = [];
  for (const file of walk(REPO_ROOT)) {
    if (file === MATRIX_PATH) continue; // never scan the generated output
    let buf;
    try {
      buf = readFileSync(file);
    } catch {
      continue;
    }
    if (!isProbablyText(buf)) continue;
    const text = buf.toString('utf8');
    if (!text.includes(MARKER)) continue;

    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const idx = lines[i].indexOf(MARKER);
      if (idx === -1) continue;
      const payload = lines[i].slice(idx + MARKER.length);
      if (!looksLikeMarker(payload)) continue; // prose reference, not a real tag
      const loc = `${relative(REPO_ROOT, file)}:${i + 1}`;
      let rec;
      try {
        rec = parseMarker(payload);
      } catch (e) {
        errors.push(`${loc}: ${e.message}`);
        continue;
      }
      if (!frameworks.has(rec.framework)) {
        errors.push(`${loc}: unknown framework "${rec.framework}" (not in frameworks.json)`);
        continue;
      }
      records.push({ ...rec, loc });
    }
  }
  if (errors.length) {
    die(`found ${errors.length} malformed marker(s):\n  - ${errors.join('\n  - ')}`);
  }
  return records;
}

function mdEscape(s) {
  return s.replace(/\|/g, '\\|');
}

export function render(frameworks, records) {
  const now = process.env.MATRIX_DATE || 'see git commit date';
  const lines = [];
  lines.push('<!-- GENERATED FILE — do not edit by hand. Run: npm run matrix -->');
  lines.push('# Conformance Matrix');
  lines.push('');
  lines.push(
    'Generated by `scripts/gen-matrix.mjs` from `CONFORMANCE-TAG:` markers across the repo. ' +
      'This is an **implementation record, not a compliance claim**. Regenerate with `npm run matrix`; ' +
      'CI can assert freshness with `npm run matrix:check`.'
  );
  lines.push('');
  lines.push(`- Generated: ${now}`);
  lines.push(`- Total markers: ${records.length}`);
  lines.push('');

  // Label legend
  lines.push('## Labels');
  lines.push('');
  lines.push('| Label | Meaning |');
  lines.push('|---|---|');
  lines.push('| `VERIFIED` | Primary source (Cloudflare official docs/blog/press) retrieved and quoted, URL recorded. |');
  lines.push('| `PENDING-B` | Category B (needs API keys / network / application acceptance) — unconsumed in this environment. Includes primary-source spec confirmation, which requires egress this environment lacks. |');
  lines.push('| `UNVERIFIED` | No primary source exists / could not be confirmed, so x402 Inc. defined it provisionally. |');
  lines.push('');

  // Summary count table: framework × label
  lines.push('## Summary');
  lines.push('');
  lines.push('| Framework | Milestone | VERIFIED | PENDING-B | UNVERIFIED | Total | Record |');
  lines.push('|---|---|---:|---:|---:|---:|---|');
  for (const f of frameworks.values()) {
    const recs = records.filter((r) => r.framework === f.slug);
    const c = (lab) => recs.filter((r) => r.label === lab).length;
    lines.push(
      `| ${mdEscape(f.title)} | ${f.milestone} | ${c('VERIFIED')} | ${c('PENDING-B')} | ${c('UNVERIFIED')} | ${recs.length} | [${f.slug}.md](./${f.slug}.md) |`
    );
  }
  // Any records whose framework is registered but not otherwise iterated are already covered.
  lines.push('');

  // Per-framework detail
  lines.push('## Detail');
  lines.push('');
  for (const f of frameworks.values()) {
    lines.push(`### ${f.title} (${f.milestone})`);
    lines.push('');
    lines.push(`- Slug: \`${f.slug}\``);
    lines.push(`- Public status: ${f.public_status}`);
    lines.push('');
    const recs = records
      .filter((r) => r.framework === f.slug)
      .sort((a, b) => VALID_LABELS.indexOf(a.label) - VALID_LABELS.indexOf(b.label) || a.loc.localeCompare(b.loc));
    if (recs.length === 0) {
      lines.push('_No markers yet._');
      lines.push('');
      continue;
    }
    lines.push('| Label | Summary | Ref | Location |');
    lines.push('|---|---|---|---|');
    for (const r of recs) {
      const ref = r.ref ? (r.ref.startsWith('http') ? `[link](${r.ref})` : mdEscape(r.ref)) : '—';
      lines.push(`| \`${r.label}\` | ${mdEscape(r.summary)} | ${ref} | \`${r.loc}\` |`);
    }
    lines.push('');
  }

  return lines.join('\n') + '\n';
}

function main() {
  const check = process.argv.includes('--check');
  const frameworks = loadFrameworks();
  const records = collect(frameworks);
  const out = render(frameworks, records);

  if (check) {
    let existing = '';
    try {
      existing = readFileSync(MATRIX_PATH, 'utf8');
    } catch {
      die('matrix.md does not exist — run `npm run matrix`');
    }
    // Ignore the volatile "Generated:" line when comparing.
    const norm = (s) => s.replace(/^- Generated:.*$/m, '- Generated: <ignored>');
    if (norm(existing) !== norm(out)) {
      die('matrix.md is stale — run `npm run matrix` and commit the result');
    }
    console.log(`matrix.md is up to date (${records.length} markers).`);
    return;
  }

  writeFileSync(MATRIX_PATH, out);
  console.log(`Wrote ${relative(REPO_ROOT, MATRIX_PATH)} (${records.length} markers).`);
}

// Only run when invoked as a script, not when imported by tests.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
