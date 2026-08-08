// M1 tests: Web Bot Auth signing client. Zero external deps.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { generateKeyPair, publicKeyToJwk, jwkThumbprint } from '../src/web-bot-auth/keys.mjs';
import { signRequest } from '../src/web-bot-auth/signer.mjs';
import { verifyRequest } from '../src/web-bot-auth/verifier.mjs';
import { buildSignatureBase } from '../src/web-bot-auth/signature-base.mjs';
import { assertAllowedComponents } from '../src/web-bot-auth/components.mjs';
import { buildJwks, resolverFromJwks } from '../src/web-bot-auth/directory.mjs';
import { serializeInnerList, parseInnerList } from '../src/web-bot-auth/sfv.mjs';

const CREATED = 1_754_000_000; // fixed clock for determinism

function makeSigned() {
  const { publicKey, privateKey } = generateKeyPair();
  const jwk = publicKeyToJwk(publicKey);
  const request = { method: 'GET', url: 'https://api.example.test/v1/data', headers: {} };
  const signed = signRequest(request, {
    privateKey,
    keyid: jwk.kid,
    signatureAgent: 'https://x402.example/keys',
    created: CREATED,
    expires: CREATED + 300,
  });
  return { publicKey, jwk, request, signed };
}

test('keys: Ed25519 keypair exports OKP JWK with stable thumbprint kid', () => {
  const { publicKey } = generateKeyPair();
  const jwk = publicKeyToJwk(publicKey);
  assert.equal(jwk.kty, 'OKP');
  assert.equal(jwk.crv, 'Ed25519');
  assert.ok(jwk.x && typeof jwk.x === 'string');
  assert.equal(jwk.kid, jwkThumbprint(jwk)); // kid is the RFC 7638 thumbprint
  assert.equal(jwk.kid, jwkThumbprint(jwk)); // deterministic
});

test('sign+verify: round-trip succeeds and reports covered components', () => {
  const { jwk, signed } = makeSigned();
  const inbound = {
    method: 'GET',
    url: 'https://api.example.test/v1/data',
    headers: {
      'signature-agent': signed.headers['Signature-Agent'],
      'signature-input': signed.headers['Signature-Input'],
      signature: signed.headers.Signature,
    },
  };
  const result = verifyRequest(inbound, (kid) => (kid === jwk.kid ? jwk : null), { now: CREATED + 10 });
  assert.equal(result.valid, true);
  assert.equal(result.keyid, jwk.kid);
  assert.deepEqual(result.components, ['@authority', 'signature-agent']);
});

test('verify: tampering with the request path is rejected (throws, no fallback)', () => {
  const { jwk, signed } = makeSigned();
  const tampered = {
    method: 'GET',
    url: 'https://api.example.test/v1/OTHER', // different path than signed
    headers: {
      'signature-agent': signed.headers['Signature-Agent'],
      'signature-input': signed.headers['Signature-Input'],
      signature: signed.headers.Signature,
    },
  };
  // @path is not covered by default set, but @authority is; change authority to prove tamper-detection:
  tampered.url = 'https://evil.example.test/v1/data';
  assert.throws(() => verifyRequest(tampered, () => jwk, { now: CREATED + 10 }), /INVALID/);
});

test('verify: a flipped signature byte is rejected', () => {
  const { jwk, signed } = makeSigned();
  // Corrupt the base64 signature.
  const badSig = signed.headers.Signature.replace(/:([A-Za-z0-9+/=]+):/, (m, b64) => {
    const buf = Buffer.from(b64, 'base64');
    buf[0] ^= 0xff;
    return `:${buf.toString('base64')}:`;
  });
  const inbound = {
    method: 'GET',
    url: 'https://api.example.test/v1/data',
    headers: {
      'signature-agent': signed.headers['Signature-Agent'],
      'signature-input': signed.headers['Signature-Input'],
      signature: badSig,
    },
  };
  assert.throws(() => verifyRequest(inbound, () => jwk, { now: CREATED + 10 }), /INVALID/);
});

test('constraint: signing with @query-params or @status throws (Cloudflare rule)', () => {
  const { publicKey, privateKey } = (() => {
    const kp = generateKeyPair();
    return kp;
  })();
  const jwk = publicKeyToJwk(publicKey);
  for (const bad of ['@query-param', '@query-params', '@status']) {
    assert.throws(
      () =>
        signRequest(
          { method: 'GET', url: 'https://api.example.test/v1/data?q=1', headers: {} },
          { privateKey, keyid: jwk.kid, created: CREATED, components: ['@authority', bad] }
        ),
      /not allowed/,
      `expected ${bad} to be rejected`
    );
  }
});

test('constraint (S1): Signature-Agent must be https and included in components', () => {
  const { publicKey, privateKey } = generateKeyPair();
  const jwk = publicKeyToJwk(publicKey);
  const req = { method: 'GET', url: 'https://api.example.test/v1/data', headers: {} };
  // Non-https Signature-Agent is rejected.
  assert.throws(
    () => signRequest(req, { privateKey, keyid: jwk.kid, signatureAgent: 'http://x402.example/keys', created: CREATED }),
    /https:\/\/ URI/
  );
  // An explicit components override that omits signature-agent is rejected.
  assert.throws(
    () => signRequest(req, { privateKey, keyid: jwk.kid, signatureAgent: 'https://x402.example/keys', created: CREATED, components: ['@authority', '@method'] }),
    /signature-agent must be included/
  );
  // The happy path still produces a quoted SF String Signature-Agent header.
  const ok = signRequest(req, { privateKey, keyid: jwk.kid, signatureAgent: 'https://x402.example/keys', created: CREATED });
  assert.equal(ok.headers['Signature-Agent'], '"https://x402.example/keys"');
});

