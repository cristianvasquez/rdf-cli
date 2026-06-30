---
uuid: 7e28b748-491f-450a-a0d5-afb7f784df2b
repo-uri: osg://repo/github.com/cristianvasquez/rdf-cli
repo-name: rdf-cli
layout: node.js
tags: [repo/rdf]
repo-group: rdf
---

# [rdf-cli](osg://repo/github.com/cristianvasquez/rdf-cli)

A CLI-only toolkit to manipulate RDF.

## Install

```bash
npm install && npm link
```

The executable is `rdf`.

## Stream kinds

- `from-paths` produces a dataset stream from a path stream
- `read` produces a dataset stream from file paths or stdin
- `select` produces a bindings stream
- `validate` keeps you in dataset space by appending a SHACL report graph
- `table` and `pretty` are sinks to text

By default, graphless statements remain graphless. Graph assignment is explicit.

## Commands

### `read [path...]`

Parse RDF into a dataset stream. With one or more path arguments, `read` expands the paths or globs and parses those files. With no arguments, it reads RDF bytes from stdin and auto-detects the input format.

```bash
rdf read ./data/alice.ttl ./data/bob.ttl
cat ./data/alice.ttl | rdf read
```

Assign file identity explicitly for file inputs:

```bash
rdf read --graph-from path ./data/*.ttl | rdf pretty --format trig
```

### `from-paths`

Read one path per line from stdin and parse RDF files into a dataset stream.

```bash
find ./data -type f \( -name '*.ttl' -o -name '*.rdf' \) | rdf from-paths
```

Assign file identity explicitly when wanted:

```bash
find ./data -type f -name '*.ttl' | rdf from-paths --graph-from path
```

### `select <query>`

Run a SPARQL `SELECT` over a dataset stream and emit a bindings stream as JSON Lines.

```bash
rdf read ./data/**/*.ttl \
  | rdf select 'SELECT ?s ?p ?o WHERE { ?s ?p ?o }'
```

### `table`

Render a bindings stream as CSV, TSV, or JSON Lines.

```bash
rdf read ./data/**/*.ttl \
  | rdf select 'SELECT ?s ?p ?o WHERE { ?s ?p ?o }' \
  | rdf table
```

### `construct <query>`

Run a SPARQL `CONSTRUCT` over a dataset stream and stay in dataset space.

```bash
rdf read ./data/**/*.ttl \
  | rdf construct 'CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }' \
  | rdf pretty
```

### `validate`

Validate a dataset stream against custom or built-in SHACL shapes. The original data stays in the stream and the validation report is appended as a named graph.

```bash
rdf read ./data.ttl \
  | rdf validate --shapes './shapes.ttl' \
  | rdf pretty --format trig
```

Use bundled shapes when they are standard enough to deserve a first-class shortcut:

```bash
rdf read ./vocab.ttl \
  | rdf validate --builtin skos --markdown-report
```

### `graph-assign <iri>`

Assign a named graph to graphless statements.

```bash
rdf read ./data/**/*.ttl \
  | rdf graph-assign urn:batch \
  | rdf pretty --format trig
```

### `graph-drop`

Drop graph terms while staying in dataset space.

```bash
rdf read --graph-from path ./data/**/*.ttl \
  | rdf graph-drop \
  | rdf pretty
```

### `pretty`

Render a dataset stream as TriG, Turtle, N-Quads, or N-Triples.

```bash
rdf read ./data/**/*.ttl | rdf pretty
rdf read --graph-from path ./data/**/*.ttl | rdf pretty
rdf read --graph-from path ./data/**/*.ttl | rdf pretty --format turtle
rdf read ./data/**/*.ttl | rdf pretty --format nquads > bundle.nq
rdf read ./data/**/*.ttl | rdf pretty --format ntriples > bundle.nt
```

`pretty` defaults to TriG so named graphs are preserved. `pretty --format turtle` and `pretty --format ntriples` drop graph assignments because those formats cannot encode named graphs.

Prefixes are loaded from `.prefixes.json` in the current directory, or pass `--prefixes <file>`.

## Examples

```bash
bash examples/read-assets.sh
bash examples/do-select.sh
bash examples/do-construct.sh
bash examples/trig-bundle.sh
```

## Dependencies

[RDF JavaScript Libraries](https://rdf.js.org/) and [Oxigraph](https://github.com/oxigraph/oxigraph) as in-memory triplestore.

## TODO

- Clarify the contract between "dataset stream" as an abstract stream kind and what actually flows through a Unix pipe. Agents need the docs to say explicitly when stdin/stdout carry serialized RDF bytes such as N-Quads versus an internal conceptual stream.
- Document the canonical accepted values for sink `--format`, plus aliases and MIME types. The current docs make tokens like `nquads` versus `n-quads` too easy to guess wrong.
- Make command help and examples consistent about sink output serialization and the `read`/`from-paths` source split.
- Add one end-to-end example that starts with N-Quads on stdin and ends with `rdf pretty --format trig`, with the exact working flags shown.
- Add an "agent readability" pass to the CLI docs: each command should state expected stdin kind, stdout kind, default wire format, accepted format aliases, and one minimal copy-pastable example.
