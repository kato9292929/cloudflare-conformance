// Web Bot Auth request signer — builds the three headers Cloudflare's message-
// signature verification reads:
//   Signature-Agent  : the URL of the signer's key directory (SF String)
//   Signature-Input  : the covered components + parameters (SF Dictionary member)
//   Signature        : the Ed25519 signature (SF Byte Sequence)
//
// The three-header set (Signature / Signature-Input / Signature-Agent) is
// confirmed against Cloudflare's docs and blog (S1, S2). The Signature-Agent
// value constraints are confirmed by S1: it must be an https:// URI, quoted as an
// SF String, and listed among the covered components in Signature-Input. We
// enforce all three here.
//
// Spec basis: RFC 9421 §3.1 (signing), §4 (headers).

import { sign as edSign } from 'node:crypto';
import { buildSignatureBase } from './signature-base.mjs';
import { serializeByteSequence } from './sfv.mjs';

// CONFORMANCE-TAG: VERIFIED | framework=web-bot-auth | Cloudflare reads the Signature / Signature-Input / Signature-Agent header set, and Signature-Agent must be an https:// URI quoted as an SF String and included among the signed components — all enforced here | ref=S1,S2
// The exact FULL set of covered components Cloudflare requires (beyond mandating
// signature-agent's inclusion) and the tag value convention are still not
// confirmed against primary docs; the defaults below remain a choice.
// CONFORMANCE-TAG: PENDING-B | framework=web-bot-auth | exact full required covered-component set (beyond the mandated signature-agent) and the tag="web-bot-auth" value convention are not confirmed against primary docs | ref=docs/sources.md
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
  // Cloudflare (S1) rejects a Signature-Agent that is not an https:// URI — fail
  // loudly here rather than emitting a signature that would be rejected.
  const headers = { ...(request.headers || {}) };
  if (signatureAgent) {
    if (!/^https:\/\//i.test(signatureAgent)) {
      throw new Error(`signRequest: signatureAgent must be an https:// URI (got "${signatureAgent}") — Cloudflare rejects non-https Signature-Agent (S1)`);
    }
    headers['signature-agent'] = `"${signatureAgent}"`;
  }

  // When Signature-Agent is present it MUST be listed among the covered
  // components (S1). The default set below satisfies that; an explicit
  // components override that omits it would produce a signature Cloudflare
  // rejects, so guard against it.
  const components =
    options.components ??
    (signatureAgent ? ['@authority', 'signature-agent'] : ['@authority', '@method', '@path']);
  if (signatureAgent && !components.some((c) => c.toLowerCase() === 'signature-agent')) {
    throw new Error('signRequest: signature-agent must be included in the covered components when a Signature-Agent is set (S1)');
  }

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
