---
uuid: 7e28b748-491f-450a-a0d5-afb7f784df2b
repo-uri: osg://repo/github.com/cristianvasquez/rdf-cli
repo-name: rdf-cli
layout: node.js
tags: [repo/rdf]
repo-group: rdf
---

# [rdf-cli](osg://repo/github.com/cristianvasquez/rdf-cli)

A mini-toolkit to manipulate RDF from the CLI or from application code.

## Install

```bash
npm install && npm link
```

The executable is `rdf`.

## Reuse As A Library

The package now exposes only the pipeline building blocks as a public module surface, so other applications do not need to import internal files directly.

```js
import { sources, transforms, sinks } from 'rdf-cli'

const source = sources.readFromGlob(['./data/**/*.ttl'], { graphFrom: 'path' })

// Materialize once, then run one or more queries against the same store.
const store = await transforms.materialize(source)
const rows = transforms.select(
  store,
  'SELECT ?s ?p ?o WHERE { GRAPH ?g { ?s ?p ?o } }',
)

for (const row of rows) {
  console.log(row.s.value, row.p.value, row.o.value)
}

const trig = await sinks.datasetToString(dataset, {
  format: sinks.TRIG,
  prefixes: {},
})
```

## Stream kinds

Commands compose over Unix pipes. What actually flows between them:

- **Dataset stream** — serialized RDF as **N-Quads** on stdin/stdout. This is the wire format between every dataset-producing command (`read`, `from-paths`, `construct`, `validate`, `graph-assign`, `graph-drop`, `skolem`).
- **Bindings stream** — SPARQL `SELECT` results as JSON Lines (one JSON object per line). Produced by `select`.
- **Text stream** — human-oriented or general shell output from the sinks.

Roles:

- `read` is the default RDF source: it produces a dataset stream from file paths or stdin
- `from-paths` is the path-stream bridge: it produces a dataset stream from one path per stdin line
- `select` exits RDF space and produces a bindings stream
- `validate` keeps you in dataset space by appending a SHACL report graph
- `table` and `pretty` are sinks to text

By default, graphless statements remain graphless. Graph assignment is explicit.

For the full command-by-command input/output contract, see [`spec/rdf-cli semantics.md`](spec/rdf-cli%20semantics.md).

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

Read one path per line from stdin and parse RDF files into a dataset stream. Use this when another shell command is already producing the paths.

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

Read the query from a file instead of a positional argument with `--query-file <path>`.

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

Read the query from a file instead of a positional argument with `--query-file <path>`.

### `validate`

Validate a dataset stream against custom or built-in SHACL shapes. The original data stays in the stream and the validation report is appended as a named graph.

```bash
rdf read ./data.ttl \
  | rdf validate --shapes './shapes.ttl' \
  | rdf pretty --format trig
```

`--shapes` accepts a comma-separated list of glob patterns. Use bundled shapes when they are standard enough to deserve a first-class shortcut:

```bash
rdf read ./vocab.ttl \
  | rdf validate --builtin skos --markdown-report
```

`--builtin` accepts `shacl` or `skos`. Other flags:

- `--report-graph <iri>` sets the named graph for the appended report (default `<urn:validation-report>`).
- `--markdown-report` prints a Markdown summary to stderr while the dataset stream still flows on stdout.

`validate` exits with code `1` on non-conformance.

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

### `skolem`

Replace blank nodes with generated IRIs while staying in dataset space.

```bash
rdf read ./data/**/*.ttl \
  | rdf skolem \
  | rdf pretty --format nquads
```

Use a custom base IRI when you need stable local naming policy:

```bash
rdf read ./data/**/*.ttl \
  | rdf skolem --base-iri https://example.org/.well-known/genid \
  | rdf pretty --format nquads
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

## Formats

Format tokens are case-insensitive. `read` and `from-paths` accept any of the input tokens below (stdin is also auto-detected when no format is forced); sinks emit the output tokens.

| Token(s) | MIME type | Input | `pretty` output | Named graphs |
| --- | --- | --- | --- | --- |
| `trig` | `application/trig` | yes | yes (default) | preserved |
| `turtle`, `ttl` | `text/turtle` | yes | yes | dropped |
| `nquads`, `nq` | `application/n-quads` | yes | yes | preserved |
| `ntriples`, `nt` | `application/n-triples` | yes | yes | dropped |
| `jsonld`, `json` | `application/ld+json` | yes | no | — |
| `rdfxml`, `xml` | `application/rdf+xml` | yes | no | — |
| `n3` | `text/n3` | yes | no | — |

`table` output formats: `csv`, `tsv`, `jsonl`.

## Examples

```bash
bash examples/hello-world.sh
bash examples/do-construct.sh
bash examples/trig-bundle.sh
```

End to end, from N-Quads on stdin to TriG:

```bash
printf '<http://ex/s> <http://ex/p> <http://ex/o> <http://ex/g> .\n' \
  | rdf read \
  | rdf pretty --format trig
```

## Command manifest

`npm run manifest` emits an RDF (N-Quads) description of the CLI itself — every command, its arguments, and the stream/media types it consumes and produces. Useful for tooling or agents that need a machine-readable contract instead of parsing `--help`.

## Dependencies

[RDF JavaScript Libraries](https://rdf.js.org/) and [Oxigraph](https://github.com/oxigraph/oxigraph) as in-memory triplestore.

## TODO

- Auto-detect input format for file inputs by extension is already wired (`.ttl`, `.nq`, `.trig`, …), but there is no way to force a format on a file whose extension lies. Consider a `--format` override on `read`.
