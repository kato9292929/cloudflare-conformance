// Static checker for HTTP 402 payment-required responses. Validates the response
// SHAPE (status, headers, body payment instructions) and cross-checks it against
// x402 Inc.'s declarative billing rules.
//
// The checker COLLECTS and REPORTS every problem it finds — that is its job as a
// validator. It never "passes" a response by filling in a default; a missing or
// wrong field is a reported problem, and the CLI exits non-zero when any problem
// exists (fail loudly at the process boundary).
//
// Spec basis: HTTP 402 (RFC 7231 §6.5.2) and the x402 protocol payment-
// requirements body (x402Version / accepts[]).
//
// The Monetization Gateway blog (S6) confirms the 402 payload carries the price,
// the accepted asset, and the payment destination — the checker requires all
// three (maxAmountRequired / asset / payTo).
// CONFORMANCE-TAG: VERIFIED | framework=monetization-gateway | Cloudflare's Monetization Gateway 402 payload contains price, accepted asset, and payment destination; the checker requires maxAmountRequired, asset, and payTo | ref=S6
//
// The REMAINING fields checked here (x402Version, scheme, network, resource,
// maxTimeoutSeconds) come from x402 engineering knowledge, not from S6; the full
// x402 wire contract and Gateway's own 402 contract were not retrieved verbatim.
// CONFORMANCE-TAG: PENDING-B | framework=monetization-gateway | the full x402 field set beyond price/asset/payTo (x402Version, scheme, network, resource, maxTimeoutSeconds) is checked from engineering knowledge; the x402 spec text and Gateway's exact 402 contract were not retrieved | ref=docs/sources.md

import { resolveRule } from './rules.mjs';

const REQUIRED_ACCEPT_FIELDS = {
  scheme: 'string',
  network: 'string',
  maxAmountRequired: 'string',
  resource: 'string',
  payTo: 'string',
  asset: 'string',
  maxTimeoutSeconds: 'number',
};

// response: { status, headers, body, resourcePath?, method? }
// ruleset: parsed billing rules (optional; when provided, cross-check runs)
export function checkResponse(response, { ruleset } = {}) {
  const problems = [];
  const add = (code, message) => problems.push({ code, message });

  if (response.status !== 402) add('status', `expected HTTP 402, got ${response.status}`);

  const ct = headerValue(response.headers, 'content-type');
  if (!ct) add('content-type-missing', 'Content-Type header is missing');
  else if (!/application\/json/i.test(ct)) add('content-type', `Content-Type must be application/json, got "${ct}"`);

  const body = response.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    add('body', 'response body must be a JSON object with payment instructions');
    return finalize(problems, null); // cannot check further
  }

  if (!Number.isInteger(body.x402Version) || body.x402Version < 1) {
    add('x402Version', `x402Version must be a positive integer, got ${JSON.stringify(body.x402Version)}`);
  }
  if (!Array.isArray(body.accepts) || body.accepts.length === 0) {
    add('accepts', 'body.accepts must be a non-empty array of payment requirements');
    return finalize(problems, null);
  }

  let matchedRuleId = null;
  body.accepts.forEach((acc, i) => {
    for (const [field, type] of Object.entries(REQUIRED_ACCEPT_FIELDS)) {
      if (acc[field] === undefined) add('accept-field', `accepts[${i}].${field} is required`);
      else if (typeof acc[field] !== type) add('accept-type', `accepts[${i}].${field} must be ${type}`);
    }
    if (typeof acc.maxAmountRequired === 'string' && !/^\d+$/.test(acc.maxAmountRequired)) {
      add('amount-format', `accepts[${i}].maxAmountRequired "${acc.maxAmountRequired}" must be an atomic-unit integer string`);
    }

    if (ruleset) {
      const path = response.resourcePath ?? safePath(acc.resource);
      const method = response.method ?? 'GET';
      if (!path) {
        add('resource-path', `accepts[${i}]: cannot determine resource path for rule cross-check`);
      } else {
        const rule = resolveRule(ruleset, path, method);
        if (!rule) {
          add('no-rule', `accepts[${i}]: no billing rule matches ${method} ${path} — a 402 without a rule is unexpected`);
        } else {
          matchedRuleId = rule.id;
          crossCheck(acc, rule, i, add);
        }
      }
    }
  });

  return finalize(problems, matchedRuleId);
}

function crossCheck(acc, rule, i, add) {
  if (acc.network !== rule.network) add('rule-network', `accepts[${i}].network "${acc.network}" != rule "${rule.id}" network "${rule.network}"`);
  if (acc.asset !== rule.asset) add('rule-asset', `accepts[${i}].asset "${acc.asset}" != rule "${rule.id}" asset "${rule.asset}"`);
  if (acc.scheme !== rule.scheme) add('rule-scheme', `accepts[${i}].scheme "${acc.scheme}" != rule "${rule.id}" scheme "${rule.scheme}"`);
  if (acc.maxAmountRequired !== rule.amountAtomic) {
    add('rule-amount', `accepts[${i}].maxAmountRequired "${acc.maxAmountRequired}" != rule "${rule.id}" expected "${rule.amountAtomic}" (${rule.amountDecimal} ${rule.currency} @ ${rule.assetDecimals} decimals)`);
  }
  if (rule.payTo && acc.payTo !== rule.payTo) add('rule-payto', `accepts[${i}].payTo != rule "${rule.id}" payTo`);
}

function finalize(problems, matchedRuleId) {
  return { ok: problems.length === 0, problems, matchedRuleId };
}

function headerValue(headers, name) {
  if (!headers) return undefined;
  for (const [k, v] of Object.entries(headers)) if (k.toLowerCase() === name) return Array.isArray(v) ? v.join(', ') : v;
  return undefined;
}

function safePath(resource) {
  try {
    return new URL(resource).pathname;
  } catch {
    return null;
  }
}
