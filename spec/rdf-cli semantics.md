---
uuid: 4d701c7f-30fd-4d11-8939-c8fe72629e3f
repo-group: rdf
tldr: semantic contract for `rdf` command inputs and outputs.
tags: [spec/rdf]
---

# rdf semantics

This document defines the current command contract for `rdf`.

## Core rules

- `read` is the default RDF source command.
- `from-paths` is the bridge from a plain text path stream into the RDF pipeline.
- Dataset-producing commands communicate over stdin/stdout as N-Quads.
- Graphless statements stay graphless unless a command explicitly changes graph policy.
- `select` exits RDF space and emits bindings as JSON Lines.
- `table` and `pretty` are sinks.
- Errors go to stderr. When possible, valid inputs still produce output even if another input fails.

## Command Contract

The command-by-command input/output contract is the `Cmd` algebra in
[`manifest.hs`](manifest.hs). `pnpm lint` checks that the JavaScript command
`io:{}` metadata stays in sync with it.

## Graph policy

- Preserve graph presence or absence by default.
- Use `graph-assign` to add named graphs explicitly.
- Use `graph-drop` to remove graph terms explicitly.
- Sink formats can also force graph loss when the target format cannot encode named graphs.

## Sink formats

- `pretty --format trig`: human-oriented, preserves named graphs
- `pretty --format turtle`: human-oriented, drops graph assignments
- `pretty --format nquads`: machine-oriented, preserves named graphs
- `pretty --format ntriples`: machine-oriented, drops graph assignments
- `table --format csv|tsv|jsonl`: bindings sink formats
