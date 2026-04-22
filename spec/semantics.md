---
uuid: 4d701c7f-30fd-4d11-8939-c8fe72629e3f
repo-group: rdf
---

# rdf semantics

This document defines the semantic contract of `rdf` inputs and outputs.

## Core model

- Commands communicate over stdout using streams with explicit semantic kinds.
- The semantic center of the RDF pipeline is a dataset stream.
- A dataset stream is a sequence of RDF statements interpreted under dataset semantics.
- At the carrier level, dataset-stream items may be represented as RDFJS `Quad` values.
- A statement may use the RDF default graph or a named graph.
- Graphless statements must be preserved as graphless unless a command explicitly changes graph policy.
- A command either reads RDF from stdin, reads files named on the command line, or both as explicitly documented.
- Errors go to stderr. Valid inputs should still produce output when another input in the same invocation fails.

## Stream kinds

- `rdf` primarily works with dataset streams.
- Some commands are sinks that render dataset streams as text.
- `select` is different: it consumes a dataset stream and emits tabular bindings, not RDF.

## Graph semantics

- The pipeline model is dataset-first, not quad-first.
- Triples and quads are both first-class at the semantic level.
- Commands preserve graph presence or absence unless their purpose is to change graph policy.
- `select` and `construct` operate on the graphs present in their stdin dataset.
- `construct` remains in dataset space: it emits RDF statements, which may be graphless, named, or mixed.
- `serialize` preserves the input dataset semantics in the requested serialization, subject to the target format's ability to encode graphs.
- `pretty --format turtle` requires graphless input for faithful Turtle output; use `to-triples` first when dropping graphs is intended.
- `pretty --format trig` preserves named graphs and may serialize graphless statements as default-graph content.

## Input semantics by command

### `to-quads`

- With one or more path or glob arguments: reads matching files, parses each independently, and emits one combined dataset stream encoded as N-Quads.
- With no path arguments: reads RDF from stdin.
- Stdin format is auto-detected when possible, or can be forced with `--format`.
- When reading from stdin, `to-quads` preserves graphless statements as graphless.
- When reading from file paths, source-derived graph assignment is command policy, not a general dataset invariant.

### `to-triples`

- Reads dataset-stream input from stdin by default, using N-Quads as the default parser encoding.
- `--format` may override the stdin parser format.
- Writes N-Triples with all graph information removed.
- Semantically, this is an explicit graph-dropping step.

### `select`

- Reads dataset-stream input from stdin by default, using N-Quads as the default parser encoding.
- `--format` may override the stdin parser format.
- Executes the supplied SPARQL SELECT query against the full dataset.
- Writes bindings-oriented tabular results, not RDF.

### `construct`

- Reads dataset-stream input from stdin by default, using N-Quads as the default parser encoding.
- `--format` may override the stdin parser format.
- Executes the supplied SPARQL CONSTRUCT query against the full dataset.
- Writes the constructed dataset on stdout using N-Quads as the default encoding.
- The constructed output may contain graphless statements, named graphs, or both.

### `serialize`

- Reads dataset-stream input from stdin by default, using N-Quads as the default parser encoding.
- `--format` chooses the output serialization.
- Output defaults to N-Quads.
- Serializing to a triples-only format drops graph information because the target format cannot encode it.

### `pretty`

- Reads dataset-stream input from stdin by default, using N-Quads as the default parser encoding.
- `--input-format` may override the stdin parser format.
- `--format turtle` produces pretty Turtle for graphless datasets.
- `--format trig` produces pretty TriG and preserves named graphs.
- `pretty` is a sink: it renders the dataset stream for humans rather than preserving a machine-oriented RDF pipe format.

### `diff`

- Reads two RDF inputs from file arguments.
- Each side is parsed as a dataset.
- Comparison is triple-level: graph names are ignored when computing additions and removals.
- Output is N-Quads with added triples in graph `<urn:added>` and removed triples in graph `<urn:removed>`.
