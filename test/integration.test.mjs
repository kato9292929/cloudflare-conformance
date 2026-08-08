// M6 integration: the M3 spend policy and the M5 ledger form one loop. An agent
// authorizes each intended payment against the policy using the ledger's running
// total as the "already spent" input; allowed payments are recorded, and the
// accumulating ledger eventually trips the policy's total cap. This ties the two
// self-defined pieces together without touching any Category B surface.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadPolicy } from '../src/wallet/policy.mjs';
import { localAllowlistProvider } from '../src/wallet/wallet-adapter.mjs';
import { createLedger } from '../src/ledger/ledger.mjs';

const DATA = '0x1111111111111111111111111111111111111111';
const ASSET = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

test('policy + ledger: running ledger total enforces the policy total cap', () => {
  const policy = loadPolicy('data/spend-policy.json'); // totalMax 5.000 (5000000 atomic)
  const provider = localAllowlistProvider(policy);
  const ledger = createLedger();

  // Twelve intended 0.500 payments = 6.000 desired, but the total cap is 5.000.
  // Exactly ten should be authorized+recorded; the 11th and 12th denied.
  let recorded = 0;
  let denied = 0;
  for (let i = 0; i < 12; i++) {
    const spentAtomic = ledger.spentAtomic(ASSET, 'base');
    const decision = provider.authorize({ payTo: DATA, amount: '0.500' }, { spentAtomic });
    if (decision.allowed) {
      ledger.appendPayment({
        id: `pay-${i}`,
        ts: '2026-08-08T00:00:00Z',
        payeeId: decision.payeeId,
        payTo: DATA,
        amountAtomic: decision.amountAtomic,
        asset: ASSET,
        network: 'base',
        settlement: { type: 'immediate' },
      });
      recorded++;
    } else {
      denied++;
      assert.ok(decision.reasons.some((r) => r.code === 'total-cap-exceeded'));
    }
  }

  assert.equal(recorded, 10); // 10 * 0.500 = 5.000 = the cap, inclusive
  assert.equal(denied, 2);
  assert.equal(ledger.spentAtomic(ASSET, 'base'), '5000000');
  assert.equal(ledger.totals().bySettlementType.immediate, '5000000');
});

test('policy + ledger: a denied payment is never recorded (ledger stays consistent)', () => {
  const policy = loadPolicy('data/spend-policy.json');
  const provider = localAllowlistProvider(policy);
  const ledger = createLedger();

  // A payee not on the allowlist is denied and must not enter the ledger.
  const decision = provider.authorize(
    { payTo: '0x9999999999999999999999999999999999999999', amount: '0.100' },
    { spentAtomic: ledger.spentAtomic(ASSET, 'base') }
  );
  assert.equal(decision.allowed, false);
  assert.equal(ledger.totals().count, 0);
});
