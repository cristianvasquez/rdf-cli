#!/usr/bin/env bash
# Parse RDF files → N-Quads. Each file becomes a named graph.

rdf-cli to-quads \
  examples/data/alice-knows-bob.rdf \
  examples/data/bob-likes-alice.ttl
