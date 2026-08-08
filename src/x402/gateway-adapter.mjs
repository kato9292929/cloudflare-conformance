// Adapter boundary between x402 Inc.'s billing rules and a payment-requirements
// provider. The point of M2 is NOT to swap in Cloudflare Monetization Gateway
// (pre-GA, waitlist) but to make the seam where it WOULD plug in explicit.
//
// Two implementations of the same boundary:
//   - localProvider:   maps a billing rule -> x402 `accepts[]` entry, i.e. the
//                       current self-hosted x402 behavior. Fully implemented.
//   - gatewayProvider: would map billing rules -> Cloudflare Gateway rule format.
//                       NOT implemented — the format is unpublished. It throws
//                       loudly rather than guessing, and is labeled PENDING-B.
//
// A caller selects a provider; nothing else in the code changes when the
// Gateway provider becomes real.

import { resolveRule } from './rules.mjs';

// The boundary: given (path, method) and the ruleset, produce the payment
// requirements to advertise in a 402. Providers implement `paymentRequirements`.

export function localProvider(ruleset) {
  return {
    name: 'local-x402',
    paymentRequirements(path, method, { resourceUrl } = {}) {
      const rule = resolveRule(ruleset, path, method);
      if (!rule) return null; // no rule => not a paid resource
      return {
        x402Version: 1,
        accepts: [ruleToAccept(rule, resourceUrl ?? path)],
      };
    },
  };
}

export function ruleToAccept(rule, resource) {
  return {
    scheme: rule.scheme,
    network: rule.network,
    maxAmountRequired: rule.amountAtomic,
    resource,
    description: rule.useCase ? `paid resource (${rule.useCase})` : 'paid resource',
    mimeType: 'application/json',
    payTo: rule.payTo,
    asset: rule.asset,
    maxTimeoutSeconds: rule.maxTimeoutSeconds,
  };
}

// Gateway provider — deliberately unimplemented. Do not guess the Cloudflare
// Monetization Gateway rule format.
// CONFORMANCE-TAG: PENDING-B | framework=monetization-gateway | Gateway rule-format mapping intentionally unimplemented (format unpublished, waitlist/pre-GA); boundary exists so it can be swapped in without other code changes | ref=https://blog.cloudflare.com/monetization-gateway/
export function gatewayProvider() {
  return {
    name: 'cloudflare-monetization-gateway',
    paymentRequirements() {
      throw new Error(
        'gatewayProvider: Cloudflare Monetization Gateway rule format is unpublished (pre-GA, waitlist). ' +
          'This boundary is intentionally unimplemented — see docs/conformance/monetization-gateway.md (区分B).'
      );
    },
  };
}
