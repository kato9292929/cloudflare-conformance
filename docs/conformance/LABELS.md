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
`blog.cloudflare.com`, `www.cloudflare.com` — see `docs/sources.md` for the
retrieval attempt log). Package registries are reachable; the open web is not.

Consequence, applied honestly:

- **We do not mark Cloudflare-specific claims `VERIFIED`.** The `VERIFIED` label
  requires that we retrieved the primary source and recorded the exact text.
  We could not retrieve any primary source from here, so no Cloudflare-specific
  statement earns `VERIFIED` in this pass.
- **Primary-source confirmation is itself treated as Category B.** Items whose
  correctness rests on a Cloudflare doc we could not read are marked `PENDING-B`
  with a note that the blocker is egress, not merely a live service.
- **Open standards** the code implements against (RFC 9421 HTTP Message
  Signatures, RFC 8032 Ed25519, RFC 7517 JWK, RFC 9309 robots.txt, the HTTP 402
  status) are named in comments as the spec basis. These are stable, widely
  implemented standards; where a detail is Cloudflare-specific rather than from
  the base RFC, it is labeled `PENDING-B` or `UNVERIFIED`, not `VERIFIED`.
- **Schemas we invented** (allowlist output, billing-rules file, ledger records)
  are `UNVERIFIED`, and their field names deliberately avoid mimicking Cloudflare
  terminology so they cannot be mistaken for confirmed spec.

This is the intended posture of the deliverable: *a record that writes the
unverified as unverified is itself a valid deliverable.*

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
