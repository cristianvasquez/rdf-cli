---
repo-group: rdf
---

# rdf stream algebra

This document proposes a small stream algebra for `rdf` and related tools such as `rdf-shacl`.

The goal is composability through explicit stream kinds, minimal command roles, and graph semantics that preserve graphless statements by default.

## Core principles

- Streams have kinds.
- Commands should declare the stream kind they consume and emit.
- Commands should do one conversion or one transformation.
- The pipeline model is dataset-first, not quad-first.
- Graph terms are optional and must be preserved when absent.
- Graph assignment is explicit policy, not a hidden invariant.
- Human-readable summaries go to stderr.

## Stream kinds

The system should expose a small number of semantic stream kinds.

### Path stream

- A path stream is a sequence of source identities such as file paths.
- Its natural line encoding is one path per line.
- Globs belong here. A glob expands to paths, not RDF.

Examples:

```bash
glob './data/**/*.ttl'
find data -name '*.ttl'
```

### Dataset stream

- A dataset stream is a sequence of RDF statements.
- At the API level, this means dataset semantics over a statement stream, not a stream of in-memory dataset containers.
- At the carrier level, each item may be represented as an RDFJS `Quad`.
- Each statement may be:
  - a triple with no graph term
  - a quad with a named graph term
- In RDFJS terms, graphless statements are represented with the default graph term, not by inventing a named graph.
- Graphless statements must be preserved as graphless unless a command explicitly changes graph policy.

This is the semantic center of the system.

### Bindings stream

- A bindings stream is a sequence of variable bindings, such as the rows returned by SPARQL `SELECT`.
- This is not RDF.
- Its natural encodings are row-oriented formats such as TSV, CSV, or JSON Lines.

### Text stream

- A text stream is plain line-oriented output for humans or general shell tools.
- Pretty printers and tabular renderers are usually sinks into this stream kind.

## Command roles

Commands should fit one of these roles.

### Sources

- Produce a stream from command arguments or external input.
- Examples:
  - glob to path stream
  - parse stdin bytes to dataset stream

### Transforms

- Preserve the stream kind while changing its contents.
- Examples:
  - dataset -> dataset
  - bindings -> bindings

### Converters

- Change one stream kind into another.
- Examples:
  - path -> dataset
  - dataset -> bindings
  - dataset -> text

### Sinks

- End a pipeline in a serialization or presentation format.
- A sink may emit text or a file-oriented wire format.

## Dataset semantics

The system should define one canonical semantic object:

- dataset stream

It should not require every statement to carry a named graph.

This means:

- triples are first-class
- quads are first-class
- mixed datasets are valid unless a specific command rejects them

This also means the distinction between abstract data and wire format must stay explicit:

- dataset stream is the semantic model
- N-Triples, N-Quads, Turtle, and TriG are encodings or serializations

## Graph policy

Graph policy should be explicit and local.

### Preserve by default

- Commands preserve graph presence or absence unless their job is to change it.
- A transform must not invent named graphs merely for normalization.

### Assign explicitly

- If file identity or source identity should become a graph term, that should be an explicit command behavior or flag.
- This is a useful policy, but it is still policy.

Examples:

```bash
glob './data/**/*.ttl' | rdf from-paths --graph-from path
glob './data/**/*.ttl' | rdf from-paths | graph assign <urn:batch>
```

### Drop explicitly

- Removing graph terms is also a graph policy step.
- This should remain explicit.

Examples:

```bash
rdf ... | graph drop | rdf pretty --format turtle
```

## Query semantics

SPARQL forms belong to different output algebras.

### `CONSTRUCT`

- Input: dataset stream
- Output: dataset stream
- The result may contain triples, quads, or both, depending on query semantics and engine support.
- Commands consuming the result must preserve graphless statements when present.

### `SELECT`

- Input: dataset stream
- Output: bindings stream
- This exits RDF space.

That distinction should be visible in command naming and documentation.

Examples:

```bash
rdf from-paths | rdf construct --query build.rq | rdf pretty --format trig
rdf from-paths | query select --query report.rq | table csv
```

## Suggested primitive conversions

These primitives are enough to make the system feel like lego pieces.

### `glob`

- Input: none
- Output: path stream

### `rdf from-paths`

- Input: path stream
- Output: dataset stream
- Parses each path independently.
- Preserves graphless statements unless configured otherwise.
- If graph identity should be derived from file identity, that must happen here through an explicit option such as `--graph-from path`.

### `rdf from-stdin`

- Input: byte stream on stdin
- Output: dataset stream

### `rdf construct`

- Input: dataset stream
- Output: dataset stream

### `query select`

- Input: dataset stream
- Output: bindings stream

### `shacl validate`

- Input: dataset stream
- Output: dataset stream
- Adds report statements while keeping input data in the stream.

### `graph assign`

- Input: dataset stream
- Output: dataset stream

### `graph drop`

- Input: dataset stream
- Output: dataset stream

### `rdf pretty`

- Input: dataset stream
- Output: text stream

### `rdf serialize`

- Input: dataset stream
- Output: serialized RDF text stream

## Constraints for sinks

Some sinks require stronger preconditions than transforms.

### Turtle sinks

- Turtle cannot faithfully encode named graphs.
- `rdf pretty --format turtle` should require graphless input.
- If graph terms are present, users should insert an explicit graph policy step first.

### TriG sinks

- TriG can encode datasets with named graphs.
- If the dataset includes graphless statements, the sink should preserve them as default-graph statements rather than invent a named graph.

## Design consequences for current commands

These consequences follow from the algebra even if the current CLI keeps convenience commands.

### `to-quads`

- Today it combines:
  - path expansion
  - RDF parsing
  - graph assignment from file identity
- Those are separable concerns.

It can remain as convenience syntax, but the underlying algebra should treat them as distinct steps.

### `to-triples`

- This is better understood as `graph drop`.
- The current name is convenient, but the semantic role is graph policy.

### `select`

- This should be documented as dataset -> bindings, not as a generic RDF transform.

### `pretty`

- This is a sink, not a general transform.

### `diff`

- Its current two-argument form is less composable than unary stream transforms.
- A future design should consider a more stream-shaped comparison primitive.

## Minimal laws

These laws help users reason about pipelines.

### Preservation law

- If a command is declared dataset -> dataset, it must preserve whether each statement has a graph term unless documented otherwise.

### Explicit policy law

- Graph assignment and graph dropping must be explicit in the command surface.

### Algebra law

- `CONSTRUCT` stays in dataset space.
- `SELECT` exits to bindings space.

### Sink law

- Pretty printers and table renderers are terminal steps from a composability perspective.

## Example pipelines

### Path stream to dataset stream

```bash
glob './data/**/*.ttl' | rdf from-paths
```

### Assign graph identity from source paths

```bash
glob './data/**/*.ttl' | rdf from-paths --graph-from path
```

### Validate while preserving graphless statements

```bash
glob './data/**/*.ttl' \
  | rdf from-paths \
  | shacl validate --shapes shapes.ttl \
  | rdf pretty --format trig
```

### Exit RDF space with a `SELECT`

```bash
glob './data/**/*.ttl' \
  | rdf from-paths \
  | query select --query query.rq \
  | table csv
```

### Make graph dropping explicit

```bash
glob './data/**/*.ttl' \
  | rdf from-paths --graph-from path \
  | graph drop \
  | rdf pretty --format turtle
```
