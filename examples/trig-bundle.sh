#!/usr/bin/env bash
# Bundle multiple files into pretty TriG, preserving named graphs.

rdf-cli to-quads 'examples/data/*.ttl' 'examples/data/*.rdf' \
  | rdf-cli pretty --format trig
