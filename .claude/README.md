# `.claude/` — shared template placeholder

The M0 brief calls for "the existing all-repos common `.claude/` template" to be
placed here. That canonical org template was **not available** in the build
environment, so `settings.json` here is a minimal, honest stand-in (a SessionStart
hook that checks Node and points at `npm test` / `npm run matrix:check`).

Replace this directory's contents with the canonical org template when working in
an environment that has it. This placeholder is intentionally small so it will not
mask the real template's settings.
