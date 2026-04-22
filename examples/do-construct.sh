#!/usr/bin/env bash
# SPARQL CONSTRUCT stays in the pipe as N-Quads.
# Drop graphs with to-triples before pretty-printing as Turtle.

QUERY='PREFIX foaf: <http://xmlns.com/foaf/0.1/>
CONSTRUCT { ?s foaf:name ?name }
WHERE { GRAPH ?g { ?s foaf:name ?name } }'

rdf to-quads 'examples/data/*' \
  | rdf construct "$QUERY" \
  | rdf to-triples \
  | rdf pretty
