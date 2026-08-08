#!/usr/bin/env node
// Generate the approved-payee allowlist artifact from a spend policy, and
// demonstrate the local authorization decision on a few sample payments.
//
//   node scripts/gen-allowlist.mjs [--policy data/spend-policy.json] [--out out/wallet/payee-allowlist.json]
//
// The policy path is a CLI ARGUMENT so a real input (e.g. an endpoint repo's
// data/endpoints.json converted to a spend policy) can be pointed at without
// touching this repo. Injecting the resulting allowlist into a Cloudflare Virtual
// Wallet is Category B (unpublished API) — see docs/conformance/cloudflare-wallets.md.
//
// Exit code: 0 on success, 1 if the policy is invalid.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { loadPolicy } from '../src/wallet/policy.mjs';
import { localAllowlistProvider } from '../src/wallet/wallet-adapter.mjs';

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : def;
}

const policyPath = arg('--policy', 'data/spend-policy.json');
const outPath = arg('--out', 'out/wallet/payee-allowlist.json');

const policy = loadPolicy(policyPath); // throws loudly on an invalid policy
const provider = localAllowlistProvider(policy);
const allowlist = provider.exportAllowlist();

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(allowlist, null, 2) + '\n');

console.log(`gen-allowlist: policy=${policyPath} provider=${provider.name}`);
console.log(`gen-allowlist: wrote ${allowlist.payees.length} payee(s) -> ${outPath}`);
console.log(`  network=${allowlist.network} asset=${allowlist.asset} decimals=${allowlist.assetDecimals}`);
console.log(`  perTransactionMaxAtomic=${allowlist.perTransactionMaxAtomic} totalMaxAtomic=${allowlist.totalMaxAtomic}`);
for (const p of allowlist.payees) {
  console.log(`    - ${p.id} ${p.payTo} perTxnMaxAtomic=${p.perTransactionMaxAtomic} (${p.label ?? '—'})`);
}

// Demonstrate the local authorization decision. These sample requests exercise
// allow, per-transaction cap, payee-override cap, not-allowed payee, and the
// running total cap (spent state carried forward across an allowed sequence).
console.log('\ngen-allowlist: sample authorization decisions (local enforcement)');
const samples = [
  { label: 'allow: small payment to data API', req: { payTo: '0x1111111111111111111111111111111111111111', amount: '0.200' }, spent: '0' },
  { label: 'deny: over per-transaction cap', req: { payTo: '0x1111111111111111111111111111111111111111', amount: '0.600' }, spent: '0' },
  { label: 'deny: over payee-override cap (search API, 0.100)', req: { payTo: '0x2222222222222222222222222222222222222222', amount: '0.200' }, spent: '0' },
  { label: 'deny: payee not on allowlist', req: { payTo: '0x9999999999999999999999999999999999999999', amount: '0.050' }, spent: '0' },
  { label: 'deny: would exceed total cap (already spent 4.900)', req: { payTo: '0x3333333333333333333333333333333333333333', amount: '0.200' }, spent: '4900000' },
];
for (const s of samples) {
  const d = provider.authorize(s.req, { spentAtomic: s.spent });
  const badge = d.allowed ? 'ALLOW' : 'DENY ';
  console.log(`  [${badge}] ${s.label}`);
  console.log(`          payee=${d.payeeId ?? '—'} amountAtomic=${d.amountAtomic} projectedSpentAtomic=${d.projectedSpentAtomic}`);
  for (const r of d.reasons) console.log(`            - (${r.code}) ${r.message}`);
}

process.exit(0);
