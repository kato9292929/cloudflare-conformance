// Load and validate x402 Inc.'s declarative billing rules (data/billing-rules.json).
// This is the implementation-independent source of truth; the 402 checker cross-
// checks actual responses against it, and the Gateway adapter (gateway-adapter.mjs)
// would later map it onto Cloudflare's rule format.
//
// The schema is SELF-DEFINED.
// CONFORMANCE-TAG: UNVERIFIED | framework=monetization-gateway | billing-rules schema (x402inc.billing-rules/v0) is self-defined and implementation-independent; Cloudflare Gateway rule format is unpublished so no field is modeled on it | ref=data/billing-rules.json

import { readFileSync } from 'node:fs';

const EXPECTED_SCHEMA = 'x402inc.billing-rules/v0';

export function loadRules(path) {
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  return validateRules(raw);
}

export function validateRules(raw) {
  if (raw.schema !== EXPECTED_SCHEMA) {
    throw new Error(`billing-rules: unexpected schema "${raw.schema}" (want "${EXPECTED_SCHEMA}")`);
  }
  if (!raw.defaults || typeof raw.defaults !== 'object') throw new Error('billing-rules: missing defaults');
  const d = raw.defaults;
  for (const f of ['currency', 'network', 'payTo', 'asset', 'assetDecimals', 'scheme']) {
    if (d[f] === undefined) throw new Error(`billing-rules: defaults.${f} is required`);
  }
  if (!Number.isInteger(d.assetDecimals) || d.assetDecimals < 0) {
    throw new Error('billing-rules: defaults.assetDecimals must be a non-negative integer');
  }
  if (!Array.isArray(raw.rules) || raw.rules.length === 0) throw new Error('billing-rules: rules must be a non-empty array');

  const ids = new Set();
  for (const r of raw.rules) {
    if (!r.id) throw new Error('billing-rules: each rule needs an id');
    if (ids.has(r.id)) throw new Error(`billing-rules: duplicate rule id "${r.id}"`);
    ids.add(r.id);
    if (!r.match || (!r.match.pathExact && !r.match.pathPrefix)) {
      throw new Error(`billing-rules: rule "${r.id}" needs match.pathExact or match.pathPrefix`);
    }
    if (r.match.methods && !Array.isArray(r.match.methods)) {
      throw new Error(`billing-rules: rule "${r.id}" match.methods must be an array`);
    }
    if (!r.price || typeof r.price.amount !== 'string') {
      throw new Error(`billing-rules: rule "${r.id}" needs price.amount as a decimal string`);
    }
    if (!/^\d+(\.\d+)?$/.test(r.price.amount)) {
      throw new Error(`billing-rules: rule "${r.id}" price.amount "${r.price.amount}" is not a decimal string`);
    }
  }
  return raw;
}

// Resolve the first rule matching (path, method), merged over defaults.
// Returns null if nothing matches. Fail loudly on ambiguous method handling is
// not needed — first match wins, in declared order (documented behavior).
export function resolveRule(ruleset, path, method) {
  for (const r of ruleset.rules) {
    if (r.match.methods && !r.match.methods.includes(method)) continue;
    const matched =
      (r.match.pathExact && r.match.pathExact === path) ||
      (r.match.pathPrefix && path.startsWith(r.match.pathPrefix));
    if (matched) {
      return {
        id: r.id,
        path,
        method,
        scheme: r.scheme ?? ruleset.defaults.scheme,
        network: r.network ?? r.price.network ?? ruleset.defaults.network,
        currency: r.price.currency ?? ruleset.defaults.currency,
        asset: r.asset ?? ruleset.defaults.asset,
        assetDecimals: r.assetDecimals ?? ruleset.defaults.assetDecimals,
        payTo: r.payTo ?? ruleset.defaults.payTo,
        maxTimeoutSeconds: r.maxTimeoutSeconds ?? ruleset.defaults.maxTimeoutSeconds,
        amountDecimal: r.price.amount,
        amountAtomic: decimalToAtomic(r.price.amount, r.assetDecimals ?? ruleset.defaults.assetDecimals),
        useCase: r.useCase ?? null,
      };
    }
  }
  return null;
}

// Convert a decimal string (e.g. "0.010") to atomic units for the given decimals
// (e.g. 6 -> "10000"). Pure string/BigInt math — no floating point.
export function decimalToAtomic(amountStr, decimals) {
  if (!/^\d+(\.\d+)?$/.test(amountStr)) throw new Error(`decimalToAtomic: invalid decimal "${amountStr}"`);
  const [intPart, fracPartRaw = ''] = amountStr.split('.');
  if (fracPartRaw.length > decimals) {
    throw new Error(`decimalToAtomic: "${amountStr}" has more fractional digits than assetDecimals=${decimals}`);
  }
  const fracPadded = fracPartRaw.padEnd(decimals, '0');
  const atomic = BigInt(intPart) * 10n ** BigInt(decimals) + BigInt(fracPadded || '0');
  return atomic.toString();
}
