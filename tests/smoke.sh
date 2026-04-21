#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLI="node $ROOT/bin/rdf-cli.js"
DATA="$ROOT/examples/data"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

pass=0
fail=0

ok() { printf '  ok  %s\n' "$1"; pass=$((pass+1)); }
fail() { printf ' FAIL %s\n' "$1" >&2; fail=$((fail+1)); }

assert_contains()    { [[ "$1" == *"$2"* ]] && ok "$3" || fail "$3: expected to contain: $2"; }
assert_not_contains(){ [[ "$1" != *"$2"* ]] && ok "$3" || fail "$3: expected to omit: $2"; }
assert_lines()       { local n; n=$(printf '%s' "$1" | grep -c .); [[ "$n" == "$2" ]] && ok "$3" || fail "$3: expected $2 lines, got $n"; }
assert_empty()       { [[ -z "$1" ]] && ok "$2" || fail "$2: expected empty output"; }
assert_rdf_parseable() {
  local file="$1" format="$2" label="$3"
  if node --input-type=module -e "
    import { readFileSync } from 'node:fs'
    import { Readable } from 'node:stream'
    import formats from '@rdfjs/formats'
    import rdf from 'rdf-ext'

    const input = readFileSync(process.argv[1], 'utf8')
    const dataset = rdf.dataset()
    await dataset.import(formats.parsers.import(process.argv[2], Readable.from([input])))
  " "$file" "$format"; then
    ok "$label"
  else
    fail "$label: output is not parseable as $format"
  fi
}

# ---------------------------------------------------------------------------
printf '\nto-quads\n'

out=$($CLI to-quads "$DATA/alice-knows-bob.rdf" "$DATA/bob-likes-alice.ttl" 2>"$TMP/err")
assert_lines    "$out" 7                                        "7 quads from two files"
assert_contains "$out" "<file://$DATA/alice-knows-bob.rdf>"    "rdf file gets named graph"
assert_contains "$out" "<file://$DATA/bob-likes-alice.ttl>"    "ttl file gets named graph"
assert_empty    "$(cat "$TMP/err")"                            "no stderr for valid files"

out=$($CLI to-quads "$DATA/two-graphs.trig" 2>"$TMP/err")
assert_contains "$out" "<urn:g1>"                              "trig keeps first named graph"
assert_contains "$out" "<urn:g2>"                              "trig keeps second named graph"
assert_not_contains "$out" "two-graphs.trig>"                  "trig does not overwrite named graphs"
assert_empty    "$(cat "$TMP/err")"                            "no stderr for valid trig"

out=$($CLI to-quads "$DATA/two-graphs.nq" 2>"$TMP/err")
assert_contains "$out" "<urn:g1>"                              "nquads keeps first named graph"
assert_contains "$out" "<urn:g2>"                              "nquads keeps second named graph"
assert_not_contains "$out" "two-graphs.nq>"                    "nquads does not overwrite named graphs"
assert_empty    "$(cat "$TMP/err")"                            "no stderr for valid nquads"

out=$($CLI to-quads "$DATA/alice-knows-bob.rdf" "$DATA/with-errors/wrong-turtle.ttl" 2>"$TMP/err" || true)
assert_contains "$(cat "$TMP/err")" "wrong-turtle.ttl"         "parse error goes to stderr"
assert_contains "$out" "Alice"                                 "valid file still emits quads"

# ---------------------------------------------------------------------------
printf '\nto-triples\n'

out=$($CLI to-quads "$DATA/alice-knows-bob.rdf" "$DATA/bob-likes-alice.ttl" 2>/dev/null \
      | $CLI to-triples)
assert_lines        "$out" 7   "same quad count as N-Triples"
assert_not_contains "$out" "file://" "graph URIs are gone"

# ---------------------------------------------------------------------------
printf '\nselect\n'

out=$($CLI to-quads "$DATA/alice-knows-bob.rdf" "$DATA/bob-likes-alice.ttl" 2>/dev/null \
      | $CLI select 'SELECT ?name WHERE { GRAPH ?g { ?s <http://xmlns.com/foaf/0.1/name> ?name } }')
assert_contains "$out" "name"  "header row present"
assert_contains "$out" "Alice" "Alice in results"
assert_contains "$out" "Bob"   "Bob in results"
assert_lines    "$out" 3       "header + 2 results"

out=$($CLI to-quads "$DATA/alice-knows-bob.rdf" "$DATA/bob-likes-alice.ttl" 2>/dev/null \
      | $CLI select 'SELECT ?name WHERE { GRAPH ?g { ?s <http://xmlns.com/foaf/0.1/name> ?name } }' --output tsv)
assert_contains "$out" "Alice" "tsv: Alice present"

out=$($CLI to-quads "$DATA/alice-knows-bob.rdf" "$DATA/bob-likes-alice.ttl" 2>/dev/null \
      | $CLI select 'SELECT ?name WHERE { GRAPH ?g { ?s <http://xmlns.com/foaf/0.1/name> ?name } }' --output json)
assert_contains "$out" '"Alice"' "json: Alice present"

# ---------------------------------------------------------------------------
printf '\nconstruct\n'

out=$($CLI to-quads "$DATA/alice-knows-bob.rdf" "$DATA/bob-likes-alice.ttl" 2>/dev/null \
      | $CLI construct 'CONSTRUCT { ?s ?p ?o } WHERE { GRAPH ?g { ?s <http://xmlns.com/foaf/0.1/name> ?o . ?s ?p ?o } }')
