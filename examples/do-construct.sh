#!/usr/bin/env bash
# Make new statements with SPARQL CONSTRUCT.
# Input: foaf:knows statements. Output: the inverse, ex:knownBy.
# rdf pretty uses the prefixes in .prefixes.json (found in the current directory).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

rdf read 'data/*.rdf' 'data/*.ttl' \
  | rdf construct '
      PREFIX foaf: <http://xmlns.com/foaf/0.1/>
      PREFIX ex:   <http://example.org/>
      CONSTRUCT { ?b ex:knownBy ?a } WHERE { ?a foaf:knows ?b }' \
  | rdf pretty --format turtle
