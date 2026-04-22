#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Expand paths, then parse RDF files into a graphless dataset stream.

rdf glob "$ROOT/examples/data/*.rdf" "$ROOT/examples/data/*.ttl" \
  | rdf from-paths
