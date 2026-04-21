---
uuid: 4d701c7f-30fd-4d11-8939-c8fe72629e3f
repo-group: rdf
---

# rdf-cli semantics

This document defines the semantic contract of `rdf-cli` inputs and outputs.

## Core model

- Commands communicate over stdout using RDF streams.
- The canonical in-pipe representation is N-Quads.
- A command either reads RDF from stdin, reads files named on the command line, or both as explicitly documented.
- Errors go to stderr. Valid inputs should still produce output when another input in the same invocation fails.

## Graph semantics

- `to-quads <file...>` parses each input file into a dataset and writes N-Quads.
- For quads parsed from a file whose graph is the RDF default graph, `to-quads` assigns the graph `<file://...>` for that file path.
- For quads parsed from a file whose graph is already named, `to-quads` preserves that graph exactly.
- This means single-graph sources such as Turtle, N-Triples, N3, and RDF/XML become one named graph per file.
- This also means multi-graph sources such as TriG and N-Quads preserve their explicit graph structure, while any default-graph quads from those files are promoted to the file URI graph.
- `to-quads` reading from stdin does not invent a file graph because stdin has no file identity.
- `to-triples` removes graph terms and writes N-Triples.
- `select` and `construct` operate on the graphs present in their stdin dataset.
- `serialize` preserves the input dataset semantics in the requested serialization, subject to the target format's ability to encode graphs.
- `pretty --format turtle` requires graphless input for faithful Turtle output; use `to-triples` first when dropping graphs is intended.

## Input semantics by command

### `to-quads`

- With one or more path or glob arguments: reads matching files, parses each independently, and emits one combined N-Quads stream.
- With no path arguments: reads RDF from stdin.
- Stdin format is auto-detected when possible, or can be forced with `--format`.

### `to-triples`

- Reads N-Quads from stdin by default.
- `--format` may override the stdin parser format.
- Writes N-Triples with all graph information removed.

### `select`

- Reads N-Quads from stdin by default.
- `--format` may override the stdin parser format.
- Executes the supplied SPARQL SELECT query against the full dataset.
- Writes tabular results, not RDF.

### `construct`

- Reads N-Quads from stdin by default.
- `--format` may override the stdin parser format.
- Executes the supplied SPARQL CONSTRUCT query against the full dataset.
- Writes the constructed dataset as N-Quads on stdout.

### `serialize`

- Reads N-Quads from stdin by default.
- `--format` chooses the output serialization.
- Output defaults to N-Quads.
- Serializing to a triples-only format drops graph information because the target format cannot encode it.

### `pretty`

- Reads N-Quads from stdin by default.
- `--input-format` may override the stdin parser format.
- `--format turtle` produces pretty Turtle for graphless datasets.
- `--format trig` produces pretty TriG and preserves named graphs.

### `diff`

- Reads two RDF inputs from file arguments.
- Each side is parsed as a dataset.
- Comparison is triple-level: graph names are ignored when computing additions and removals.
- Output is N-Quads with added triples in graph `<urn:added>` and removed triples in graph `<urn:removed>`.
