#!/usr/bin/env bash
# Bundle files of four formats into one TriG document.
# --graph-from path puts the statements of each graphless file in a graph named after its path.
# Files that already have graphs (TriG, N-Quads) keep their graphs.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

rdf read 'data/*.rdf' 'data/*.ttl' 'data/*.trig' 'data/*.nq' --graph-from path \
  | rdf pretty --format trig
