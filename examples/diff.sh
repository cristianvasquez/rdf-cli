#!/usr/bin/env bash
# Diff two snapshots of RDF data.
# Added triples go into <urn:added>, removed into <urn:removed>.
# TriG makes the result immediately readable.

rdf-cli diff \
  <(rdf-cli to-quads examples/data/alice-knows-bob.rdf) \
  <(rdf-cli to-quads examples/data/alice-knows-carol.ttl) \
  | rdf-cli pretty --format trig
