// Public key directory for Web Bot Auth. The directory served at the
// Signature-Agent URL is a JWK Set (RFC 7517) of the signer's Ed25519 public
// keys. Verifiers fetch it and match by `kid` (the RFC 7638 thumbprint).
//
// Spec basis: RFC 7517 (JWK Set), RFC 8037 (OKP), RFC 7638 (thumbprint/kid).

// The well-known directory path is confirmed by Cloudflare's reference
// implementation (S3): the bot directory is exposed at
// /.well-known/http-message-signatures-directory.
// CONFORMANCE-TAG: VERIFIED | framework=web-bot-auth | Cloudflare's web-bot-auth reference implementation exposes the key directory at /.well-known/http-message-signatures-directory | ref=S3
export const DIRECTORY_PATH = '/.well-known/http-message-signatures-directory';

// The JWKS shape follows the RFCs, but the exact media type Cloudflare expects
// for the directory response was not among the retrieved sources.
// CONFORMANCE-TAG: PENDING-B | framework=web-bot-auth | JWKS directory shape follows RFC 7517/8037; the directory response media type Cloudflare expects is not confirmed against primary docs | ref=docs/sources.md

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
