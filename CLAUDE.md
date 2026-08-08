# CLAUDE.md — repo conventions

`cloudflare-conformance` is an **implementation record, not a compliance claim**.
The goal is that a later reader can tell exactly what is implemented and what is
unverified.

## Non-negotiables (from the work brief)

- **Never guess unpublished/unconfirmed spec.** If you must fill a gap, mark it
  `UNVERIFIED` and state that it is self-defined, on both the code and doc side.
- **No unlabeled self-definitions.** Category-B dependencies are recorded with the
  machine-readable `CONFORMANCE-TAG:` marker, not just a code comment.
- **Fail loudly.** Do not swallow unexpected responses/inputs with fallbacks or
  defaults. Throw at the point of surprise.
- **Do not state undocumented behavior as confirmed spec** in code text, README,
  or record files.

## Labels & records

- Labels: `VERIFIED` / `PENDING-B` / `UNVERIFIED` — see `docs/conformance/LABELS.md`.
- Records: one file per framework under `docs/conformance/<slug>.md` with the
  fixed headings (対象仕様 / 実装したもの / この環境で確認したこと / 未消化（区分B） /
  自社定義（UNVERIFIED）).
- Matrix: `docs/conformance/matrix.md` is GENERATED. Run `npm run matrix`. Never
  hand-edit it. `npm run matrix:check` asserts freshness.
- Evidence: raw (not summarized) tool output under `evidence/<slug>/<YYYY-MM-DD>/`.

## Commands

| Command | Purpose |
|---|---|
| `npm test` | Run all `node:test` suites (zero external deps). |
| `npm run matrix` | Regenerate `docs/conformance/matrix.md`. |
| `npm run matrix:check` | Fail if the matrix is stale (CI). |

## Category A vs B

- **A (this environment):** local implementation + tests + records. Complete here.
- **B (needs keys/network):** live reachability, key issuance, application
  acceptance, and — in this egress-blocked environment — primary-source retrieval.
  Do not let unconsumed B block A; record it as `PENDING-B` and move on.
