#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLI="$ROOT/bin/rdf-cli.js"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

fail() {
  printf 'smoke test failed: %s\n' "$1" >&2
  exit 1
}

assert_contains() {
  local haystack="$1"
  local needle="$2"
  [[ "$haystack" == *"$needle"* ]] || fail "expected output to contain: $needle"
}

assert_not_contains() {
  local haystack="$1"
  local needle="$2"
  [[ "$haystack" != *"$needle"* ]] || fail "expected output to omit: $needle"
}

assert_line_count() {
  local text="$1"
  local expected="$2"
  local actual
  actual="$(printf '%s' "$text" | awk 'END { print NR }')"
  [[ "$actual" == "$expected" ]] || fail "expected $expected lines, got $actual"
}

to_quads_stdout="$TMP_DIR/to-quads.stdout"
to_quads_stderr="$TMP_DIR/to-quads.stderr"
node "$CLI" to-quads './examples/data/*.{ttl,rdf}' >"$to_quads_stdout" 2>"$to_quads_stderr"
assert_contains "$(cat "$to_quads_stderr")" 'wrong-turtle.ttl'
assert_contains "$(cat "$to_quads_stdout")" 'file://./examples/data/bob-likes-alice.ttl'
assert_contains "$(cat "$to_quads_stdout")" 'file://./examples/data/alice-knows-bob.rdf'
assert_line_count "$(cat "$to_quads_stdout")" 7

triples_output="$(
  node "$CLI" to-quads './examples/data/*.{ttl,rdf}' 2>"$TMP_DIR/pipeline.stderr" |
    node "$CLI" to-triples
)"
assert_not_contains "$triples_output" 'file://'
assert_line_count "$triples_output" 7

select_output="$(
  node "$CLI" to-quads './examples/data/*.{ttl,rdf}' 2>"$TMP_DIR/select.stderr" |
    node "$CLI" select 'PREFIX foaf: <http://xmlns.com/foaf/0.1/> SELECT ?s ?name WHERE { GRAPH ?g { ?s foaf:name ?name } }'
)"
assert_contains "$(cat "$TMP_DIR/select.stderr")" 'wrong-turtle.ttl'
[[ "$select_output" == $'s,name\nhttp://example.org/Alice,Alice\nhttp://example.org/Bob,Bob' ]] \
  || fail 'unexpected csv output from select'

construct_output="$(
  node "$CLI" to-quads './examples/data/*.{ttl,rdf}' 2>"$TMP_DIR/construct.stderr" |
    node "$CLI" construct 'PREFIX foaf: <http://xmlns.com/foaf/0.1/> CONSTRUCT { ?s ?p ?o } WHERE { GRAPH ?g { ?s a foaf:Person . ?s ?p ?o } }' |
    node "$CLI" pretty
)"
assert_contains "$construct_output" 'http://example.org/Alice'
assert_contains "$construct_output" 'http://example.org/Bob'
assert_contains "$construct_output" 'http://xmlns.com/foaf/0.1/name'

cat >"$TMP_DIR/old.nq" <<'EOF'
<http://example.org/Alice> <http://example.org/likes> <http://example.org/Bob> <http://example.org/g> .
EOF
cat >"$TMP_DIR/new.nq" <<'EOF'
<http://example.org/Alice> <http://example.org/likes> <http://example.org/Carol> <http://example.org/g> .
<http://example.org/Alice> <http://example.org/name> "Alice" <http://example.org/g> .
EOF
diff_output="$(node "$CLI" diff "$TMP_DIR/old.nq" "$TMP_DIR/new.nq")"
assert_contains "$diff_output" '<urn:added>'
assert_contains "$diff_output" '<urn:removed>'
assert_contains "$diff_output" 'Carol'
assert_contains "$diff_output" 'Bob'

cat >"$TMP_DIR/.prefixes.json" <<'EOF'
{"ex":"http://example.org/"}
EOF
prefix_output="$(
  cd "$TMP_DIR"
  printf '%s\n' '<http://example.org/Alice> <http://example.org/name> "Alice" .' | node "$CLI" pretty
)"
assert_contains "$prefix_output" '@prefix ex:'

printf 'smoke tests passed\n'
