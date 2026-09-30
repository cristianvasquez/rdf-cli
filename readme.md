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

Four public namespaces: `sources`, `transforms`, `sinks` are the building blocks; `pipeline` composes them with provenance.

Building blocks — materialize once, query many:

```js
import { sources, transforms } from 'rdf-cli'

const store = await transforms.materialize(sources.readFromGlob(['./data/**/*.ttl']))
for (const row of transforms.select(store, 'SELECT ?s ?o WHERE { ?s ?p ?o }')) {
  console.log(row.s.value, row.o.value)
}
```

The `pipeline` layer gives every step one shape — `Operation = (envelope) => Promise<envelope>`, where `envelope = { value, history }`. `pipe` threads the data and appends one result per step. Any op can read the history of earlier ops: `requireConformance` aborts when an upstream `validate` did not conform.

```js
import { pipeline, sinks } from 'rdf-cli'
const { pipe, readPaths, materialize, validate, requireConformance, provenanceToDataset } = pipeline

const env = await pipe(
  readPaths(['./data/**/*.ttl']),
  materialize,
  validate(['./shapes.ttl']),
  requireConformance,          // throws Abort if the data did not conform
)()

// env.value   — the current payload (quads, store, bindings, or text)
// env.history — one result per op (kind, inputs, timing, validation verdict, ...)

// Provenance is RDF: render it as PROV-O and feed it back through the tool.
const trig = await sinks.datasetToString(provenanceToDataset(env.history), {
  format: sinks.TRIG, prefixes: {},
})
```

Provenance is library-only; it never crosses a Unix pipe.

## Stream kinds

Commands compose over Unix pipes. What actually flows between them:

- **Dataset stream** — serialized RDF as **N-Quads** on stdin/stdout. This is the wire format between every dataset-producing command (`read`, `from-paths`, `filter`, `map`, `construct`, `claim`, `validate`, `skolem`, `canonicalize`, `dispatch`).
- **Bindings stream** — SPARQL `SELECT` results as JSON Lines (one JSON object per line). Produced by `select`.
- **Text stream** — human-oriented or general shell output from the sinks.

Roles:

- `read` is the default RDF source: it produces a dataset stream from file paths or stdin
- `from-paths` is the path-stream bridge: it produces a dataset stream from one path per stdin line
- `filter`, `map` and `skolem` work per quad and stream
- `select` exits RDF space and produces a bindings stream
- `ask` exits RDF space and prints `true` or `false`
- `validate` keeps you in dataset space by appending a SHACL report graph
- `table` and `pretty` are sinks to text

By default, graphless statements remain graphless. Graph assignment is explicit (`map -g`).

Each input file is its own blank-node scope: `_:a` in two files gives two different nodes. Labels do not change between pipe stages.

A failure is never silent: a command that reports an error exits `1`.

For the full command-by-command input/output contract, see [`spec/rdf-cli semantics.md`](spec/rdf-cli%20semantics.md).

## Commands

### `read [path...]`

Parse RDF into a dataset stream. With one or more path arguments, `read` expands the paths or globs and parses those files. With no arguments, it reads RDF bytes from stdin and auto-detects the input format.

```bash
rdf read ./data/alice.ttl ./data/bob.ttl
cat ./data/alice.ttl | rdf read
```

Force the format for stdin or for files with an unknown extension:

```bash
rdf read --format jsonld ./data/export.json
cat ./data.txt | rdf read --format turtle
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

### `filter <expr>`

Keep the quads where a SPARQL expression is true. The expression sees one quad: `?s ?p ?o ?g`. `?g` is unbound in the default graph. An expression error counts as false.

```bash
rdf read ./vocab.ttl | rdf filter 'coalesce(langMatches(lang(?o), "en"), true)'
rdf read --graph-from path ./data/*.ttl | rdf filter '?g = <file://./data/a.ttl>'
```

### `map [--where <expr>] [-s|-p|-o|-g <expr>]`

Rewrite the quads that match `--where` (default: `true`). Each rewrite is a SPARQL expression over one quad. Non-matching quads pass unchanged. `-g default` sets the default graph.

```bash
# Put graphless quads into a named graph
rdf read ./data.ttl | rdf map --where '!bound(?g)' -g '<urn:batch>'

# Remove all graphs
rdf read ./data.trig | rdf map -g default

# Change a namespace
rdf read ./data.ttl \
  | rdf map --where 'strstarts(str(?s), "http://old.org/")' \
            -s 'iri(replace(str(?s), "^http://old.org/", "https://new.org/"))'
```

If a rewrite fails, or gives a term that is not valid for its position (for example a literal as subject), the quad passes unchanged, the error goes to stderr, and the exit code is `1`.

### `select <query>`

Run a SPARQL `SELECT` over a dataset stream and emit a bindings stream as JSON Lines.

```bash
rdf read ./data/**/*.ttl \
  | rdf select 'SELECT ?s ?p ?o WHERE { ?s ?p ?o }'
```

Read the query from a file instead of a positional argument with `--query-file <path>`.

### `table`

Render a bindings stream as CSV or TSV. (`select` already emits JSON Lines.)

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

### `ask <query>`

Run a SPARQL `ASK` over a dataset stream. Print `true` or `false`; exit `1` on `false`.

```bash
rdf read ./data.ttl | rdf ask 'ASK { ?s a <http://xmlns.com/foaf/0.1/Person> }'
```

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

### `skolem`

Replace blank nodes with generated IRIs while staying in dataset space.

```bash
rdf read ./data/**/*.ttl \
  | rdf skolem \
  | rdf pretty --format nquads
```

Use a custom base IRI when you need a consistent naming base for one run:

```bash
rdf read ./data/**/*.ttl \
  | rdf skolem --base-iri https://example.org/.well-known/genid \
  | rdf pretty --format nquads
```

### `canonicalize`

Emit the RDFC-1.0 canonical form: canonical blank-node labels (`_:c14n0`, ...) and sorted quads. Isomorphic inputs give equal outputs, so the result is fit for `diff` and hashes.

```bash
rdf read ./a.ttl | rdf canonicalize > a.nq
rdf read ./b.ttl | rdf canonicalize | diff a.nq -
```

### `dispatch <root>`

Write each named graph whose IRI starts with `<root>` to a file. The path is the IRI relative to `<root>`, under `--destination` (default `.`). The format comes from the file extension. Graph terms are dropped in the file. Written quads leave the stream; all other quads pass on. This is the reverse of `read --graph-from path`.

```bash
rdf read --graph-from path 'src/*.ttl' \
  | rdf map -g 'iri(replace(str(?g), "^file://./src/", "file://./out/"))' \
  | rdf dispatch file://./out/ --destination out
```

An existing file is an error unless `--overwrite` is given. A graph that cannot be written stays in the stream, the error goes to stderr, and the exit code is `1`.

### `pretty`

Render a dataset stream as TriG, Turtle, N-Quads, or N-Triples.

```bash
rdf read ./data/**/*.ttl | rdf pretty
rdf read --graph-from path ./data/**/*.ttl | rdf pretty
rdf read --graph-from path ./data/**/*.ttl | rdf pretty --format turtle
rdf read ./data/**/*.ttl | rdf pretty --format nquads > bundle.nq
rdf read ./data/**/*.ttl | rdf pretty --format ntriples > bundle.nt
```

`pretty` defaults to TriG so named graphs are preserved. Any other format is an error. `pretty --format turtle` and `pretty --format ntriples` drop graph assignments because those formats cannot encode named graphs.

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

`table` output formats: `csv`, `tsv`.

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
