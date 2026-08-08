// Public key directory for Web Bot Auth. The directory served at the
// Signature-Agent URL is a JWK Set (RFC 7517) of the signer's Ed25519 public
// keys. Verifiers fetch it and match by `kid` (the RFC 7638 thumbprint).
//
// Spec basis: RFC 7517 (JWK Set), RFC 8037 (OKP), RFC 7638 (thumbprint/kid).
// The exact directory path/media-type Cloudflare expects is Web-Bot-Auth-specific
// and unconfirmed here (egress blocked).
// CONFORMANCE-TAG: PENDING-B | framework=web-bot-auth | JWKS directory shape follows RFC 7517/8037; Cloudflare's expected directory URL path and media type not confirmed against primary docs | ref=docs/sources.md

import { publicKeyToJwk } from './keys.mjs';

// publicKeys: array of Node KeyObject (Ed25519 public) OR already-exported JWKs.
export function buildJwks(publicKeys) {
  const keys = publicKeys.map((k) => (isJwk(k) ? k : publicKeyToJwk(k)));
  const kids = new Set();
  for (const k of keys) {
    if (!k.kid) throw new Error('buildJwks: each JWK must have a kid (thumbprint)');
    if (kids.has(k.kid)) throw new Error(`buildJwks: duplicate kid "${k.kid}"`);
    kids.add(k.kid);
  }
  return { keys };
}

// Build a resolver suitable for verifyRequest from a JWKS: matches by kid.
export function resolverFromJwks(jwks) {
  const byKid = new Map();
  for (const k of jwks.keys) byKid.set(k.kid, k);
  return (keyid) => byKid.get(keyid) || null;
}

function isJwk(x) {
  return x && typeof x === 'object' && typeof x.kty === 'string';
}
