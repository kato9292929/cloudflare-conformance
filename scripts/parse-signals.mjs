#!/usr/bin/env node
// Parse robots.txt file(s) and report RFC 9309 groups, a few access decisions,
// and any Content-Signal directives (extracted, not interpreted).
//
//   node scripts/parse-signals.mjs [--file fixtures/content-signals/example-mixed.robots.txt]
//   node scripts/parse-signals.mjs [--dir fixtures/content-signals]
//
// The path is a CLI ARGUMENT. Live fetching of a real domain's robots.txt is
// Category B (egress blocked) — see docs/conformance/content-signals.md.
//
// Exit code: 0 on success.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseRobotsTxt, isAllowed } from '../src/content-signals/robots.mjs';
import { extractContentSignals } from '../src/content-signals/signals.mjs';
import { localFileSource } from '../src/content-signals/source.mjs';

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : def;
}

const dir = arg('--dir', null);
const file = arg('--file', dir ? null : 'fixtures/content-signals/example-mixed.robots.txt');
const source = localFileSource();

const files = dir
  ? readdirSync(dir).filter((f) => f.endsWith('.txt')).sort().map((f) => join(dir, f))
  : [file];

// Sample access probes to demonstrate the RFC 9309 matcher.
const probes = [
  { ua: 'ExampleAIBot', path: '/' },
  { ua: 'SomeOtherBot', path: '/private/secret.txt' },
  { ua: 'SomeOtherBot', path: '/private/public-note.txt' },
  { ua: 'SomeOtherBot', path: '/docs/report.pdf' },
  { ua: 'SomeOtherBot', path: '/index.html' },
];

for (const f of files) {
  const text = source.read(f);
  const parsed = parseRobotsTxt(text);
  const signals = extractContentSignals(text);
  console.log(`\n=== ${f} ===`);
  console.log(`groups=${parsed.groups.length} sitemaps=${parsed.sitemaps.length}`);
  for (const g of parsed.groups) {
    console.log(`  user-agents: ${g.userAgents.join(', ')}  rules=${g.rules.length}`);
  }
  console.log('  access decisions (RFC 9309):');
  for (const p of probes) {
    const d = isAllowed(parsed, p.ua, p.path);
    const badge = d.allowed ? 'ALLOW' : 'DENY ';
    const via = d.rule ? `${d.rule.type} ${d.rule.path}` : 'no rule (default allow)';
    console.log(`    [${badge}] ${p.ua} ${p.path}  <- ${via}`);
  }
  console.log('  content-signals (extracted, NOT interpreted):');
  if (signals.global.length === 0) console.log('    (none)');
  for (const s of signals.global) {
    console.log(`    - ${s.name}=${s.value ?? '(no value)'}  recognized=${s.recognized}`);
  }
}

console.log('');
process.exit(0);
