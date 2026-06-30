#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Parse RDF files directly into a graphless dataset stream.

rdf read "$ROOT/examples/data/*.rdf" "$ROOT/examples/data/*.ttl"
