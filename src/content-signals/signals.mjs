// Content Signals extraction from robots.txt.
//
// "Content Signals" (as used by Cloudflare's AI Crawl Control / Content Signals
// Policy) are expressed as a `Content-Signal:` directive carrying comma-separated
// `token=value` pairs. This module extracts those pairs STRUCTURALLY. It does
// NOT assert what any token means or what a compliant crawler must do with it —
// the exact Cloudflare token set and semantics were not retrievable from this
// environment (egress blocked), so we treat token INTERPRETATION as self-defined
// and provisional rather than confirmed spec.
//
// What is standard here: the robots.txt line grammar (RFC 9309), used to locate
// the directive. What is self-defined: which token names we choose to RECOGNIZE
// and how we normalize values. The recognized-token list below is a self-defined
// convenience classification, not a claim about Cloudflare's vocabulary.
//
// CONFORMANCE-TAG: UNVERIFIED | framework=content-signals | Content-Signal token vocabulary and value normalization here are self-defined; the exact Cloudflare Content Signals token set and their meaning were not retrieved (egress blocked), so no crawler behavior is asserted from them | ref=data/README.md

import { parseRobotsTxt } from './robots.mjs';

// Self-defined recognized-token set (UNVERIFIED). Presence here only tags a token
// as "known to our tooling"; it does NOT encode any required crawler behavior and
// is not a transcription of Cloudflare's published tokens.
export const RECOGNIZED_TOKENS = Object.freeze(['search', 'ai-input', 'ai-train']);

// Extract Content-Signal directives. Returns both a flat list and a per-group view.
// Each entry: { name, value, raw, recognized }.
export function extractContentSignals(text) {
  const parsed = parseRobotsTxt(text);
  const global = [];
  for (const line of parsed.contentSignalLines) global.push(...parsePairs(line));

  const perGroup = parsed.groups.map((g) => ({
    userAgents: g.userAgents,
    signals: g.contentSignals.flatMap(parsePairs),
  }));

  return { global, perGroup };
}

// Parse one Content-Signal value ("search=yes, ai-train=no") into pairs. A token
// with no `=value` is surfaced with value=null rather than silently dropped —
// unexpected shapes are made visible, not defaulted away.
function parsePairs(value) {
  const out = [];
  for (const partRaw of value.split(',')) {
    const part = partRaw.trim();
    if (part === '') continue;
    const eq = part.indexOf('=');
    if (eq === -1) {
      out.push({ name: part.toLowerCase(), value: null, raw: part, recognized: RECOGNIZED_TOKENS.includes(part.toLowerCase()) });
      continue;
    }
    const name = part.slice(0, eq).trim().toLowerCase();
    const val = part.slice(eq + 1).trim().toLowerCase();
    out.push({ name, value: val, raw: part, recognized: RECOGNIZED_TOKENS.includes(name) });
  }
  return out;
}
