// M4 tests: RFC 9309 robots.txt parsing/matching + Content-Signal extraction
// + source boundary. Zero external deps.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { parseRobotsTxt, isAllowed, selectGroup, matchesPattern } from '../src/content-signals/robots.mjs';
import { extractContentSignals, RECOGNIZED_TOKENS } from '../src/content-signals/signals.mjs';
import { localFileSource, networkSource } from '../src/content-signals/source.mjs';

const mixed = readFileSync('fixtures/content-signals/example-mixed.robots.txt', 'utf8');
const open = readFileSync('fixtures/content-signals/example-open.robots.txt', 'utf8');

test('parseRobotsTxt: splits into groups, sitemaps, content-signal lines', () => {
  const p = parseRobotsTxt(mixed);
  assert.equal(p.groups.length, 2);
  assert.deepEqual(p.groups[0].userAgents, ['*']);
  assert.deepEqual(p.groups[1].userAgents, ['exampleaibot']);
  assert.equal(p.sitemaps.length, 1);
  assert.equal(p.contentSignalLines.length, 2);
});

test('matchesPattern: supports prefix, `*`, and `$` end-anchor', () => {
  assert.equal(matchesPattern('/private/', '/private/x'), true);
  assert.equal(matchesPattern('/private/', '/public/x'), false);
  assert.equal(matchesPattern('/*.pdf$', '/docs/report.pdf'), true);
  assert.equal(matchesPattern('/*.pdf$', '/docs/report.pdf.html'), false);
  assert.equal(matchesPattern('', '/anything'), true);
});

test('selectGroup: most-specific product token wins, `*` is fallback', () => {
  const p = parseRobotsTxt(mixed);
  assert.deepEqual(selectGroup(p, 'ExampleAIBot/1.0').userAgents, ['exampleaibot']);
  assert.deepEqual(selectGroup(p, 'RandomBot').userAgents, ['*']);
});

test('isAllowed: RFC 9309 decisions incl. allow-wins-on-longer-match', () => {
  const p = parseRobotsTxt(mixed);
  // ExampleAIBot is disallowed everything.
  assert.equal(isAllowed(p, 'ExampleAIBot', '/').allowed, false);
  // Wildcard group: /private/ disallowed...
  assert.equal(isAllowed(p, 'RandomBot', '/private/secret.txt').allowed, false);
  // ...but the more specific Allow for public-note wins.
  assert.equal(isAllowed(p, 'RandomBot', '/private/public-note.txt').allowed, true);
  // .pdf end-anchored disallow.
  assert.equal(isAllowed(p, 'RandomBot', '/docs/report.pdf').allowed, false);
  // Unconstrained path => default allow.
  assert.equal(isAllowed(p, 'RandomBot', '/index.html').allowed, true);
});

test('isAllowed: empty Disallow means fully open', () => {
  const p = parseRobotsTxt(open);
  assert.equal(isAllowed(p, 'AnyBot', '/anything').allowed, true);
});

test('extractContentSignals: extracts pairs, flags recognized tokens, no interpretation', () => {
  const s = extractContentSignals(mixed);
  // global list aggregates both groups' Content-Signal lines
  const names = s.global.map((x) => `${x.name}=${x.value}`);
  assert.ok(names.includes('search=yes'));
  assert.ok(names.includes('ai-train=no'));
  assert.ok(names.includes('ai-input=no'));
  const search = s.global.find((x) => x.name === 'search');
  assert.equal(search.recognized, true);
  assert.deepEqual([...RECOGNIZED_TOKENS], ['search', 'ai-input', 'ai-train']);
  // per-group view is present
  assert.equal(s.perGroup.length, 2);
});

test('extractContentSignals: a token with no value is surfaced, not dropped', () => {
  const s = extractContentSignals('User-agent: *\nContent-Signal: search, ai-train=no\n');
  const bare = s.global.find((x) => x.name === 'search');
  assert.equal(bare.value, null);
  assert.equal(bare.recognized, true);
});

test('source boundary: local reads, network throws (egress-blocked, PENDING-B)', () => {
  assert.ok(localFileSource().read('fixtures/content-signals/example-open.robots.txt').includes('User-agent'));
  assert.throws(() => networkSource().read('https://example.invalid/robots.txt'), /egress|unavailable/i);
});
