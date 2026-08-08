#!/usr/bin/env node
// Generate an Ed25519 keypair for Web Bot Auth.
//   node scripts/wba-keygen.mjs --out out/web-bot-auth
// Writes <out>/private.jwk.json (gitignored) and <out>/public.jwk.json, and
// prints the kid (RFC 7638 thumbprint). Private material is NEVER printed.
import { mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { generateKeyPair, publicKeyToJwk, privateKeyToJwk } from '../src/web-bot-auth/keys.mjs';

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : def;
}

const outDir = arg('--out', 'out/web-bot-auth');
mkdirSync(outDir, { recursive: true });

const { publicKey, privateKey } = generateKeyPair();
const pub = publicKeyToJwk(publicKey);
const priv = privateKeyToJwk(privateKey);

const privPath = join(outDir, 'private.jwk.json');
writeFileSync(privPath, JSON.stringify(priv, null, 2) + '\n');
chmodSync(privPath, 0o600);
writeFileSync(join(outDir, 'public.jwk.json'), JSON.stringify(pub, null, 2) + '\n');

console.log(`kid: ${pub.kid}`);
console.log(`wrote ${privPath} (0600, gitignored) and ${join(outDir, 'public.jwk.json')}`);
