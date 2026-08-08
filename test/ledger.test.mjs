// M5 tests: agent spending ledger + settlement-type extension point. Verifies the
// data structure can accommodate a settlement type beyond "immediate" WITHOUT a
// schema change, while refusing to implement/guess the unfinalized deferred spec.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createLedger } from '../src/ledger/ledger.mjs';

const ASSET = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
function immediate(id, amount, extra = {}) {
  return { id, ts: '2026-08-08T00:00:00Z', payTo: '0x1111111111111111111111111111111111111111', amountAtomic: amount, asset: ASSET, network: 'base', settlement: { type: 'immediate' }, ...extra };
}

test('ledger: records immediate settlements and totals with BigInt math', () => {
  const l = createLedger();
  l.appendPayment(immediate('a', '10000'));
  l.appendPayment(immediate('b', '25000'));
  l.appendPayment(immediate('c', '100000'));
  const t = l.totals();
  assert.equal(t.count, 3);
  assert.equal(t.byAssetNetwork[`base:${ASSET}`], '135000');
  assert.equal(t.bySettlementType.immediate, '135000');
  assert.equal(l.spentAtomic(ASSET, 'base'), '135000');
});

test('ledger: fails loudly on bad shape and duplicate id', () => {
  const l = createLedger();
  l.appendPayment(immediate('dup', '10000'));
  assert.throws(() => l.appendPayment(immediate('dup', '10000')), /duplicate entry id/);
  assert.throws(() => l.appendPayment(immediate('bad', '1.5')), /atomic-unit integer string/);
  assert.throws(() => l.appendPayment({ id: 'x', ts: 't', payTo: '0x1', amountAtomic: '1', asset: ASSET, network: 'base', settlement: { type: '' } }), /settlement.type must be a non-empty string/);
});

test('ledger: an unregistered settlement type (deferred) is REJECTED, not guessed', () => {
  const l = createLedger();
  assert.deepEqual(l.knownSettlementTypes(), ['immediate']);
  const deferred = { id: 'd1', ts: 't', payTo: '0x1', amountAtomic: '10000', asset: ASSET, network: 'base', settlement: { type: 'deferred' } };
  assert.throws(() => l.appendPayment(deferred), /unknown settlement\.type "deferred"|not implemented/);
});

test('ledger: settlement.type is a real extension point (schema unchanged)', () => {
  // Demonstrates the data structure can accommodate a NEW settlement type by
  // registering it — this is a test-only stub, NOT a claim about the deferred
  // payment spec. The entry schema does not change to support it.
  const l = createLedger();
  let validatedShape = null;
  l.registerSettlementType('provisional-batch', (s) => {
    validatedShape = s;
    if (!Array.isArray(s.members)) throw new Error('provisional-batch: members[] required');
  });
  const stored = l.appendPayment({
    id: 'batch-1', ts: 't', payTo: '0x1', amountAtomic: '5000', asset: ASSET, network: 'base',
    settlement: { type: 'provisional-batch', members: ['a', 'b'] },
  });
  assert.equal(stored.schema, 'x402inc.ledger-entry/v0'); // same schema as immediate
  assert.equal(stored.settlement.type, 'provisional-batch');
  assert.deepEqual(validatedShape.members, ['a', 'b']);
  // Registering a duplicate type fails loudly.
  assert.throws(() => l.registerSettlementType('immediate', () => {}), /already registered/);
});

test('ledger: matches the fixture — 3 immediate recorded, deferred rejected', () => {
  const { payments } = JSON.parse(readFileSync('fixtures/deferred-payment/payments.json', 'utf8'));
  const l = createLedger();
  let recorded = 0;
  let rejected = 0;
  for (const p of payments) {
    try {
      l.appendPayment(p);
      recorded++;
    } catch {
      rejected++;
    }
  }
  assert.equal(recorded, 3);
  assert.equal(rejected, 1);
  assert.equal(l.totals().bySettlementType.immediate, '135000');
});
