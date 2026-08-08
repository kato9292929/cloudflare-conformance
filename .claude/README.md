# `.claude/` — shared template placeholder

The M0 brief calls for "the existing all-repos common `.claude/` template" to be
placed here. That canonical org template was **not available** in the build
environment, so `settings.json` here is a minimal, honest stand-in (a SessionStart
hook that checks Node and points at `npm test` / `npm run matrix:check`).

## Why this is still a placeholder (verified)

Before leaving this as a stand-in, every repository reachable from the owning
account (`kato9292929`, ~85 repos) was checked for a populated `.claude/`
directory via blobless sparse clones. Result:

- **No repo contains a populated `.claude/` template.** The only repo with a
  `.claude/` path at all is `agentic.market`, and it holds no tracked files.
- There is therefore no discoverable "all-repos common template" to copy in.

Per the repo non-negotiables (`CLAUDE.md`: *never guess unconfirmed inputs; fail
loudly*), a template is **not fabricated** here and is **not** presented as the
canonical org one. This directory stays a small, self-labeled placeholder.

Replace this directory's contents with the canonical org template when working in
an environment that actually has it. This placeholder is intentionally small so it
will not mask the real template's settings.
