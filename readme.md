---
uuid: 7e28b748-491f-450a-a0d5-afb7f784df2b
repo-uri: osg://repo/github.com/cristianvasquez/rdf-assets
repo-name: rdf-cli
layout: node.js
---

# [rdf-cli](osg://repo/github.com/cristianvasquez/rdf-assets)

A CLI-only toolkit to manipulate RDF.

## Install

```bash
pnpm install && pnpm link --global
```

The executable is `rdf`.

## Stream kinds

- `glob` produces a path stream
- `from-paths` and `from-stdin` produce a dataset stream
- `select` produces a bindings stream
- `validate` keeps you in dataset space by appending a SHACL report graph
- `table` and `pretty` are sinks to text

By default, graphless statements remain graphless. Graph assignment is explicit.

## Commands

### `glob <pattern...>`

Expand one or more globs and write one path per line.

```bash
rdf glob './data/**/*.ttl' './data/**/*.rdf'
```

### `from-paths`

Read one path per line from stdin and parse RDF files into a dataset stream.

```bash
rdf glob './data/**/*.ttl' './data/**/*.rdf' | rdf from-paths
```

Assign file identity explicitly when wanted:

```bash
rdf glob './data/**/*.ttl' | rdf from-paths --graph-from path
```

### `from-stdin`

Parse RDF bytes from stdin into a dataset stream.

```bash
curl https://example.org/data.ttl | rdf from-stdin --format turtle
```

### `select <query>`

Run a SPARQL `SELECT` over a dataset stream and emit a bindings stream as JSON Lines.

```bash
rdf glob './data/**/*.ttl' \
  | rdf from-paths \
  | rdf select 'SELECT ?s ?p ?o WHERE { ?s ?p ?o }'
```

### `table`

Render a bindings stream as CSV, TSV, or JSON Lines.

```bash
rdf glob './data/**/*.ttl' \
  | rdf from-paths \
  | rdf select 'SELECT ?s ?p ?o WHERE { ?s ?p ?o }' \
  | rdf table
```

### `construct <query>`

Run a SPARQL `CONSTRUCT` over a dataset stream and stay in dataset space.

```bash
rdf glob './data/**/*.ttl' \
  | rdf from-paths \
  | rdf construct 'CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }' \
  | rdf pretty
```

### `validate`

Validate a dataset stream against custom or built-in SHACL shapes. The original data stays in the stream and the validation report is appended as a named graph.

```bash
rdf glob './data.ttl' \
  | rdf from-paths \
  | rdf validate --shapes './shapes.ttl' \
  | rdf pretty --format trig
```

Use bundled shapes when they are standard enough to deserve a first-class shortcut:

```bash
rdf glob './vocab.ttl' \
  | rdf from-paths \
  | rdf validate --builtin skos --markdown-report
```

### `graph-assign <iri>`

Assign a named graph to graphless statements.

```bash
rdf glob './data/**/*.ttl' \
  | rdf from-paths \
  | rdf graph-assign urn:batch \
  | rdf pretty --format trig
```

### `graph-drop`

Drop graph terms while staying in dataset space.

```bash
rdf glob './data/**/*.ttl' \
  | rdf from-paths --graph-from path \
  | rdf graph-drop \
  | rdf pretty
```

### `serialize`

Serialize a dataset stream as N-Quads or N-Triples.

```bash
rdf glob './data/**/*.ttl' | rdf from-paths | rdf serialize > bundle.nq
rdf glob './data/**/*.ttl' | rdf from-paths | rdf serialize --format ntriples > bundle.nt
```

### `pretty`

Pretty-print a dataset stream as Turtle or TriG.

```bash
rdf glob './data/**/*.ttl' | rdf from-paths | rdf pretty
rdf glob './data/**/*.ttl' | rdf from-paths --graph-from path | rdf pretty --format trig
```

`pretty --format turtle` requires graphless input. Use `graph-drop` first when dropping graphs is intentional.

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
