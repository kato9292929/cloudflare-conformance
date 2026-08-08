#!/usr/bin/env node
// Build an agent spending ledger from a sequence of payment events and print the
// entries and totals. Demonstrates that an `immediate` settlement records fine,
// while an unfinalized settlement type (e.g. `deferred`) is REJECTED LOUDLY
// rather than silently accepted or guessed.
//
//   node scripts/gen-ledger.mjs [--payments fixtures/deferred-payment/payments.json]
//
// The payments path is a CLI ARGUMENT. Deferred/batch settlement is a proposal
// with no finalized spec and is intentionally not implemented — see
// docs/conformance/deferred-payment.md.
//
// Exit code: 0 on success.
import { readFileSync } from 'node:fs';
import { createLedger } from '../src/ledger/ledger.mjs';

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : def;
}

const paymentsPath = arg('--payments', 'fixtures/deferred-payment/payments.json');
const { payments } = JSON.parse(readFileSync(paymentsPath, 'utf8'));

const ledger = createLedger();
console.log(`gen-ledger: payments=${paymentsPath}`);
console.log(`gen-ledger: known settlement types = [${ledger.knownSettlementTypes().join(', ')}]\n`);

for (const p of payments) {
  try {
    const e = ledger.appendPayment(p);
    console.log(`  [RECORDED] ${e.id} seq=${e.seq} ${e.amountAtomic} ${e.network}:${e.asset.slice(0, 10)}… settlement=${e.settlement.type}`);
  } catch (err) {
    // A rejected entry is the intended outcome for an unfinalized settlement type.
    console.log(`  [REJECTED] ${p.id} settlement=${p.settlement?.type} — ${err.message}`);
  }
}

const t = ledger.totals();
console.log(`\ngen-ledger: totals — count=${t.count}`);
for (const [k, v] of Object.entries(t.byAssetNetwork)) console.log(`  ${k} = ${v} (atomic)`);
console.log('  by settlement type:');
for (const [k, v] of Object.entries(t.bySettlementType)) console.log(`    ${k} = ${v} (atomic)`);

process.exit(0);
