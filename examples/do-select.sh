#!/usr/bin/env bash
# SPARQL SELECT emits a bindings stream; table renders it as CSV.

rdf glob 'examples/data/*' \
  | rdf from-paths \
  | rdf select 'SELECT ?name WHERE { ?s <http://xmlns.com/foaf/0.1/name> ?name }' \
  | rdf table
