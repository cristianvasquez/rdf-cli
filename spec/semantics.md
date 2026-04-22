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
- `graph-assign <iri>` assigns a named graph to graphless statements and preserves existing named graphs.
- `graph-drop` removes graph terms while staying in dataset space.
- `serialize` preserves the input dataset semantics in the requested serialization, subject to the target format's ability to encode graphs.
- `pretty --format turtle` requires graphless input for faithful Turtle output.
- `pretty --format trig` preserves named graphs and may serialize graphless statements as default-graph content.

## Input semantics by command

### `glob`

- Reads one or more glob patterns from command arguments.
- Writes a path stream on stdout using one path per line.
- `glob` is not an RDF command; it is a path source.

### `from-paths`

- Reads a path stream from stdin using one path per line.
- Parses each path independently and emits one combined dataset stream encoded as N-Quads.
- By default, graphless statements remain graphless.
- `--graph-from path` assigns a file-derived graph only to graphless statements from that file.

### `from-stdin`

- Reads RDF bytes from stdin.
- Stdin format is auto-detected when possible, or can be forced with `--format`.
- Emits a dataset stream encoded as N-Quads.
- Graphless statements remain graphless.

### `select`

- Reads dataset-stream input from stdin by default, using N-Quads as the default parser encoding.
- `--format` may override the stdin parser format.
- Executes the supplied SPARQL SELECT query against the full dataset.
- Writes a bindings stream as JSON Lines.

### `table`

- Reads a bindings stream from stdin in JSON Lines form.
- Renders it as CSV, TSV, or JSON Lines.
- `table` is a sink from bindings space to text space.

### `construct`

- Reads dataset-stream input from stdin by default, using N-Quads as the default parser encoding.
- `--format` may override the stdin parser format.
- Executes the supplied SPARQL CONSTRUCT query against the full dataset.
- Writes the constructed dataset on stdout using N-Quads as the default encoding.
- The constructed output may contain graphless statements, named graphs, or both.

### `graph-assign`

- Reads dataset-stream input from stdin by default, using N-Quads as the default parser encoding.
- Requires one graph IRI argument.
- Rewrites graphless statements into that named graph and preserves existing named graphs.

### `graph-drop`

- Reads dataset-stream input from stdin by default, using N-Quads as the default parser encoding.
- Removes graph terms from all statements.
- Writes a dataset stream encoded as N-Quads.

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
