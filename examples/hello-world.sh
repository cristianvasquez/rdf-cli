#!/usr/bin/env bash
# Read files of different formats (RDF/XML, Turtle) into one stream of N-Quads.
# The input has no graphs, so the output quads have no graph term.
# Duplicates stay: rdf read does not merge statements.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

rdf read 'data/*.rdf' 'data/*.ttl'
