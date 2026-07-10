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
  - `rdf claim`
  - `rdf validate`
  - `rdf graph-assign`
  - `rdf graph-drop`
  - `rdf skolem`
- Dataset to bindings:
  - `rdf select`
- Sinks:
  - `rdf pretty`
  - `rdf table`

## Claimers: the pipe is the cascade

A claimer is one claim (SHACL shapes: "these are the quads I read") plus a
fan-out of named views (CONSTRUCTs over the claimed quads only). One document
defines one claimer, and `rdf claim` applies one claimer per process — so a
cascade of claimers is just a pipe, and precedence is pipe order. There is no
order metadata anywhere.

What makes this sound is that claimed-vs-rest is marked by the graph term
itself, reusing the graph policy above:

- the working set is the **graphless** subset of the incoming stream;
- claiming moves quads **out of** graphless space — claimed quads land in the
  claimer's `:source` graph (provenance), each view's output lands in the
  view's own graph;
- the rest stays graphless, still claimable by the next claimer;
- quads that already carry a named graph were claimed upstream and pass
  through untouched.

So "a later claimer cannot take an earlier claimer's quads" is not a runtime
check — it is impossible by construction, and any intermediate wire can be
inspected to see exactly what is claimed and by whom. Making named data
claimable is explicit, like every other graph-policy change: pipe
`rdf graph-drop` first.

```bash
rdf read ./data/**/*.ttl \
  | rdf claim ./claimers/person.trig \
  | rdf claim ./claimers/organization.trig \
  | rdf pretty --format trig
```

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
