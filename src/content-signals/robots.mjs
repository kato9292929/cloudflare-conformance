// robots.txt parser and matcher.
//
// Spec basis: RFC 9309 (Robots Exclusion Protocol) — a stable, published
// standard. This module implements the STANDARD only: user-agent groups,
// allow/disallow rules with `*`/`$`, sitemaps, and RFC 9309 longest-match
// precedence (allow wins on an equal-length tie). Cloudflare-specific
// "Content Signals" tokens are NOT interpreted here — that is a separate,
// self-defined concern in signals.mjs.
//
// This works on robots.txt TEXT that is handed to it. Fetching the text from a
// live domain is a separate, egress-dependent step (source.mjs, Category B).

// Parse robots.txt text into groups, sitemaps, and any raw Content-Signal lines
// (extracted verbatim; interpretation is left to signals.mjs).
export function parseRobotsTxt(text) {
  if (typeof text !== 'string') throw new Error('parseRobotsTxt: text must be a string');
  const groups = [];
  const sitemaps = [];
  const contentSignalLines = [];

  let current = null; // group being built
  let sawRuleInGroup = false; // a following user-agent after a rule starts a NEW group

  for (const rawLine of text.split(/\r?\n/)) {
    const line = stripComment(rawLine).trim();
    if (line === '') continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue; // RFC 9309: lines without a field separator are ignored
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    switch (field) {
      case 'user-agent': {
        if (current && sawRuleInGroup) {
          groups.push(current);
          current = null;
        }
        if (!current) {
          current = { userAgents: [], rules: [], contentSignals: [] };
          sawRuleInGroup = false;
        }
        current.userAgents.push(value.toLowerCase());
        break;
      }
      case 'allow':
      case 'disallow': {
        if (!current) {
          // A rule with no preceding user-agent has no group to attach to; ignore.
          break;
        }
        current.rules.push({ type: field, path: value });
        sawRuleInGroup = true;
        break;
      }
      case 'sitemap':
        sitemaps.push(value);
        break;
      case 'content-signal': {
        // Extracted verbatim; NOT interpreted here (see signals.mjs).
        contentSignalLines.push(value);
        if (current) current.contentSignals.push(value);
        break;
      }
      default:
        // Unknown field — ignored per RFC 9309.
        break;
    }
  }
  if (current) groups.push(current);
  return { groups, sitemaps, contentSignalLines };
}

// Select the group applying to a user-agent per RFC 9309: the most specific
// matching product token wins; `*` is the fallback. Returns null if neither a
// specific group nor a `*` group exists.
export function selectGroup(parsed, userAgent) {
  const ua = String(userAgent).toLowerCase();
  let specific = null;
  let wildcard = null;
  for (const g of parsed.groups) {
    for (const pattern of g.userAgents) {
      if (pattern === '*') {
        wildcard = wildcard ?? g;
      } else if (ua.includes(pattern)) {
        // Prefer the longest matching product token (most specific).
        if (!specific || pattern.length > specific._matchLen) {
          specific = g;
          specific._matchLen = pattern.length;
        }
      }
    }
  }
  return specific ?? wildcard;
}

// Decide whether `path` is allowed for `userAgent` under RFC 9309 rules.
// Returns { allowed, rule } where rule is the deciding rule (or null when no
// rule matches — RFC 9309 default is allow).
export function isAllowed(parsed, userAgent, path) {
  const group = selectGroup(parsed, userAgent);
  if (!group) return { allowed: true, rule: null }; // no applicable group => allowed

  let best = null; // { type, path, length, order }
  group.rules.forEach((r, order) => {
    if (r.path === '' && r.type === 'disallow') return; // "Disallow:" empty = allow all, no constraint
    if (!matchesPattern(r.path, path)) return;
    const length = specificity(r.path);
    if (
      !best ||
      length > best.length ||
      // Equal length: Allow wins over Disallow (RFC 9309).
      (length === best.length && r.type === 'allow' && best.type === 'disallow')
    ) {
      best = { type: r.type, path: r.path, length, order };
    }
  });

  if (!best) return { allowed: true, rule: null };
  return { allowed: best.type === 'allow', rule: { type: best.type, path: best.path } };
}

function stripComment(line) {
  const i = line.indexOf('#');
  return i === -1 ? line : line.slice(0, i);
}

// Path length for specificity, counting the literal characters of the pattern
// (wildcards excluded from the count, `$` excluded). RFC 9309 uses the length of
// the matching path portion; the pattern length is the standard approximation.
function specificity(pattern) {
  return pattern.replace(/\*/g, '').replace(/\$$/, '').length;
}

// Match an RFC 9309 path pattern (supports `*` = any sequence, `$` = end anchor)
// against a URL path. Anchored at the start of the path.
export function matchesPattern(pattern, path) {
  if (pattern === '') return true; // empty pattern matches everything
  let anchoredEnd = false;
  let pat = pattern;
  if (pat.endsWith('$')) {
    anchoredEnd = true;
    pat = pat.slice(0, -1);
  }
  const segments = pat.split('*');
  let pos = 0;
  for (let s = 0; s < segments.length; s++) {
    const seg = segments[s];
    if (seg === '') {
      if (s === 0) continue; // leading `*` or empty first segment
      continue;
    }
    if (s === 0) {
      // First literal segment must match at the start.
      if (!path.startsWith(seg)) return false;
      pos = seg.length;
    } else {
      const found = path.indexOf(seg, pos);
      if (found === -1) return false;
      pos = found + seg.length;
    }
  }
  if (anchoredEnd) {
    // With a trailing `$`, the last segment must reach the end of the path.
    const last = segments[segments.length - 1];
    if (last !== '') return path.endsWith(last) && pos === path.length;
    return pos === path.length; // pattern ended with `*$`
  }
  return true;
}
