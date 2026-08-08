// Agent spend policy — the implementation-independent representation of "which
// payees an agent may pay, and up to what per-transaction and total caps."
//
// Cloudflare Wallets / cloudflare.pay (announced 2026-08-04) is described as a
// Virtual Wallet with spending caps, an approved-payee list, and a per-payment
// limit. But at announcement it is HANDLE RESERVATION ONLY — the funding/spend
// and provisioning API spec is UNPUBLISHED. So both the policy input and the
// generated allowlist here are SELF-DEFINED, and their field names deliberately
// do NOT mimic any Cloudflare Wallets terminology so they cannot be mistaken for
// confirmed spec. Mapping this onto a real Virtual Wallet is Category B — see
// wallet-adapter.mjs.
//
// The THREE control TYPES modeled below — a total spending cap, an approved-payee
// (merchant) list, and a per-transaction limit an agent cannot exceed on its own —
// are confirmed as the Virtual Wallet guardrails in Cloudflare's press release (S9).
// CONFORMANCE-TAG: VERIFIED | framework=cloudflare-wallets | Cloudflare Wallets Virtual Wallets ship with guardrails a user defines: a spending cap, an approved-merchant list, and a per-transaction limit — the three controls this policy models | ref=S9
//
// The SCHEMA ENCODING (field names, types) of the input policy and the generated
// allowlist is SELF-DEFINED: the funding/spend/API spec is unpublished (handle
// reservation only), so no field is modeled on Cloudflare's terminology.
// CONFORMANCE-TAG: UNVERIFIED | framework=cloudflare-wallets | spend-policy input (x402inc.spend-policy/v0) and payee-allowlist output (x402inc.payee-allowlist/v0) field names/types are self-defined; Cloudflare Wallets funding/spend/API spec is unpublished (handle reservation only) so no field is modeled on it | ref=data/spend-policy.json

import { readFileSync } from 'node:fs';
import { decimalToAtomic } from '../x402/rules.mjs';

const POLICY_SCHEMA = 'x402inc.spend-policy/v0';
const ALLOWLIST_SCHEMA = 'x402inc.payee-allowlist/v0';

export function loadPolicy(path) {
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  return validatePolicy(raw);
}

export function validatePolicy(raw) {
  if (raw.schema !== POLICY_SCHEMA) {
    throw new Error(`spend-policy: unexpected schema "${raw.schema}" (want "${POLICY_SCHEMA}")`);
  }
  const caps = raw.caps;
  if (!caps || typeof caps !== 'object') throw new Error('spend-policy: missing caps');
  for (const f of ['currency', 'network', 'asset', 'assetDecimals', 'perTransactionMax', 'totalMax']) {
    if (caps[f] === undefined) throw new Error(`spend-policy: caps.${f} is required`);
  }
  if (!Number.isInteger(caps.assetDecimals) || caps.assetDecimals < 0) {
    throw new Error('spend-policy: caps.assetDecimals must be a non-negative integer');
  }
  assertDecimal('caps.perTransactionMax', caps.perTransactionMax);
  assertDecimal('caps.totalMax', caps.totalMax);
  // A per-transaction cap above the total cap is a policy authoring mistake, not a
  // silent no-op — surface it.
  if (toAtomic(caps.perTransactionMax, caps) > toAtomic(caps.totalMax, caps)) {
    throw new Error('spend-policy: caps.perTransactionMax exceeds caps.totalMax');
  }

  if (!Array.isArray(raw.payees) || raw.payees.length === 0) {
    throw new Error('spend-policy: payees must be a non-empty array');
  }
  const ids = new Set();
  const addrs = new Set();
  for (const p of raw.payees) {
    if (!p.id) throw new Error('spend-policy: each payee needs an id');
    if (ids.has(p.id)) throw new Error(`spend-policy: duplicate payee id "${p.id}"`);
    ids.add(p.id);
    if (typeof p.payTo !== 'string' || p.payTo.length === 0) {
      throw new Error(`spend-policy: payee "${p.id}" needs a non-empty payTo`);
    }
    const key = p.payTo.toLowerCase();
    if (addrs.has(key)) throw new Error(`spend-policy: duplicate payTo "${p.payTo}" (payee "${p.id}")`);
    addrs.add(key);
    if (p.perTransactionMax !== undefined) {
      assertDecimal(`payee "${p.id}" perTransactionMax`, p.perTransactionMax);
      if (toAtomic(p.perTransactionMax, caps) > toAtomic(caps.perTransactionMax, caps)) {
        throw new Error(`spend-policy: payee "${p.id}" perTransactionMax exceeds the global caps.perTransactionMax`);
      }
    }
  }
  return raw;
}

