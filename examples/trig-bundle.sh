#!/usr/bin/env bash
# Bundle multiple files into pretty TriG, assigning file graphs explicitly.

# shellcheck disable=SC2016
rdf glob 'examples/data/**' \
  | rdf from-paths --graph-from path \
  | rdf pretty --format trig
