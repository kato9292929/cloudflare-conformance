#!/usr/bin/env node
// Run the 402-response checker over a directory of response fixtures, cross-checking
// against the declarative billing rules.
//
//   node scripts/x402-check.mjs --fixtures fixtures/monetization-gateway/valid \
//       --rules data/billing-rules.json [--expect-ok|--expect-fail]
//
// Exit code: 0 if all fixtures satisfy the expectation, 1 otherwise. Default
// expectation is --expect-ok (every fixture must pass). Use --expect-fail to
// assert that every fixture is (correctly) rejected — used to prove the checker
// actually catches problems.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadRules } from '../src/x402/rules.mjs';
import { checkResponse } from '../src/x402/checker.mjs';

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : def;
}

const fixturesDir = arg('--fixtures', 'fixtures/monetization-gateway/valid');
const rulesPath = arg('--rules', 'data/billing-rules.json');
const expectFail = process.argv.includes('--expect-fail');
const mode = expectFail ? 'expect-fail' : 'expect-ok';

const ruleset = loadRules(rulesPath);
const files = readdirSync(fixturesDir).filter((f) => f.endsWith('.json')).sort();
if (files.length === 0) {
  console.error(`x402-check: no .json fixtures in ${fixturesDir}`);
  process.exit(1);
}

let failures = 0;
console.log(`x402-check: ${files.length} fixture(s) in ${fixturesDir} (mode=${mode}, rules=${rulesPath})\n`);

for (const f of files) {
  const fx = JSON.parse(readFileSync(join(fixturesDir, f), 'utf8'));
  const input = {
    status: fx.response.status,
    headers: fx.response.headers,
    body: fx.response.body,
    resourcePath: fx.request?.path,
    method: fx.request?.method,
  };
  const result = checkResponse(input, { ruleset });
  const meets = mode === 'expect-ok' ? result.ok : !result.ok;
  const badge = meets ? 'PASS' : 'FAIL';
  if (!meets) failures++;
  console.log(`[${badge}] ${f} — ${fx.name}`);
  console.log(`        ok=${result.ok} matchedRule=${result.matchedRuleId ?? '—'} problems=${result.problems.length}`);
  for (const p of result.problems) console.log(`          - (${p.code}) ${p.message}`);
}

console.log(`\nx402-check: ${files.length - failures}/${files.length} met expectation "${mode}".`);
process.exit(failures === 0 ? 0 : 1);
