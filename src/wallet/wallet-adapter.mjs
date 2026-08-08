// Adapter boundary between x402 Inc.'s self-defined spend policy and a wallet
// provider. As with the M2 Gateway adapter, the point is NOT to swap in Cloudflare
// Wallets (announced 2026-08-04, handle reservation only) but to make the seam
// where it WOULD plug in explicit.
//
// Two implementations of the same boundary:
//   - localAllowlistProvider:  enforces the policy in-process (authorize a payment,
//                              export the allowlist artifact). Fully implemented.
//   - cloudflareWalletsProvider: would provision a Virtual Wallet and authorize
//                              spend via Cloudflare's API. NOT implemented — the
//                              funding/spend/API spec is unpublished. It throws
//                              loudly rather than guessing, and is labeled PENDING-B.
//
// A caller selects a provider; nothing else changes when the Wallets provider
// becomes real.

import { evaluatePayment, buildAllowlist } from './policy.mjs';

export function localAllowlistProvider(policy) {
  return {
    name: 'local-allowlist',
    // Decide a single payment against the policy + prior spend.
    authorize(request, state) {
      return evaluatePayment(policy, request, state);
    },
    // Produce the self-defined allowlist artifact (what a network step would inject).
    exportAllowlist() {
      return buildAllowlist(policy);
    },
  };
}

// Cloudflare Wallets provider — deliberately unimplemented. Do not guess the
// unpublished funding/spend/provisioning API.
// CONFORMANCE-TAG: PENDING-B | framework=cloudflare-wallets | Cloudflare Wallets provisioning/spend API is unpublished (handle reservation only); injecting the payee-allowlist into a Virtual Wallet and authorizing spend through it is intentionally unimplemented — boundary exists so it can be swapped in without other code changes | ref=https://www.cloudflare.com/press/press-releases/2026/cloudflare-gives-ai-agents-an-identity-and-a-wallet/
export function cloudflareWalletsProvider() {
  const unimplemented = () => {
    throw new Error(
      'cloudflareWalletsProvider: Cloudflare Wallets funding/spend/provisioning API is unpublished ' +
        '(announced 2026-08-04, handle reservation only). This boundary is intentionally unimplemented — ' +
        'see docs/conformance/cloudflare-wallets.md (区分B).'
    );
  };
  return {
    name: 'cloudflare-wallets',
    authorize: unimplemented,
    exportAllowlist: unimplemented,
  };
}