// Build the approved-payee allowlist artifact from a validated policy. This is the
// self-defined OUTPUT that a network-enabled step would later inject into a
// Virtual Wallet (that injection is Category B — see wallet-adapter.mjs).
export function buildAllowlist(policy) {
  const caps = policy.caps;
  return {
    schema: ALLOWLIST_SCHEMA,
    generatedFrom: POLICY_SCHEMA,
    currency: caps.currency,
    network: caps.network,
    asset: caps.asset,
    assetDecimals: caps.assetDecimals,
    perTransactionMaxAtomic: toAtomic(caps.perTransactionMax, caps),
    totalMaxAtomic: toAtomic(caps.totalMax, caps),
    payees: policy.payees.map((p) => ({
      id: p.id,
      payTo: p.payTo,
      label: p.label ?? null,
      perTransactionMaxAtomic: toAtomic(p.perTransactionMax ?? caps.perTransactionMax, caps),
    })),
  };
}

// Decide whether a single proposed payment is authorized under the policy, given
// how much has already been spent. A DENY is a normal returned decision (with
// reasons), not a throw — the same posture the 402 checker takes. A malformed
// input (bad amount) IS a throw: that is a surprise, not a decision.
//
// request: { payTo, amount(decimal string), network?, asset? }
// state:   { spentAtomic(string) }  — defaults to "0"
export function evaluatePayment(policy, request, state = {}) {
  const caps = policy.caps;
  const reasons = [];
  const deny = (code, message) => reasons.push({ code, message });

  if (typeof request.payTo !== 'string' || request.payTo.length === 0) {
    throw new Error('evaluatePayment: request.payTo is required');
  }
  const amountAtomic = toAtomic(request.amount, caps); // throws on malformed amount
  const spentAtomic = BigInt(state.spentAtomic ?? '0');

  const payee = policy.payees.find((p) => p.payTo.toLowerCase() === request.payTo.toLowerCase());
  if (!payee) {
    deny('payee-not-allowed', `payTo "${request.payTo}" is not in the allowlist`);
  }
  if (request.network !== undefined && request.network !== caps.network) {
    deny('network-mismatch', `network "${request.network}" != policy network "${caps.network}"`);
  }
  if (request.asset !== undefined && request.asset.toLowerCase() !== caps.asset.toLowerCase()) {
    deny('asset-mismatch', `asset "${request.asset}" != policy asset "${caps.asset}"`);
  }

  const perTxnCapAtomic = toAtomic(payee?.perTransactionMax ?? caps.perTransactionMax, caps);
  const amt = BigInt(amountAtomic);
  if (amt > BigInt(perTxnCapAtomic)) {
    deny('per-transaction-exceeded', `amount ${amountAtomic} exceeds per-transaction cap ${perTxnCapAtomic}`);
  }
  const projected = spentAtomic + amt;
  if (projected > BigInt(toAtomic(caps.totalMax, caps))) {
    deny('total-cap-exceeded', `projected spend ${projected} exceeds total cap ${toAtomic(caps.totalMax, caps)}`);
  }

  return {
    allowed: reasons.length === 0,
    reasons,
    payeeId: payee?.id ?? null,
    amountAtomic,
    projectedSpentAtomic: projected.toString(),
  };
}

function assertDecimal(label, v) {
  if (typeof v !== 'string' || !/^\d+(\.\d+)?$/.test(v)) {
    throw new Error(`spend-policy: ${label} "${v}" must be a decimal string`);
  }
}

function toAtomic(amountStr, caps) {
  return decimalToAtomic(amountStr, caps.assetDecimals);
}
