// Tests for the matrix generator (M0). Zero external deps: node:test + node:assert.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMarker, looksLikeMarker, render, loadFrameworks } from '../scripts/gen-matrix.mjs';

test('parseMarker: valid marker with all fields', () => {
  const r = parseMarker('VERIFIED | framework=web-bot-auth | signs with Ed25519 | ref=https://example.test/doc');
  assert.equal(r.label, 'VERIFIED');
  assert.equal(r.framework, 'web-bot-auth');
  assert.equal(r.summary, 'signs with Ed25519');
  assert.equal(r.ref, 'https://example.test/doc');
});

test('parseMarker: ref/id optional, summary can contain extra pipes', () => {
  const r = parseMarker('PENDING-B | framework=content-signals | needs live fetch | needs egress');
  assert.equal(r.label, 'PENDING-B');
  assert.equal(r.summary, 'needs live fetch | needs egress');
  assert.equal(r.ref, '');
});

test('parseMarker: strips trailing comment terminators', () => {
  const r = parseMarker('UNVERIFIED | framework=cloudflare-wallets | self-defined schema -->');
  assert.equal(r.summary, 'self-defined schema');
});

test('parseMarker: fails loudly on unknown label (typo)', () => {
  assert.throws(() => parseMarker('PENDNIG-B | framework=web-bot-auth | typo'), /unknown label/);
});

test('parseMarker: fails loudly on missing framework', () => {
  assert.throws(() => parseMarker('VERIFIED | just a summary'), /missing required field framework/);
});

test('parseMarker: fails loudly on empty summary', () => {
  assert.throws(() => parseMarker('VERIFIED | framework=web-bot-auth'), /missing summary/);
});

test('looksLikeMarker: real markers vs prose references', () => {
  assert.equal(looksLikeMarker('VERIFIED | framework=x | y'), true);
  assert.equal(looksLikeMarker('PENDING-B | framework=x | y'), true);
  // prose references the scanner must skip:
  assert.equal(looksLikeMarker(' <LABEL> | framework=<slug> | <summary>'), false);
  assert.equal(looksLikeMarker('` marker, not just a code comment.'), false);
  assert.equal(looksLikeMarker("';"), false);
  assert.equal(looksLikeMarker('` markers across the repo.'), false);
});

test('render: empty state shows all five frameworks with no markers', () => {
  const frameworks = loadFrameworks();
  assert.equal(frameworks.size, 5);
  const out = render(frameworks, []);
  assert.match(out, /Total markers: 0/);
  // every framework title appears, and each shows the empty placeholder
  for (const f of frameworks.values()) {
    assert.ok(out.includes(f.title), `missing framework ${f.title}`);
  }
  const emptyCount = (out.match(/_No markers yet\._/g) || []).length;
  assert.equal(emptyCount, 5, 'all five frameworks should render empty in empty state');
});

test('render: counts land in the summary row for the right framework', () => {
  const frameworks = loadFrameworks();
  const records = [
    { label: 'VERIFIED', framework: 'web-bot-auth', summary: 'a', ref: '', id: '', loc: 'f:1' },
    { label: 'PENDING-B', framework: 'web-bot-auth', summary: 'b', ref: '', id: '', loc: 'f:2' },
    { label: 'UNVERIFIED', framework: 'deferred-payment', summary: 'c', ref: '', id: '', loc: 'f:3' },
  ];
  const out = render(frameworks, records);
  assert.match(out, /Total markers: 3/);
  // Web Bot Auth row: VERIFIED=1 PENDING-B=1 UNVERIFIED=0 Total=2
  assert.match(out, /\| Web Bot Auth \| M1 \| 1 \| 1 \| 0 \| 2 \|/);
});
