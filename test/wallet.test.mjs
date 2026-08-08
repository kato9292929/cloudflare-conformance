// M3 tests: self-defined spend policy + payee allowlist + local authorization
// + adapter boundary. Zero external deps.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { loadPolicy, validatePolicy, buildAllowlist, evaluatePayment } from '../src/wallet/policy.mjs';
import { localAllowlistProvider, cloudflareWalletsProvider } from '../src/wallet/wallet-adapter.mjs';

const policy = loadPolicy('data/spend-policy.json');
const DATA = '0x1111111111111111111111111111111111111111';
const SEARCH = '0x2222222222222222222222222222222222222222';
const FINANCE = '0x3333333333333333333333333333333333333333';

test('validatePolicy: accepts the sample and fails loudly on bad input', () => {
  const base = JSON.parse(readFileSync('data/spend-policy.json', 'utf8'));
  assert.equal(validatePolicy(base).schema, 'x402inc.spend-policy/v0');

  assert.throws(() => validatePolicy({ schema: 'wrong' }), /unexpected schema/);

  const badAmount = structuredClone(base);
  badAmount.caps.perTransactionMax = '0,5';
  assert.throws(() => validatePolicy(badAmount), /must be a decimal string/);

  const dupId = structuredClone(base);
  dupId.payees.push({ ...dupId.payees[0] });
  assert.throws(() => validatePolicy(dupId), /duplicate payee id|duplicate payTo/);

  const dupAddr = structuredClone(base);
  dupAddr.payees.push({ id: 'other', payTo: DATA });
  assert.throws(() => validatePolicy(dupAddr), /duplicate payTo/);

  const perTxnTooHigh = structuredClone(base);
  perTxnTooHigh.caps.perTransactionMax = '9.000'; // > totalMax 5.000
  assert.throws(() => validatePolicy(perTxnTooHigh), /perTransactionMax exceeds/);

  const overrideTooHigh = structuredClone(base);
  overrideTooHigh.payees[0].perTransactionMax = '0.900'; // > global 0.500
  assert.throws(() => validatePolicy(overrideTooHigh), /exceeds the global/);
});

test('buildAllowlist: converts caps + payees to atomic units, applies overrides', () => {
  const a = buildAllowlist(policy);
  assert.equal(a.schema, 'x402inc.payee-allowlist/v0');
  assert.equal(a.perTransactionMaxAtomic, '500000'); // 0.500 @ 6
  assert.equal(a.totalMaxAtomic, '5000000'); // 5.000 @ 6
  assert.equal(a.payees.length, 3);
  const search = a.payees.find((p) => p.id === 'x402inc-search-api');
  assert.equal(search.perTransactionMaxAtomic, '100000'); // override 0.100 @ 6
  const data = a.payees.find((p) => p.id === 'x402inc-data-api');
  assert.equal(data.perTransactionMaxAtomic, '500000'); // inherits global
});

test('evaluatePayment: allows a payment within all caps', () => {
  const d = evaluatePayment(policy, { payTo: DATA, amount: '0.200' }, { spentAtomic: '0' });
  assert.equal(d.allowed, true, JSON.stringify(d.reasons));
  assert.equal(d.payeeId, 'x402inc-data-api');
  assert.equal(d.amountAtomic, '200000');
  assert.equal(d.projectedSpentAtomic, '200000');
});

test('evaluatePayment: denies over per-transaction cap', () => {
  const d = evaluatePayment(policy, { payTo: DATA, amount: '0.600' }, { spentAtomic: '0' });
  assert.equal(d.allowed, false);
  assert.ok(d.reasons.some((r) => r.code === 'per-transaction-exceeded'));
});

test('evaluatePayment: denies over payee-override cap (search, 0.100)', () => {
  const d = evaluatePayment(policy, { payTo: SEARCH, amount: '0.200' }, { spentAtomic: '0' });
  assert.equal(d.allowed, false);
  assert.ok(d.reasons.some((r) => r.code === 'per-transaction-exceeded'));
});

test('evaluatePayment: denies a payee not on the allowlist', () => {
  const d = evaluatePayment(policy, { payTo: '0x9999999999999999999999999999999999999999', amount: '0.010' }, { spentAtomic: '0' });
  assert.equal(d.allowed, false);
  assert.equal(d.payeeId, null);
  assert.ok(d.reasons.some((r) => r.code === 'payee-not-allowed'));
});

test('evaluatePayment: denies when the running total cap would be exceeded', () => {
  const d = evaluatePayment(policy, { payTo: FINANCE, amount: '0.200' }, { spentAtomic: '4900000' });
  assert.equal(d.allowed, false);
  assert.ok(d.reasons.some((r) => r.code === 'total-cap-exceeded'));
});

test('evaluatePayment: denies on network / asset mismatch when specified', () => {
  const net = evaluatePayment(policy, { payTo: DATA, amount: '0.010', network: 'ethereum' }, { spentAtomic: '0' });
  assert.ok(net.reasons.some((r) => r.code === 'network-mismatch'));
  const asset = evaluatePayment(policy, { payTo: DATA, amount: '0.010', asset: '0xdeadbeef' }, { spentAtomic: '0' });
  assert.ok(asset.reasons.some((r) => r.code === 'asset-mismatch'));
});

test('evaluatePayment: throws (not denies) on a malformed amount', () => {
  assert.throws(() => evaluatePayment(policy, { payTo: DATA, amount: '1,00' }, { spentAtomic: '0' }), /invalid decimal/);
  assert.throws(() => evaluatePayment(policy, { amount: '0.010' }, {}), /payTo is required/);
});

test('adapter: localAllowlistProvider authorizes and exports consistently', () => {
  const p = localAllowlistProvider(policy);
  assert.equal(p.name, 'local-allowlist');
  assert.equal(p.exportAllowlist().payees.length, 3);
  assert.equal(p.authorize({ payTo: DATA, amount: '0.100' }, { spentAtomic: '0' }).allowed, true);
});

test('adapter: cloudflareWalletsProvider is intentionally unimplemented (throws, no guess)', () => {
  const p = cloudflareWalletsProvider();
  assert.equal(p.name, 'cloudflare-wallets');
  assert.throws(() => p.authorize({ payTo: DATA, amount: '0.100' }, {}), /unpublished/);
  assert.throws(() => p.exportAllowlist(), /unpublished/);
});