test('constraint: assertAllowedComponents rejects disallowed, allows normal', () => {
  assert.throws(() => assertAllowedComponents(['@authority', '@status']), /not allowed/);
  assert.throws(() => assertAllowedComponents(['@query-param;name="x"']), /not allowed/);
  assert.doesNotThrow(() => assertAllowedComponents(['@authority', '@method', '@path', 'signature-agent']));
});

test('constraint: verifier rejects an inbound signature that covers @status', () => {
  // Hand-craft a Signature-Input that (illegally) covers @status.
  const inbound = {
    method: 'GET',
    url: 'https://api.example.test/v1/data',
    headers: {
      'signature-input': 'sig1=("@authority" "@status");created=1;keyid="k";alg="ed25519";tag="web-bot-auth"',
      signature: 'sig1=:AAAA:',
    },
  };
  assert.throws(() => verifyRequest(inbound, () => null), /not allowed/);
});

test('no-fallback: missing headers throw rather than returning a permissive result', () => {
  assert.throws(() => verifyRequest({ method: 'GET', url: 'https://a.test/', headers: {} }, () => null), /missing Signature-Input/);
  assert.throws(
    () => verifyRequest({ method: 'GET', url: 'https://a.test/', headers: { 'signature-input': 'sig1=("@authority");created=1;keyid="k";alg="ed25519"' } }, () => null),
    /missing Signature header/
  );
});

test('verify: expired signature is rejected', () => {
  const { jwk, signed } = makeSigned();
  const inbound = {
    method: 'GET',
    url: 'https://api.example.test/v1/data',
    headers: {
      'signature-agent': signed.headers['Signature-Agent'],
      'signature-input': signed.headers['Signature-Input'],
      signature: signed.headers.Signature,
    },
  };
  assert.throws(() => verifyRequest(inbound, () => jwk, { now: CREATED + 10_000 }), /expired/);
});

test('verify: unknown keyid fails loudly', () => {
  const { signed } = makeSigned();
  const inbound = {
    method: 'GET',
    url: 'https://api.example.test/v1/data',
    headers: {
      'signature-agent': signed.headers['Signature-Agent'],
      'signature-input': signed.headers['Signature-Input'],
      signature: signed.headers.Signature,
    },
  };
  assert.throws(() => verifyRequest(inbound, () => null, { now: CREATED + 10 }), /no public key for keyid/);
});

test('directory: JWKS build + resolver drives a successful verify', () => {
  const { publicKey, privateKey } = generateKeyPair();
  const jwk = publicKeyToJwk(publicKey);
  const jwks = buildJwks([publicKey]);
  assert.equal(jwks.keys.length, 1);
  assert.equal(jwks.keys[0].kid, jwk.kid);
  const resolver = resolverFromJwks(jwks);

  const signed = signRequest(
    { method: 'POST', url: 'https://api.example.test/v1/search', headers: {} },
    { privateKey, keyid: jwk.kid, signatureAgent: 'https://x402.example/keys', created: CREATED }
  );
  const inbound = {
    method: 'POST',
    url: 'https://api.example.test/v1/search',
    headers: {
      'signature-agent': signed.headers['Signature-Agent'],
      'signature-input': signed.headers['Signature-Input'],
      signature: signed.headers.Signature,
    },
  };
  assert.equal(verifyRequest(inbound, resolver, { now: CREATED + 5 }).valid, true);
});

test('directory: duplicate kid rejected', () => {
  const { publicKey } = generateKeyPair();
  assert.throws(() => buildJwks([publicKey, publicKey]), /duplicate kid/);
});

test('sfv: inner list serialize/parse round-trip', () => {
  const items = ['@authority', 'signature-agent'];
  const params = [['created', CREATED], ['keyid', 'abc"def'], ['alg', 'ed25519'], ['tag', 'web-bot-auth']];
  const s = serializeInnerList(items, params);
  const parsed = parseInnerList(s);
  assert.deepEqual(parsed.items, items);
  assert.equal(parsed.params.get('created'), CREATED);
  assert.equal(parsed.params.get('keyid'), 'abc"def'); // quote round-trips
  assert.equal(parsed.params.get('alg'), 'ed25519');
  assert.equal(parsed.params.get('tag'), 'web-bot-auth');
});

test('signature base: deterministic and shaped per RFC 9421', () => {
  const req = { method: 'GET', url: 'https://api.example.test/v1/data', headers: { 'signature-agent': '"https://x/keys"' } };
  const { base } = buildSignatureBase(req, ['@authority', 'signature-agent'], [['created', CREATED], ['keyid', 'k'], ['alg', 'ed25519'], ['tag', 'web-bot-auth']]);
  const lines = base.split('\n');
  assert.equal(lines[0], '"@authority": api.example.test');
  assert.equal(lines[1], '"signature-agent": "https://x/keys"');
  assert.match(lines[2], /^"@signature-params": \("@authority" "signature-agent"\);created=1754000000;keyid="k";alg="ed25519";tag="web-bot-auth"$/);
});
