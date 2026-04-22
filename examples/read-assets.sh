#!/usr/bin/env bash
# Expand paths, then parse RDF files into a graphless dataset stream.

rdf glob 'examples/data/*.rdf' 'examples/data/*.ttl' \
  | rdf from-paths
