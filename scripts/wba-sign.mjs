#!/usr/bin/env node
// Sign a request with Web Bot Auth headers, then verify the result with the
// matching public key (a self-contained sign+verify round trip). Prints the
// signature base, the three headers, and the verification outcome.
//
//   node scripts/wba-sign.mjs --url https://api.example.test/v1/data \
//       --method GET --agent https://x402.example/keys [--key out/web-bot-auth/private.jwk.json]
//
// With no --key, an ephemeral keypair is generated for the demo.
import { readFileSync } from 'node:fs';
import {
  generateKeyPair,
  publicKeyToJwk,
  privateKeyFromJwk,
  privateKeyToJwk,
} from '../src/web-bot-auth/keys.mjs';
import { signRequest } from '../src/web-bot-auth/signer.mjs';
import { verifyRequest } from '../src/web-bot-auth/verifier.mjs';

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : def;
}

const url = arg('--url', 'https://api.example.test/v1/data');
const method = arg('--method', 'GET');
const agent = arg('--agent', 'https://x402.example/keys');
const keyPath = arg('--key', null);
// Fixed clock keeps the demo output reproducible except for the random key.
const created = Number(arg('--created', '1754000000'));

let privateKey, pubJwk;
if (keyPath) {
  const privJwk = JSON.parse(readFileSync(keyPath, 'utf8'));
  privateKey = privateKeyFromJwk(privJwk);
  pubJwk = publicKeyToJwk((await import('node:crypto')).createPublicKey({ key: privJwk, format: 'jwk' }));
} else {
  const kp = generateKeyPair();
  privateKey = kp.privateKey;
  pubJwk = publicKeyToJwk(kp.publicKey);
  console.log('(no --key given; generated an ephemeral keypair for this demo)');
}

const signed = signRequest(
  { method, url, headers: {} },
  { privateKey, keyid: pubJwk.kid, signatureAgent: agent, created, expires: created + 300 }
);

console.log('\n=== signature base ===');
console.log(signed.signatureBase);
console.log('\n=== headers ===');
for (const [k, v] of Object.entries(signed.headers)) console.log(`${k}: ${v}`);

const inbound = {
  method,
  url,
  headers: {
    'signature-agent': signed.headers['Signature-Agent'],
    'signature-input': signed.headers['Signature-Input'],
    signature: signed.headers.Signature,
  },
};
const result = verifyRequest(inbound, (kid) => (kid === pubJwk.kid ? pubJwk : null), { now: created + 10 });
console.log('\n=== verify ===');
console.log(`valid=${result.valid} keyid=${result.keyid} components=${JSON.stringify(result.components)}`);
