#!/usr/bin/env bash
# Bundle multiple files into pretty TriG, preserving named graphs.

rdf to-quads 'examples/data/**' \
  | rdf pretty --format trig
