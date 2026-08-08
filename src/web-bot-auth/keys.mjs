// Ed25519 key handling for Web Bot Auth.
//
// Spec basis: RFC 8032 (Ed25519), RFC 8037 (CFRG curves in JWK — OKP/Ed25519),
// RFC 7638 (JWK Thumbprint, used as the key id).
//
// Uses Node's built-in crypto (no external dependencies).

import { generateKeyPairSync, createPublicKey, createPrivateKey, createHash } from 'node:crypto';

export function generateKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return { publicKey, privateKey };
}

// Export the public key as an RFC 8037 OKP JWK, augmented with a `kid` equal to
// its RFC 7638 thumbprint and `alg` per RFC 8037.
export function publicKeyToJwk(publicKey) {
  const jwk = publicKey.export({ format: 'jwk' });
  if (jwk.kty !== 'OKP' || jwk.crv !== 'Ed25519') {
    throw new Error(`web-bot-auth: expected an Ed25519 OKP key, got kty=${jwk.kty} crv=${jwk.crv}`);
  }
  const kid = jwkThumbprint(jwk);
  return { kty: jwk.kty, crv: jwk.crv, x: jwk.x, alg: 'EdDSA', use: 'sig', kid };
}

export function privateKeyToJwk(privateKey) {
  const jwk = privateKey.export({ format: 'jwk' });
  if (jwk.kty !== 'OKP' || jwk.crv !== 'Ed25519') {
    throw new Error(`web-bot-auth: expected an Ed25519 OKP private key, got kty=${jwk.kty}`);
  }
  const pub = createPublicKey({ key: jwk, format: 'jwk' });
  const kid = jwkThumbprint(pub.export({ format: 'jwk' }));
  return { ...jwk, alg: 'EdDSA', use: 'sig', kid };
}

// Using the RFC 7638 thumbprint as the kid is an implementation choice; Cloudflare
// may require a different kid convention. Not confirmable here (egress blocked).
// CONFORMANCE-TAG: UNVERIFIED | framework=web-bot-auth | kid is set to the RFC 7638 JWK thumbprint by choice; Cloudflare's required kid convention not confirmed | ref=docs/sources.md
// RFC 7638 thumbprint: base64url(SHA-256(canonical JSON of required members)).
// For OKP keys the required members are {crv, kty, x} in lexicographic order.
export function jwkThumbprint(jwk) {
  if (jwk.kty !== 'OKP') throw new Error(`web-bot-auth: thumbprint only implemented for OKP, got ${jwk.kty}`);
  const canonical = `{"crv":"${jwk.crv}","kty":"${jwk.kty}","x":"${jwk.x}"}`;
  return createHash('sha256').update(canonical).digest('base64url');
}

export function publicKeyFromJwk(jwk) {
  return createPublicKey({ key: jwk, format: 'jwk' });
}

export function privateKeyFromJwk(jwk) {
  return createPrivateKey({ key: jwk, format: 'jwk' });
}
