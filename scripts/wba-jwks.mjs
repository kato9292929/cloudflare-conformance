#!/usr/bin/env node
// Build a JWKS directory from one or more public JWK files.
//   node scripts/wba-jwks.mjs out/web-bot-auth/public.jwk.json --out out/web-bot-auth/jwks.json
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { buildJwks } from '../src/web-bot-auth/directory.mjs';

const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const out = outIdx !== -1 ? args[outIdx + 1] : 'out/web-bot-auth/jwks.json';
// Inputs are the positional args, excluding --out and the path that follows it.
const inputs = args.filter((a, i) => i !== outIdx && i !== outIdx + 1 && !a.startsWith('--'));
if (inputs.length === 0) {
  console.error('usage: wba-jwks.mjs <public.jwk.json> [more...] [--out jwks.json]');
  process.exit(1);
}

const jwks = buildJwks(inputs.map((p) => JSON.parse(readFileSync(p, 'utf8'))));
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(jwks, null, 2) + '\n');
console.log(`wrote ${out} with ${jwks.keys.length} key(s): ${jwks.keys.map((k) => k.kid).join(', ')}`);
