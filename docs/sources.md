# Primary sources

Every source used to justify a `VERIFIED` record must appear here with its URL
and the date it was consulted. Because page content changes over time, any text
quoted in a record must be taken from the page body at retrieval time.

## Retrieval status in this environment (2026-08-08)

The environment used to build this repository **cannot reach Cloudflare domains**
(the egress proxy blocks the open web while allowing package registries). Every
primary source below was requested on 2026-08-08 and returned `EGRESS_BLOCKED`.
Raw log: [`evidence/_meta/2026-08-08/source-retrieval-attempts.txt`](../evidence/_meta/2026-08-08/source-retrieval-attempts.txt).

**Therefore no source below is in `RETRIEVED` state, and nothing Cloudflare-specific
is labeled `VERIFIED` in this pass.** Re-running retrieval from an environment
with open egress is a Category B task (see each framework's record file).

| # | Framework | URL | Consulted | Status |
|---|---|---|---|---|
| 1 | Web Bot Auth (docs) | https://developers.cloudflare.com/bots/reference/bot-verification/web-bot-auth | 2026-08-08 | UNREACHABLE (egress blocked) |
| 2 | Monetization Gateway (blog) | https://blog.cloudflare.com/monetization-gateway/ | 2026-08-08 | UNREACHABLE (egress blocked) |
| 3 | x402 / Cloudflare (blog) | https://blog.cloudflare.com/x402/ | 2026-08-08 | UNREACHABLE (egress blocked) |
| 4 | pay per crawl (blog) | https://blog.cloudflare.com/introducing-pay-per-crawl/ | 2026-08-08 | UNREACHABLE (egress blocked, not individually re-tested; same domain as #2/#3) |
| 5 | signed agents (blog) | https://blog.cloudflare.com/signed-agents/ | 2026-08-08 | UNREACHABLE (egress blocked, same domain as #2/#3) |
| 6 | signed agents (docs) | https://developers.cloudflare.com/bots/concepts/bot/signed-agents | 2026-08-08 | UNREACHABLE (egress blocked, same domain as #1) |
| 7 | verified bots (docs) | https://developers.cloudflare.com/bots/concepts/bot/verified-bots/ | 2026-08-08 | UNREACHABLE (egress blocked, same domain as #1) |
| 8 | Cloudflare Wallets / cloudflare.pay (press) | https://www.cloudflare.com/press/press-releases/2026/cloudflare-gives-ai-agents-an-identity-and-a-wallet/ | 2026-08-08 | UNREACHABLE (egress blocked) |

Rows #1–#3 and #8 were requested directly and each returned `EGRESS_BLOCKED`.
Rows #4–#7 share a blocked domain with a directly-tested URL, so they are
recorded as unreachable by inference rather than re-tested; confirming them
individually is part of the same Category B retrieval task.

## Open standards used as the implementation basis

The code implements against these stable, widely-published standards. They are
named in code comments as the spec basis. They were **not** re-fetched here
(the same egress policy applies), so they are cited from established engineering
knowledge, not from a fresh retrieval; Cloudflare-specific deviations from them
are labeled `PENDING-B`/`UNVERIFIED`, never `VERIFIED`.

| Standard | Used by | Note |
|---|---|---|
| RFC 9421 — HTTP Message Signatures | M1 Web Bot Auth | Signature-Input / Signature construction, `@`-derived components. |
| RFC 8032 — EdDSA (Ed25519) | M1 | Key generation and signing algorithm. |
| RFC 7517 / RFC 8037 — JWK / OKP keys | M1 | Public key directory (JWKS) shape for Ed25519 keys. |
| RFC 9309 — Robots Exclusion Protocol | M4 | robots.txt grammar the parser follows. |
| RFC 7231 §6.5.2 — HTTP 402 Payment Required | M2 | Status code the checker asserts. |

## How to promote a source to VERIFIED (Category B)

1. From an environment with open egress, fetch the URL.
2. Save the raw body under `evidence/<framework>/<YYYY-MM-DD>/`.
3. Record the consulted date and change Status to `RETRIEVED` above.
4. Update the relevant `docs/conformance/<framework>.md` "対象仕様" section with
   the exact quoted text, and flip the corresponding `PENDING-B`/`UNVERIFIED`
   markers to `VERIFIED` where the text supports the claim.
