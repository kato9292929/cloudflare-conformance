// Robots source boundary — where the robots.txt TEXT comes from.
//
// The parser (robots.mjs) and signal extractor (signals.mjs) operate on text.
// Obtaining that text is a separate concern with two implementations of the same
// boundary, mirroring the M2/M3 adapters:
//   - localFileSource:  reads robots.txt from a local file / fixture. Implemented.
//   - networkSource:    would fetch https://<domain>/robots.txt live. In THIS
//                       environment egress to the open web is blocked, so it is
//                       intentionally unimplemented — it throws rather than
//                       returning an empty/guessed body, and is labeled PENDING-B.
//
// Aggregating over real (e.g. Japanese) domains is the same Category B work: it
// needs the network source, which needs egress this environment does not have.

import { readFileSync } from 'node:fs';

export function localFileSource() {
  return {
    name: 'local-file',
    read(pathOrUrl) {
      return readFileSync(pathOrUrl, 'utf8');
    },
  };
}

// Live fetch — deliberately unimplemented in this egress-blocked environment.
// Do not substitute an empty body or a guessed default; fail loudly.
// CONFORMANCE-TAG: PENDING-B | framework=content-signals | live robots.txt retrieval over the network (and aggregation across real domains) is intentionally unimplemented — this environment blocks open-web egress; the parser/extractor run on provided text and the fetch is the Category B seam | ref=docs/sources.md
export function networkSource() {
  return {
    name: 'network',
    read() {
      throw new Error(
        'networkSource: live robots.txt fetch is unavailable — this environment blocks open-web egress. ' +
          'Run from a network-enabled environment (区分B). See docs/conformance/content-signals.md.'
      );
    },
  };
}
