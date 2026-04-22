#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# SPARQL SELECT emits a bindings stream; table renders it as CSV.

rdf glob "$ROOT/examples/data/*.rdf" "$ROOT/examples/data/*.ttl" \
  | rdf from-paths \
  | rdf select 'SELECT ?name WHERE { ?s <http://xmlns.com/foaf/0.1/name> ?name }' \
  | rdf table
