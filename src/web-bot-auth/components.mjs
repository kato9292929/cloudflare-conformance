// Covered-component resolution for the RFC 9421 signature base.
//
// Web Bot Auth signs a REQUEST. This module resolves each covered component
// identifier to the exact value that goes into the signature base, and enforces
// the Cloudflare constraint stated in the task brief:
//
//   Including @query-params or @status makes Cloudflare's verification fail.
//
// @status is a RESPONSE component (meaningless on a request) and @query-param is
// query-dependent; both are rejected here, and a test asserts the rejection.
// The rejection is treated as PENDING-B because the source of the constraint
// (Cloudflare docs) could not be retrieved to quote verbatim.
//
// Spec basis: RFC 9421 §2.2 (derived components), §2.1 (HTTP fields).

// CONFORMANCE-TAG: PENDING-B | framework=web-bot-auth | Component selector rejects @query-param(s) and @status per the documented Cloudflare constraint; exact doc wording not retrieved (egress blocked), so not marked VERIFIED | ref=https://developers.cloudflare.com/bots/reference/bot-verification/web-bot-auth
export const DISALLOWED_COMPONENTS = new Set(['@query-param', '@query-params', '@status']);

const DEFAULT_PORTS = { 'http:': '80', 'https:': '443' };

export function assertAllowedComponents(components) {
  for (const c of components) {
    const base = c.toLowerCase().split(';')[0].trim();
    if (DISALLOWED_COMPONENTS.has(base)) {
      throw new Error(
        `web-bot-auth: component "${c}" is not allowed — Cloudflare verification fails when ` +
          `@query-params or @status are covered (see docs/conformance/web-bot-auth.md).`
      );
    }
  }
}

// request: { method, url, headers } where headers is a plain object (lowercased
// keys recommended). Returns the component value string for the signature base.
export function resolveComponent(name, request) {
  const lower = name.toLowerCase();
  if (DISALLOWED_COMPONENTS.has(lower)) {
    throw new Error(`web-bot-auth: refusing to resolve disallowed component "${name}"`);
  }

  if (lower.startsWith('@')) return resolveDerived(lower, request);
  return resolveHeader(lower, request);
}

function resolveDerived(name, request) {
  const u = new URL(request.url);
  switch (name) {
    case '@method':
      if (!request.method) throw new Error('web-bot-auth: @method requires request.method');
      return request.method.toUpperCase();
    case '@target-uri':
      return u.href;
    case '@authority': {
      let host = u.hostname.toLowerCase();
      const port = u.port;
      if (port && DEFAULT_PORTS[u.protocol] !== port) host += `:${port}`;
      return host;
    }
    case '@scheme':
      return u.protocol.replace(/:$/, '').toLowerCase();
    case '@request-target':
      return `${u.pathname}${u.search}`;
    case '@path':
      return u.pathname || '/';
    case '@query':
      // RFC 9421: value is "?" followed by the query, or just "?" if empty.
      return u.search ? u.search : '?';
    default:
      throw new Error(`web-bot-auth: unsupported derived component "${name}"`);
  }
}

function resolveHeader(name, request) {
  const headers = request.headers || {};
  // case-insensitive lookup
  let value;
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === name) {
      value = v;
      break;
    }
  }
  if (value === undefined) {
    // Fail loudly: we do not sign over a header that is not present.
    throw new Error(`web-bot-auth: covered header "${name}" is missing from the request`);
  }
  // RFC 9421 §2.1: combine list values with ", " and strip OWS.
  const combined = Array.isArray(value) ? value.join(', ') : String(value);
  return combined.trim();
}
