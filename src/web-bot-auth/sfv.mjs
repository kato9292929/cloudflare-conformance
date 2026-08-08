// Minimal RFC 8941 Structured Fields helpers — only the subset RFC 9421 needs
// for HTTP Message Signatures: an Inner List of quoted-string items plus
// list-level parameters (created/expires as Integers, keyid/alg/tag/nonce as
// Strings, and Boolean flags). This is intentionally NOT a full RFC 8941
// implementation; it serializes and parses exactly the shapes we emit, and it
// FAILS LOUDLY on anything it does not understand rather than guessing.
//
// Spec basis: RFC 8941 (Structured Field Values), RFC 9421 §2.
// CONFORMANCE-TAG: PENDING-B | framework=web-bot-auth | RFC 9421 signature base built on an RFC 8941 subset serializer; full-spec conformance and Cloudflare's exact acceptance not confirmed against primary docs (egress blocked) | ref=docs/sources.md

function serializeParamValue(v) {
  if (typeof v === 'boolean') return v ? '' : '=?0'; // ?1 is implied by bare key
  if (typeof v === 'number') {
    if (!Number.isInteger(v)) throw new Error(`sfv: only integer params supported, got ${v}`);
    return `=${v}`;
  }
  if (typeof v === 'string') return `="${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  throw new Error(`sfv: unsupported param value type ${typeof v}`);
}

// params: array of [key, value] pairs (order preserved). Boolean true => bare key.
export function serializeParams(params) {
  let out = '';
  for (const [k, v] of params) {
    if (v === true) out += `;${k}`;
    else out += `;${k}${serializeParamValue(v)}`;
  }
  return out;
}

// items: array of strings (component identifiers WITHOUT surrounding quotes).
// params: array of [key, value] pairs.
export function serializeInnerList(items, params) {
  const inner = items.map((s) => `"${s}"`).join(' ');
  return `(${inner})${serializeParams(params)}`;
}

// Parse `(...)` inner list + params back into { items, params } where params is a
// Map preserving insertion order. Throws on malformed input.
export function parseInnerList(str) {
  const s = str.trim();
  if (s[0] !== '(') throw new Error(`sfv: inner list must start with "(", got: ${s.slice(0, 20)}`);
  const close = s.indexOf(')');
  if (close === -1) throw new Error('sfv: inner list missing ")"');
  const inside = s.slice(1, close).trim();
  const items = [];
  if (inside.length) {
    // items are space-separated quoted strings (we never emit per-item params)
    const re = /"((?:[^"\\]|\\.)*)"/g;
    let m;
    let consumed = 0;
    let cursor = 0;
    while ((m = re.exec(inside)) !== null) {
      // ensure only whitespace between items
      const gap = inside.slice(cursor, m.index).trim();
      if (gap.length) throw new Error(`sfv: unexpected token in inner list: "${gap}"`);
      items.push(m[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\'));
      cursor = re.lastIndex;
      consumed++;
    }
    const tail = inside.slice(cursor).trim();
    if (tail.length) throw new Error(`sfv: unparsed inner list content: "${tail}"`);
    if (consumed === 0) throw new Error(`sfv: inner list items not quoted strings: "${inside}"`);
  }
  const params = parseParams(s.slice(close + 1));
  return { items, params };
}

// Parse a leading `;k=v;k2=v2...` parameter string into an ordered Map.
export function parseParams(str) {
  const params = new Map();
  let s = str.trim();
  while (s.length) {
    if (s[0] !== ';') throw new Error(`sfv: expected ";" before param, got: ${s.slice(0, 20)}`);
    s = s.slice(1).trim();
    const keyMatch = s.match(/^([a-z*][a-z0-9._*-]*)/i);
    if (!keyMatch) throw new Error(`sfv: invalid param key at: ${s.slice(0, 20)}`);
    const key = keyMatch[1];
    s = s.slice(key.length);
    if (s[0] === '=') {
      s = s.slice(1);
      if (s[0] === '"') {
        const strMatch = s.match(/^"((?:[^"\\]|\\.)*)"/);
        if (!strMatch) throw new Error(`sfv: unterminated string param "${key}"`);
        params.set(key, strMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\'));
        s = s.slice(strMatch[0].length);
      } else if (s.startsWith('?')) {
        params.set(key, s[1] === '1');
        s = s.slice(2);
      } else {
        const numMatch = s.match(/^-?\d+/);
        if (!numMatch) throw new Error(`sfv: unsupported param value for "${key}" at: ${s.slice(0, 20)}`);
        params.set(key, parseInt(numMatch[0], 10));
        s = s.slice(numMatch[0].length);
      }
    } else {
      params.set(key, true); // bare key => boolean true
    }
    s = s.trim();
  }
  return params;
}

// Structured Field Byte Sequence: `:<base64>:`
export function serializeByteSequence(b64) {
  return `:${b64}:`;
}
export function parseByteSequence(str) {
  const s = str.trim();
  if (s[0] !== ':' || s[s.length - 1] !== ':') {
    throw new Error(`sfv: byte sequence must be wrapped in colons, got: ${s.slice(0, 20)}`);
  }
  return s.slice(1, -1);
}

// Parse a Dictionary with a single member `label=<value>` into { label, value }.
// Used for Signature-Input and Signature (we emit exactly one signature).
export function parseSingleMemberDict(str) {
  const s = str.trim();
  const eq = s.indexOf('=');
  if (eq === -1) throw new Error(`sfv: dictionary member missing "=": ${s.slice(0, 20)}`);
  const label = s.slice(0, eq).trim();
  if (!/^[a-z*][a-z0-9._*-]*$/i.test(label)) throw new Error(`sfv: invalid dictionary key "${label}"`);
  return { label, value: s.slice(eq + 1).trim() };
}
