#!/usr/bin/env bash
# Diff two snapshots of RDF data.
# Added triples go into <urn:added>, removed into <urn:removed>.
# TriG makes the result immediately readable.

rdf diff \
  <(rdf to-quads examples/data/alice-knows-bob.rdf) \
  <(rdf to-quads examples/data/alice-knows-carol.ttl) \
  | rdf pretty --format trig
