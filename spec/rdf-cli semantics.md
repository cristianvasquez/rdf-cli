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

## Commands

| Command | Input | Output | Notes |
| --- | --- | --- | --- |
| `read` | file paths as args, or RDF bytes on stdin when no paths are given | dataset stream as N-Quads | Expands file globs. Auto-detects stdin RDF format. `--graph-from path` is only for file inputs. |
| `from-paths` | one file path per stdin line | dataset stream as N-Quads | Parses each path independently. Preserves graphless statements by default. Supports `--graph-from path`. |
| `select` | dataset stream as N-Quads on stdin | bindings stream as JSON Lines | Runs a SPARQL `SELECT` over the full dataset. |
| `table` | bindings stream as JSON Lines on stdin | text | Sink. `--format csv|tsv|jsonl`. |
| `construct` | dataset stream as N-Quads on stdin | dataset stream as N-Quads | Runs a SPARQL `CONSTRUCT`. Output is currently graphless because the engine does not support `GRAPH` in the construct template. |
| `validate` | dataset stream as N-Quads on stdin | dataset stream as N-Quads | Validates against custom or built-in SHACL shapes. Appends the report in a named graph. Exits with code `1` on non-conformance. |
| `graph-assign` | dataset stream as N-Quads on stdin | dataset stream as N-Quads | Rewrites graphless statements into the supplied named graph. Preserves existing named graphs. |
| `graph-drop` | dataset stream as N-Quads on stdin | dataset stream as N-Quads | Removes graph terms from all statements. |
| `pretty` | dataset stream as N-Quads on stdin | text or RDF bytes | Sink. `--format trig` is default and preserves named graphs. `turtle` and `ntriples` drop graph assignments. `nquads` preserves named graphs. |

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
