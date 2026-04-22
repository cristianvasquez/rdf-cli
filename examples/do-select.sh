#!/usr/bin/env bash
# SPARQL SELECT → CSV. Triples live in named graphs, so use GRAPH ?g.
# Pipe through to-triples first if you want to query without GRAPH patterns.

rdf to-quads 'examples/data/*' \
  | rdf select 'SELECT ?name WHERE { GRAPH ?g { ?s <http://xmlns.com/foaf/0.1/name> ?name } }'
