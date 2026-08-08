// Web Bot Auth request signer — builds the three headers:
//   Signature-Agent  : the URL of the signer's key directory (SF String)
//   Signature-Input  : the covered components + parameters (SF Dictionary member)
//   Signature        : the Ed25519 signature (SF Byte Sequence)
//
// Spec basis: RFC 9421 §3.1 (signing), §4 (headers). The Signature-Agent header
// and tag="web-bot-auth" convention are Web-Bot-Auth-specific; their exact
// required form is PENDING-B (primary docs not retrieved).

import { sign as edSign } from 'node:crypto';
import { buildSignatureBase } from './signature-base.mjs';
import { serializeByteSequence } from './sfv.mjs';

// The default covered set is a reasonable Web Bot Auth choice, but the exact set
// Cloudflare requires is not confirmed here.
// CONFORMANCE-TAG: PENDING-B | framework=web-bot-auth | Default covered components (@authority + signature-agent) chosen per the web-bot-auth draft; Cloudflare's exact required set not confirmed against primary docs | ref=docs/sources.md
export const DEFAULT_TAG = 'web-bot-auth';

export function signRequest(request, options) {
  const {
    privateKey,
    keyid,
    signatureAgent,
    created,
    expires,
    nonce,
    tag = DEFAULT_TAG,
    label = 'sig1',
    alg = 'ed25519',
  } = options;

  if (!privateKey) throw new Error('signRequest: privateKey is required');
  if (!keyid) throw new Error('signRequest: keyid is required');
  if (created === undefined) throw new Error('signRequest: created (unix seconds) is required');

  // Assemble headers we control. Signature-Agent carries the directory URL as an
  // SF String (quoted). We sign over the exact header value we set.
  const headers = { ...(request.headers || {}) };
  if (signatureAgent) headers['signature-agent'] = `"${signatureAgent}"`;

  const components =
    options.components ??
    (signatureAgent ? ['@authority', 'signature-agent'] : ['@authority', '@method', '@path']);

  const params = [['created', created]];
  if (expires !== undefined) params.push(['expires', expires]);
  params.push(['keyid', keyid]);
  params.push(['alg', alg]);
  if (nonce !== undefined) params.push(['nonce', nonce]);
  params.push(['tag', tag]);

  const req = { ...request, headers };
  const { base, sigParams } = buildSignatureBase(req, components, params);

  if (alg !== 'ed25519') {
    // We only implement Ed25519. Do not silently accept another alg.
    throw new Error(`signRequest: unsupported alg "${alg}" (only ed25519 implemented)`);
  }
  const signature = edSign(null, Buffer.from(base, 'utf8'), privateKey); // Ed25519: algorithm must be null
  const sigB64 = signature.toString('base64');

  const outHeaders = {
    'Signature-Input': `${label}=${sigParams}`,
    Signature: `${label}=${serializeByteSequence(sigB64)}`,
  };
  if (signatureAgent) outHeaders['Signature-Agent'] = `"${signatureAgent}"`;

  return { headers: outHeaders, signatureBase: base, label };
}
