// Build the RFC 9421 §2.5 signature base for a request. Shared by the signer and
// the verifier so both compute byte-identical input.
//
// Spec basis: RFC 9421 §2.5 (Creating the Signature Base).

import { resolveComponent, assertAllowedComponents } from './components.mjs';
import { serializeInnerList } from './sfv.mjs';

// components: array of lowercase component identifiers, e.g.
//   ['@authority', '@method', '@path', 'signature-agent']
// params: array of [key, value] pairs in the order they should appear, e.g.
//   [['created', 1700000000], ['keyid', 'abc'], ['alg', 'ed25519'], ['tag', 'web-bot-auth']]
export function buildSignatureBase(request, components, params) {
  assertAllowedComponents(components);
  const lines = [];
  for (const c of components) {
    const name = c.toLowerCase();
    const value = resolveComponent(name, request);
    lines.push(`"${name}": ${value}`);
  }
  const sigParams = serializeInnerList(components, params);
  lines.push(`"@signature-params": ${sigParams}`);
  return { base: lines.join('\n'), sigParams };
}

// Verifier variant: rebuild the base using the EXACT @signature-params string
// received on the wire (rawSigParams), so re-serialization can never introduce a
// mismatch. components must be the parsed item list from that same header.
export function rebuildSignatureBase(request, components, rawSigParams) {
  assertAllowedComponents(components);
  const lines = [];
  for (const c of components) {
    const name = c.toLowerCase();
    const value = resolveComponent(name, request);
    lines.push(`"${name}": ${value}`);
  }
  lines.push(`"@signature-params": ${rawSigParams}`);
  return lines.join('\n');
}
