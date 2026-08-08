# Record labels

Every self-defined spec, schema, or value in this repo carries the **same label
on both the code side and the document side**. Labels are written as a single
machine-readable marker so `scripts/gen-matrix.mjs` can collect them without a
hand-maintained list.

## The three labels

| Label | Meaning |
|---|---|
| `VERIFIED` | A primary source (Cloudflare official docs / blog / press release) contains the statement, and its URL is recorded in `docs/sources.md`. |
| `PENDING-B` | The item depends on **Category B** work — anything needing API keys, network reachability, or acceptance of an application. Unconsumed here does not block Category A. |
| `UNVERIFIED` | No primary source exists, or none could be found/confirmed, so x402 Inc. defined the item provisionally. The lack of grounding is stated explicitly. |

## Environment note that shapes labeling (read this)

This repository was built in an execution environment whose network egress
policy **blocks Cloudflare domains** (`developers.cloudflare.com`,
`blog.cloudflare.com`, `www.cloudflare.com`). Package registries are reachable;
the open web is not. Because that block is real and worth recording, the
per-URL "unreachable from this environment" log is preserved at the end of
`docs/sources.md`.

The primary sources were later **retrieved out-of-environment** and recorded as
S1–S9 in `docs/sources.md`. This changed the labeling as follows:

- **Confirmed Cloudflare-specific claims are now `VERIFIED`, with a source ID.**
  A `VERIFIED` marker cites the source (e.g. `ref=S1`) that contains the
  statement. Promotion is limited to what a retrieved source actually says —
  see each framework record's "VERIFIED" section.
- **What was NOT retrieved stays `PENDING-B` / `UNVERIFIED`.** signed-agents
  docs/blog, the S5 architecture-draft body, the Content Signals token
  vocabulary, the Monetization Gateway rule schema, the Cloudflare Wallets
  API/schema, and the deferred-payment proposal body were not obtained; claims
  resting on them are not promoted.
- **Live reachability, key issuance, and application acceptance remain
  Category B** (`PENDING-B`) regardless of source retrieval — retrieving a doc
  does not exercise a live service.
- **Open standards** the code implements against (RFC 9421, RFC 8032, RFC 7517,
  RFC 9309, HTTP 402) are named in comments as the spec basis; Cloudflare-specific
  deviations are `PENDING-B` or `UNVERIFIED` unless a retrieved source confirms
  them.
- **Schemas we invented** (allowlist output, billing-rules file, ledger records)
  stay `UNVERIFIED` at the field-name/type level, even where a source confirms
  that the underlying *control* exists (e.g. S9 confirms the three Wallet
  guardrails exist, but not their encoding). Their field names deliberately
  avoid mimicking Cloudflare terminology.

This is the intended posture of the deliverable: *a record that writes the
unverified as unverified — and cites a source for what it does verify — is
itself a valid deliverable.*

## Marker syntax

```
CONFORMANCE-TAG: <LABEL> | framework=<slug> | <summary> | ref=<url-or-note>
```

- `<LABEL>` — one of `VERIFIED`, `PENDING-B`, `UNVERIFIED`.
- `framework=<slug>` — **required**; must be a slug in `frameworks.json`.
- `<summary>` — **required** free text.
- `ref=<...>` — optional primary-source URL or short note. `id=<...>` also allowed.

Fields are `|`-separated. The marker may appear in any file type; trailing
comment terminators (`*/`, `-->`) are stripped. A malformed marker (unknown
label, unknown framework, empty summary) makes `gen-matrix.mjs` fail loudly.

Framework slugs: `monetization-gateway`, `cloudflare-wallets`, `web-bot-auth`,
`content-signals`, `deferred-payment`.
