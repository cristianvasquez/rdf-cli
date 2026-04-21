---
uuid: 7e28b748-491f-450a-a0d5-afb7f784df2b
repo-uri: osg://repo/github.com/cristianvasquez/rdf-assets
repo-name: rdf-cli
layout: node.js
---

# [rdf-cli](osg://repo/github.com/cristianvasquez/rdf-assets)

A CLI-only toolkit to process RDF files with pipes.

## Install

```bash
pnpm install && pnpm link --global
```

## How it works

Commands talk to each other via N-Quads on stdout. Each file becomes a named graph (its `file://` URI). That graph info travels through the pipe and you can drop it with `to-triples` when you don't need it.

```
to-quads → [N-Quads stream] → to-triples / select / construct / serialize / pretty / diff
```

## Commands

### `to-quads <glob...>`

Parse RDF files into N-Quads. Each file gets its own named graph.

```bash
rdf-cli to-quads './data/**/*.ttl' './data/**/*.rdf'
```

Also reads from stdin if no glob is given (format auto-detected, or use `--format`):

```bash
curl https://example.org/data.ttl | rdf-cli to-quads --format turtle
```

### `to-triples`

Drop the graph axis. Use this before `pretty --format turtle`.

```bash
rdf-cli to-quads ./**/*.ttl | rdf-cli to-triples
```

### `pretty`

Pretty-print as Turtle (default) or TriG.

```bash
rdf-cli to-quads ./**/*.ttl | rdf-cli to-triples | rdf-cli pretty
rdf-cli to-quads ./**/*.ttl | rdf-cli pretty --format trig
```

Prefixes are loaded from `.prefixes.json` in the current directory, or pass `--prefixes <file>`.

```json
{ "foaf": "http://xmlns.com/foaf/0.1/", "ex": "http://example.org/" }
```

### `select <query>`

SPARQL SELECT → CSV (default), TSV, or JSON lines.

```bash
rdf-cli to-quads ./**/*.ttl | rdf-cli select "SELECT ?s ?name WHERE { GRAPH ?g { ?s foaf:name ?name } }"
rdf-cli to-quads ./**/*.ttl | rdf-cli select "SELECT ..." --output tsv
rdf-cli to-quads ./**/*.ttl | rdf-cli select --query-file query.sparql --output json
```

Note: triples live in named graphs, so queries need `GRAPH ?g { }` unless you pipe through `to-triples` first.

### `construct <query>`

SPARQL CONSTRUCT → N-Quads (stays in the pipe).

```bash
rdf-cli to-quads ./**/*.ttl | rdf-cli construct "CONSTRUCT { ?s ?p ?o } WHERE { GRAPH ?g { ?s a foaf:Person . ?s ?p ?o } }" | rdf-cli pretty
```

### `serialize`

Compact N-Quads (default, preserves graphs) or N-Triples.

```bash
rdf-cli to-quads ./**/*.ttl | rdf-cli serialize > bundle.nq
rdf-cli to-quads ./**/*.ttl | rdf-cli serialize --format ntriples > bundle.nt
```

### `diff <old> <new>`

Compare two N-Quads files. Emits a single N-Quads stream with added triples in `<urn:added>` and removed in `<urn:removed>`.

```bash
rdf-cli diff <(rdf-cli to-quads old/*.ttl) <(rdf-cli to-quads new/*.ttl) | rdf-cli pretty --format trig
```

```trig
<urn:added> {
  <http://example.org/Alice> <http://xmlns.com/foaf/0.1/knows> <http://example.org/Carol> .
}
<urn:removed> {
  <http://example.org/Alice> <http://xmlns.com/foaf/0.1/knows> <http://example.org/Bob> .
}
```

Diff is triple-level (graph info stripped before comparison).

## Pipelines

```bash
# bundle everything into one trig file
rdf-cli to-quads ./**/*.ttl | rdf-cli serialize > bundle.nq

# pretty-print flat turtle from multiple files
rdf-cli to-quads ./**/*.ttl | rdf-cli to-triples | rdf-cli pretty

# query and get CSV
rdf-cli to-quads ./**/*.ttl | rdf-cli select "SELECT ?s ?p ?o WHERE { GRAPH ?g { ?s ?p ?o } }" > results.csv

# construct then pretty
rdf-cli to-quads ./**/*.ttl | rdf-cli construct --query-file build.sparql | rdf-cli pretty --format trig
```

## Examples

The `examples/` directory now contains shell scripts that exercise the CLI directly:

```bash
bash examples/read-assets.sh
bash examples/do-select.sh
bash examples/do-construct.sh
bash examples/trig-bundle.sh
```

## Dependencies

[RDF JavaScript Libraries](https://rdf.js.org/) and [Oxigraph](https://github.com/oxigraph/oxigraph) as in-memory triplestore.
