// Web Bot Auth request verifier. Reconstructs the RFC 9421 signature base from
// the received headers and checks the Ed25519 signature.
//
// FAIL-CLOSED by design: this returns true only on a cryptographically valid
// signature and THROWS on anything else. It never signals "proceed unsigned".
// The M1 brief forbids a fallback-to-unsigned path, so no such path exists here.
//
// Spec basis: RFC 9421 §3.2 (verification).

import { verify as edVerify } from 'node:crypto';
import { rebuildSignatureBase } from './signature-base.mjs';
import { assertAllowedComponents } from './components.mjs';
import {
  parseSingleMemberDict,
  parseInnerList,
  parseByteSequence,
} from './sfv.mjs';
import { publicKeyFromJwk } from './keys.mjs';

// keyResolver: (keyid) => Node KeyObject | JWK | null. Returning null/undefined
// means "no key" and verification fails loudly (not silently).
export function verifyRequest(request, keyResolver, { now } = {}) {
  const headers = request.headers || {};
  const sigInputRaw = getHeader(headers, 'signature-input');
  const sigRaw = getHeader(headers, 'signature');
  if (!sigInputRaw) throw new Error('verify: missing Signature-Input header');
  if (!sigRaw) throw new Error('verify: missing Signature header');

  const input = parseSingleMemberDict(sigInputRaw);
  const sig = parseSingleMemberDict(sigRaw);
  if (input.label !== sig.label) {
    throw new Error(`verify: Signature-Input label "${input.label}" != Signature label "${sig.label}"`);
  }

  const { items: components, params } = parseInnerList(input.value);
  assertAllowedComponents(components); // reject @query-params / @status even inbound

  const alg = params.get('alg');
  if (alg !== 'ed25519') throw new Error(`verify: unsupported or missing alg "${alg}" (only ed25519)`);

  const keyid = params.get('keyid');
  if (!keyid) throw new Error('verify: missing keyid parameter');

  // Optional expiry enforcement — if present and past, fail (do not accept).
  const expires = params.get('expires');
  if (expires !== undefined) {
    const clock = now ?? Math.floor(Date.now() / 1000);
    if (clock > expires) throw new Error(`verify: signature expired at ${expires} (now ${clock})`);
  }

  const resolved = keyResolver(keyid);
  if (!resolved) throw new Error(`verify: no public key for keyid "${keyid}"`);
  const publicKey = isKeyObject(resolved) ? resolved : publicKeyFromJwk(resolved);

  const base = rebuildSignatureBase(request, components, input.value);
  const sigBytes = Buffer.from(parseByteSequence(sig.value), 'base64');

  const ok = edVerify(null, Buffer.from(base, 'utf8'), publicKey, sigBytes);
  if (!ok) throw new Error('verify: Ed25519 signature is INVALID');
  return { valid: true, keyid, components, signatureBase: base };
}

function getHeader(headers, name) {
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === name) return Array.isArray(v) ? v.join(', ') : v;
  }
  return undefined;
}

function isKeyObject(x) {
  return x && typeof x === 'object' && typeof x.export === 'function' && 'asymmetricKeyType' in x;
}