assert_not_contains "$out" "file://"          "construct output is in default graph"

nq_lines=$(printf '%s' "$out" | grep -c ' \. *$' || true)
[[ "$nq_lines" -gt 0 ]] && ok "construct emits N-Quads" || fail "construct emits N-Quads: got no quads"

out=$($CLI to-quads "$DATA/alice-knows-bob.rdf" "$DATA/bob-likes-alice.ttl" 2>/dev/null \
      | $CLI construct 'CONSTRUCT { ?s ?p ?o } WHERE { GRAPH ?g { ?s <http://xmlns.com/foaf/0.1/name> ?o . ?s ?p ?o } }' \
      | $CLI to-triples \
      | $CLI pretty)
assert_contains "$out" "Alice" "construct | to-triples | pretty works"

# ---------------------------------------------------------------------------
printf '\nserialize\n'

out=$($CLI to-quads "$DATA/bob-likes-alice.ttl" 2>/dev/null | $CLI serialize)
assert_contains     "$out" "file://" "nquads: graph term present"
assert_lines        "$out" 3         "nquads: 3 quads from one file"

out=$($CLI to-quads "$DATA/bob-likes-alice.ttl" 2>/dev/null | $CLI serialize --format ntriples)
assert_not_contains "$out" "file://" "ntriples: graph term absent"
assert_lines        "$out" 3         "ntriples: 3 triples"

# ---------------------------------------------------------------------------
printf '\npretty\n'

out=$($CLI to-quads "$DATA/alice-knows-bob.rdf" "$DATA/bob-likes-alice.ttl" 2>/dev/null \
      | $CLI to-triples | $CLI pretty)
assert_contains     "$out" "Alice"    "turtle: Alice present"
assert_not_contains "$out" "file://" "turtle: no graph URIs"

out=$($CLI to-quads "$DATA/alice-knows-bob.rdf" "$DATA/bob-likes-alice.ttl" 2>/dev/null \
      | $CLI pretty --format trig)
assert_contains "$out" "file://"       "trig: named graphs present"
assert_contains "$out" "alice-knows-bob.rdf>" "trig: rdf graph"
assert_contains "$out" "bob-likes-alice.ttl>" "trig: ttl graph"

cat >"$TMP/backslash-newline.ttl" <<'EOF'
<http://example/s> <http://example/p> """hello \\
world""" .
EOF

out=$($CLI to-quads "$TMP/backslash-newline.ttl" 2>/dev/null \
      | $CLI to-triples \
      | $CLI pretty)
printf '%s' "$out" >"$TMP/backslash-newline.pretty.ttl"
assert_rdf_parseable "$TMP/backslash-newline.pretty.ttl" "text/turtle" "turtle: multiline backslash literal round-trips"

out=$($CLI to-quads "$TMP/backslash-newline.ttl" 2>/dev/null \
      | $CLI pretty --format trig)
printf '%s' "$out" >"$TMP/backslash-newline.pretty.trig"
assert_rdf_parseable "$TMP/backslash-newline.pretty.trig" "application/trig" "trig: multiline backslash literal round-trips"

# ---------------------------------------------------------------------------
printf '\ndiff\n'

out=$($CLI diff \
  <($CLI to-quads "$DATA/alice-knows-bob.rdf" 2>/dev/null) \
  <($CLI to-quads "$DATA/alice-knows-carol.ttl" 2>/dev/null))
assert_contains "$out" "<urn:added>"   "diff: added graph present"
assert_contains "$out" "<urn:removed>" "diff: removed graph present"
assert_contains "$out" "Carol"         "diff: Carol in added"
assert_contains "$out" "Bob"           "diff: Bob in removed"

out=$($CLI diff \
  <($CLI to-quads "$DATA/alice-knows-bob.rdf" 2>/dev/null) \
  <($CLI to-quads "$DATA/alice-knows-bob.rdf" 2>/dev/null))
assert_empty "$out" "diff of identical files is empty"

# ---------------------------------------------------------------------------
printf '\nstdin format detection\n'

out=$(cat "$DATA/bob-likes-alice.ttl" | $CLI to-quads --format turtle)
assert_contains "$out" "Bob"     "stdin turtle: quads emitted"
assert_lines    "$out" 3         "stdin turtle: 3 quads"

out=$(printf '<http://example.org/s> <http://example.org/p> <http://example.org/o> .\n' \
      | $CLI to-quads)
assert_contains "$out" "example.org/s" "stdin autodetect n-triples"

# ---------------------------------------------------------------------------
printf '\nprefixes autodiscovery\n'

cat >"$TMP/.prefixes.json" <<'EOF'
{"ex":"http://example.org/","foaf":"http://xmlns.com/foaf/0.1/"}
EOF
out=$(cd "$TMP" && $CLI to-quads "$DATA/bob-likes-alice.ttl" 2>/dev/null | $CLI pretty)
assert_contains "$out" "@prefix ex:"   "prefix ex: applied"
assert_contains "$out" "@prefix foaf:" "prefix foaf: applied"

# ---------------------------------------------------------------------------
printf '\n'
if [[ "$fail" -eq 0 ]]; then
  printf 'all %d tests passed\n' "$pass"
else
  printf '%d passed, %d failed\n' "$pass" "$fail" >&2
  exit 1
fi
