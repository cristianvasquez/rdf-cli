#!/usr/bin/env bash
# SPARQL CONSTRUCT stays in dataset space, so pretty Turtle works directly.

QUERY='PREFIX foaf: <http://xmlns.com/foaf/0.1/>
CONSTRUCT { ?s foaf:name ?name }
WHERE { ?s foaf:name ?name }'

rdf glob 'examples/data/*' \
  | rdf from-paths \
  | rdf construct "$QUERY" \
  | rdf pretty
