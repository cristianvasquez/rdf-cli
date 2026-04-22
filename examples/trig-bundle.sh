#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Bundle multiple files into pretty TriG, assigning file graphs explicitly.

rdf glob "$ROOT/examples/data/*.rdf" "$ROOT/examples/data/*.ttl" "$ROOT/examples/data/*.trig" "$ROOT/examples/data/*.nq" \
  | rdf from-paths --graph-from path \
  | rdf pretty --format trig
