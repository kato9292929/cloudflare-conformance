// M2 tests: billing rules + 402 checker + adapter boundary. Zero external deps.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { loadRules, resolveRule, decimalToAtomic, validateRules } from '../src/x402/rules.mjs';
import { checkResponse } from '../src/x402/checker.mjs';
import { localProvider, gatewayProvider, ruleToAccept } from '../src/x402/gateway-adapter.mjs';

const ruleset = loadRules('data/billing-rules.json');

test('decimalToAtomic: exact string/BigInt math, no float error', () => {
  assert.equal(decimalToAtomic('0.010', 6), '10000');
  assert.equal(decimalToAtomic('0.025', 6), '25000');
  assert.equal(decimalToAtomic('0.100', 6), '100000');
  assert.equal(decimalToAtomic('1', 6), '1000000');
  assert.equal(decimalToAtomic('12.34', 2), '1234');
  assert.throws(() => decimalToAtomic('0.0001', 2), /more fractional digits/);
  assert.throws(() => decimalToAtomic('abc', 6), /invalid decimal/);
});

test('rules: resolveRule matches exact and prefix, merges defaults', () => {
  const r1 = resolveRule(ruleset, '/v1/data', 'GET');
  assert.equal(r1.id, 'data-fetch-basic');
  assert.equal(r1.amountAtomic, '10000');
  assert.equal(r1.network, 'base');
  const r2 = resolveRule(ruleset, '/v1/search/companies', 'POST');
  assert.equal(r2.id, 'search-query');
  assert.equal(r2.amountAtomic, '25000');
  assert.equal(resolveRule(ruleset, '/v1/data', 'DELETE'), null); // method not allowed
  assert.equal(resolveRule(ruleset, '/v1/nope', 'GET'), null);
});

test('rules: validateRules fails loudly on bad schema / bad amount', () => {
  assert.throws(() => validateRules({ schema: 'wrong' }), /unexpected schema/);
  const base = JSON.parse(readFileSync('data/billing-rules.json', 'utf8'));
  const bad = structuredClone(base);
  bad.rules[0].price.amount = '1,000';
  assert.throws(() => validateRules(bad), /not a decimal string/);
  const dup = structuredClone(base);
  dup.rules.push({ ...dup.rules[0] });
  assert.throws(() => validateRules(dup), /duplicate rule id/);
});

test('checker: a valid fixture passes cleanly', () => {
  const fx = JSON.parse(readFileSync('fixtures/monetization-gateway/valid/data-fetch.json', 'utf8'));
  const res = checkResponse(
    { status: fx.response.status, headers: fx.response.headers, body: fx.response.body, resourcePath: fx.request.path, method: fx.request.method },
    { ruleset }
  );
  assert.equal(res.ok, true, JSON.stringify(res.problems));
  assert.equal(res.matchedRuleId, 'data-fetch-basic');
});

test('checker: amount mismatch is reported', () => {
  const fx = JSON.parse(readFileSync('fixtures/monetization-gateway/invalid/amount-mismatch.json', 'utf8'));
  const res = checkResponse(
    { status: fx.response.status, headers: fx.response.headers, body: fx.response.body, resourcePath: fx.request.path, method: fx.request.method },
    { ruleset }
  );
  assert.equal(res.ok, false);
  assert.ok(res.problems.some((p) => p.code === 'rule-amount'));
});

test('checker: bad status + content-type + missing field + non-atomic amount all reported', () => {
  const fx = JSON.parse(readFileSync('fixtures/monetization-gateway/invalid/missing-field-and-bad-status.json', 'utf8'));
  const res = checkResponse(
    { status: fx.response.status, headers: fx.response.headers, body: fx.response.body, resourcePath: fx.request.path, method: fx.request.method },
    { ruleset }
  );
  assert.equal(res.ok, false);
  const codes = res.problems.map((p) => p.code);
  assert.ok(codes.includes('status'));
  assert.ok(codes.includes('content-type'));
  assert.ok(codes.includes('accept-field')); // missing payTo
  assert.ok(codes.includes('amount-format')); // "0.01" not atomic
});

test('checker: 402 without a matching rule is flagged', () => {
  const fx = JSON.parse(readFileSync('fixtures/monetization-gateway/invalid/no-matching-rule.json', 'utf8'));
  const res = checkResponse(
    { status: fx.response.status, headers: fx.response.headers, body: fx.response.body, resourcePath: fx.request.path, method: fx.request.method },
    { ruleset }
  );
  assert.equal(res.ok, false);
  assert.ok(res.problems.some((p) => p.code === 'no-rule'));
});

test('checker: does not swallow a non-object body', () => {
  const res = checkResponse({ status: 402, headers: { 'content-type': 'application/json' }, body: 'nope' }, { ruleset });
  assert.equal(res.ok, false);
  assert.ok(res.problems.some((p) => p.code === 'body'));
});

test('adapter: localProvider builds x402 accepts consistent with the checker', () => {
  const provider = localProvider(ruleset);
  const pr = provider.paymentRequirements('/v1/data', 'GET', { resourceUrl: 'https://api.x402.example/v1/data' });
  assert.equal(pr.x402Version, 1);
  assert.equal(pr.accepts[0].maxAmountRequired, '10000');
  // Feed the generated requirements straight back through the checker => clean.
  const res = checkResponse({ status: 402, headers: { 'content-type': 'application/json' }, body: pr, resourcePath: '/v1/data', method: 'GET' }, { ruleset });
  assert.equal(res.ok, true, JSON.stringify(res.problems));
});

test('adapter: localProvider returns null for an unpriced path', () => {
  assert.equal(localProvider(ruleset).paymentRequirements('/v1/free', 'GET'), null);
});

test('adapter: gatewayProvider is intentionally unimplemented (throws, no guess)', () => {
  assert.throws(() => gatewayProvider().paymentRequirements('/v1/data', 'GET'), /unpublished/);
});

test('adapter: ruleToAccept shape', () => {
  const rule = resolveRule(ruleset, '/v1/finance/quote', 'GET');
  const acc = ruleToAccept(rule, 'https://api.x402.example/v1/finance/quote');
  assert.equal(acc.maxAmountRequired, '100000');
  assert.equal(acc.network, 'base');
  assert.equal(acc.scheme, 'exact');
});
