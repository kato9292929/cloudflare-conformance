# cloudflare-conformance

**This repository is an implementation record, not a compliance claim.**

It records how far x402 Inc. has implemented against Cloudflare's five
agent-economy frameworks, keeping *working code* and *evidence* side by side. The
point is not to be able to write "we are compliant" — it is that a later reader
can tell **exactly what is implemented and where the unverified line is.** A
record that writes the unverified as unverified is a valid deliverable.

## Two important caveats up front

1. **Category B is unconsumed.** Work is split into Category A (completable in
   this environment) and Category B (needs API keys, network reachability, or
   acceptance of an application). All Category B items are unconsumed and are
   marked `PENDING-B`. See each `docs/conformance/<framework>.md`.

2. **Primary sources were retrieved out-of-environment.** This build
   environment's egress policy blocks Cloudflare domains, so every in-environment
   request returned `EGRESS_BLOCKED`
   ([log](evidence/_meta/2026-08-08/source-retrieval-attempts.txt)); that
   unreachability is kept on record. The primary sources were then obtained
   outside the environment and recorded as **S1–S9** in
   [`docs/sources.md`](docs/sources.md). Claims a retrieved source actually
   confirms are now labeled **`VERIFIED` with a source ID**; everything not
   retrieved (signed-agents docs/blog, the architecture-draft body, Content
   Signals token vocabulary, the Gateway rule schema, the Wallets API/schema,
   the deferred-payment proposal body) stays `PENDING-B`/`UNVERIFIED`. Live
   reachability, key issuance, and application acceptance remain Category B
   regardless.

## The five frameworks

| Framework | Milestone | This repo builds |
|---|---|---|
| Web Bot Auth | M1 | Ed25519 signing client (RFC 9421 headers) + own verifier + JWKS directory |
| Monetization Gateway | M2 | 402-response shape checker + declarative billing-rules file + adapter boundary |
| Cloudflare Wallets / cloudflare.pay | M3 | Allowlist generator feeding a Virtual-Wallet-style approved-merchant list |
| Content Signals / AI Crawl Control | M4 | robots.txt + Content Signals parser (fetch stubbed as `PENDING-B`) |
| deferred payment scheme | M5 | Agent spending ledger (immediate settlement; extensibility checked, not built) |

One-screen status: [`docs/conformance/matrix.md`](docs/conformance/matrix.md) (generated).

## Layout

```
docs/
  sources.md                 primary-source URLs + retrieval status
  conformance/
    LABELS.md                VERIFIED / PENDING-B / UNVERIFIED + marker syntax
    frameworks.json          canonical framework registry (anchors the matrix)
    <framework>.md           per-framework record (fixed headings)
    matrix.md                GENERATED — do not hand-edit
scripts/                     matrix generator + per-milestone CLIs
src/                         implementation modules
test/                        node:test suites (zero external deps)
fixtures/                    sample inputs for checkers (no live fetch here)
evidence/<framework>/<date>/ raw tool output kept as proof
data/                        local sample data (real inputs passed by path)
```

## Commands

Requires Node ≥ 20. No dependencies to install.

```bash
npm test               # run all test suites
npm run matrix         # regenerate docs/conformance/matrix.md
npm run matrix:check   # fail if the matrix is stale (CI)
```

Per-milestone CLIs (`wba:*`, `x402:check`, `allowlist`, `signals:parse`,
`ledger`) are documented in their milestone's record file.

## Labels

- `VERIFIED` — primary source retrieved & quoted, URL in `docs/sources.md`.
- `PENDING-B` — depends on Category B (keys/network/application; here also
  primary-source retrieval). Unconsumed does not block Category A.
- `UNVERIFIED` — no confirmable primary source, so defined provisionally by
  x402 Inc.; the lack of grounding is stated.

Labels live in code and docs as `CONFORMANCE-TAG:` markers and are collected into
the matrix automatically. Details: [`docs/conformance/LABELS.md`](docs/conformance/LABELS.md).
