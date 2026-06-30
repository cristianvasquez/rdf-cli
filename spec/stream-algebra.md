---
uuid: ecf2782d-2017-49d7-8b40-a86ee9a14a7e
repo-group: rdf
tldr: short rationale for the `rdf` CLI shape.
tags: [spec/rdf]
---

# rdf stream algebra

This note explains the design bias behind the CLI. For the actual command contract, see `rdf-cli semantics.md`.

## Why this shape

- The CLI is dataset-first, not quad-first.
- Graphless statements are first-class and should not be turned into named graphs implicitly.
- `read` is the default source command because most pipelines start from RDF files or RDF bytes.
- `from-paths` exists for shell composition when another command is already producing paths.
- Transforms stay in dataset space until a command explicitly exits it.
- Sinks own output formatting.

## Stream kinds

- Path stream: one file path per line
- Dataset stream: RDF statements carried between commands as N-Quads
- Bindings stream: SPARQL `SELECT` results as JSON Lines
- Text stream: human-oriented or general shell output

## Command roles

- Sources:
  - `rdf read`
  - `rdf from-paths`
- Dataset transforms:
  - `rdf construct`
  - `rdf validate`
  - `rdf graph-assign`
  - `rdf graph-drop`
- Dataset to bindings:
  - `rdf select`
- Sinks:
  - `rdf pretty`
  - `rdf table`

## Examples

Read files directly:

```bash
rdf read ./data/**/*.ttl | rdf pretty
```

Read RDF bytes from stdin:

```bash
cat ./data.ttl | rdf read | rdf pretty
```

Bridge a path-producing shell pipeline:

```bash
find ./data -name '*.ttl' | rdf from-paths --graph-from path | rdf pretty --format trig
```

Exit RDF space with `SELECT`:

```bash
rdf read ./data/**/*.ttl \
  | rdf select 'SELECT ?s ?p ?o WHERE { ?s ?p ?o }' \
  | rdf table --format csv
```

Make graph dropping explicit:

```bash
rdf read --graph-from path ./data/**/*.ttl \
  | rdf graph-drop \
  | rdf pretty --format turtle
```
