#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# SPARQL CONSTRUCT stays in dataset space, so pretty Turtle works directly.

QUERY='PREFIX foaf: <http://xmlns.com/foaf/0.1/>
CONSTRUCT { ?s foaf:name ?name }
WHERE { ?s foaf:name ?name }'

rdf read "$ROOT/examples/data/*.rdf" "$ROOT/examples/data/*.ttl" \
  | rdf construct "$QUERY" \
  | rdf pretty
