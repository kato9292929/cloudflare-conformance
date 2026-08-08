# data/

Local sample data used by the tooling in this repo.

**Real production inputs are not copied here.** Tools that consume data from other
repositories (e.g. M3's allowlist generator, which reads the `endpoint` repo's
`data/endpoints.json` and `data/stats/`) take the input path as a **command-line
argument**. Only small, clearly-synthetic samples live under this directory, and
those are labeled as fixtures, not real data.
