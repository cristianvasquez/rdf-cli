#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Minimal example: parse RDF files directly into a graphless dataset stream.

rdf read "$ROOT/examples/data/*.rdf" "$ROOT/examples/data/*.ttl"
