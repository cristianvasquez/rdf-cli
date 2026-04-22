#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLI="node $ROOT/bin/rdf.js"
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

printf '\nglob\n'

out=$($CLI glob "$DATA/*.rdf" "$DATA/*.ttl" 2>"$TMP/err")
assert_contains "$out" "$DATA/alice-knows-bob.rdf" "glob: rdf path emitted"
assert_contains "$out" "$DATA/bob-likes-alice.ttl" "glob: ttl path emitted"
assert_lines "$out" 3 "glob: one path per line"
assert_empty "$(cat "$TMP/err")" "glob: no stderr for matches"

out=$($CLI glob "$DATA/nope/*.ttl" 2>"$TMP/err" || true)
assert_empty "$out" "glob: no stdout for empty match"
assert_contains "$(cat "$TMP/err")" "no files matched" "glob: warns on empty match"

printf '\nfrom-paths\n'

out=$(printf '%s\n%s\n' "$DATA/alice-knows-bob.rdf" "$DATA/bob-likes-alice.ttl" \
  | $CLI from-paths 2>"$TMP/err")
assert_lines "$out" 7 "from-paths: 7 statements from two files"
assert_not_contains "$out" "file://" "from-paths: preserves graphless statements by default"
assert_empty "$(cat "$TMP/err")" "from-paths: no stderr for valid files"

out=$(printf '%s\n' "$DATA/bob-likes-alice.ttl" \
  | $CLI from-paths --graph-from path 2>"$TMP/err")
assert_contains "$out" "<file://$DATA/bob-likes-alice.ttl>" "from-paths: --graph-from path assigns file graph"
assert_empty "$(cat "$TMP/err")" "from-paths: graph-from path has no stderr"

out=$(printf '%s\n' "$DATA/two-graphs.trig" | $CLI from-paths 2>"$TMP/err")
assert_contains "$out" "<urn:g1>" "from-paths: trig preserves first named graph"
assert_contains "$out" "<urn:g2>" "from-paths: trig preserves second named graph"
assert_not_contains "$out" "two-graphs.trig>" "from-paths: trig does not invent file graph"
assert_empty "$(cat "$TMP/err")" "from-paths: no stderr for valid trig"

out=$(printf '%s\n%s\n' "$DATA/alice-knows-bob.rdf" "$DATA/with-errors/wrong-turtle.ttl" \
  | $CLI from-paths 2>"$TMP/err" || true)
assert_contains "$(cat "$TMP/err")" "wrong-turtle.ttl" "from-paths: parse error goes to stderr"
assert_contains "$out" "Alice" "from-paths: valid file still emits data"

printf '\nfrom-stdin\n'

out=$(cat "$DATA/bob-likes-alice.ttl" | $CLI from-stdin --format turtle)
assert_lines "$out" 3 "from-stdin: turtle emits 3 statements"
assert_not_contains "$out" "file://" "from-stdin: stdin stays graphless"

out=$(printf '<http://example.org/s> <http://example.org/p> <http://example.org/o> .\n' | $CLI from-stdin)
assert_contains "$out" "example.org/s" "from-stdin: autodetects n-triples"

printf '\nselect + table\n'

out=$(printf '%s\n%s\n' "$DATA/alice-knows-bob.rdf" "$DATA/bob-likes-alice.ttl" \
  | $CLI from-paths \
  | $CLI select 'PREFIX foaf: <http://xmlns.com/foaf/0.1/> SELECT ?name WHERE { ?s foaf:name ?name }' \
  | $CLI table)
assert_contains "$out" "name" "table csv: header row present"
assert_contains "$out" "Alice" "table csv: Alice present"
assert_contains "$out" "Bob" "table csv: Bob present"
assert_lines "$out" 3 "table csv: header plus 2 results"

out=$(printf '%s\n' "$DATA/bob-likes-alice.ttl" \
  | $CLI from-paths --graph-from path \
  | $CLI select 'PREFIX foaf: <http://xmlns.com/foaf/0.1/> SELECT ?g ?name WHERE { GRAPH ?g { ?s foaf:name ?name } }' \
  | $CLI table --format tsv)
assert_contains "$out" "file://$DATA/bob-likes-alice.ttl" "table tsv: graph binding present"
assert_contains "$out" "Bob" "table tsv: Bob present"

out=$(printf '%s\n' "$DATA/bob-likes-alice.ttl" \
  | $CLI from-paths \
  | $CLI select 'PREFIX foaf: <http://xmlns.com/foaf/0.1/> SELECT ?name WHERE { ?s foaf:name ?name }' \
  | $CLI table --format jsonl)
assert_contains "$out" '"name":"Bob"' "table jsonl: Bob present"

printf '\nconstruct\n'

out=$(printf '%s\n%s\n' "$DATA/alice-knows-bob.rdf" "$DATA/bob-likes-alice.ttl" \
  | $CLI from-paths \
  | $CLI construct 'PREFIX foaf: <http://xmlns.com/foaf/0.1/> CONSTRUCT { ?s foaf:name ?name } WHERE { ?s foaf:name ?name }')
assert_contains "$out" "Alice" "construct: Alice emitted"
assert_not_contains "$out" "file://" "construct: output remains graphless"

out=$(printf '%s\n%s\n' "$DATA/alice-knows-bob.rdf" "$DATA/bob-likes-alice.ttl" \
  | $CLI from-paths \
  | $CLI construct 'PREFIX foaf: <http://xmlns.com/foaf/0.1/> CONSTRUCT { ?s foaf:name ?name } WHERE { ?s foaf:name ?name }' \
  | $CLI pretty)
assert_contains "$out" "Alice" "construct | pretty: turtle renders graphless construct output"

printf '\nvalidate\n'

out=$(printf '%s\n' "$ROOT/tests/fixtures/person-valid.ttl" \
  | $CLI from-paths \
  | $CLI validate --shapes "$ROOT/tests/fixtures/person-shape.ttl")
assert_contains "$out" "<urn:validation-report>" "validate custom: default report graph present"
assert_contains "$out" "example.org/alice" "validate custom: input data preserved"

if printf '%s\n' "$ROOT/tests/fixtures/person-invalid.ttl" \
  | $CLI from-paths \
  | $CLI validate --shapes "$ROOT/tests/fixtures/person-shape.ttl" \
  >"$TMP/person-invalid.nq"; then
  fail "validate custom: expected invalid data to fail"
else
  ok "validate custom: invalid data exits non-zero"
fi
assert_contains "$(cat "$TMP/person-invalid.nq")" "<urn:validation-report>" "validate custom: invalid report still emitted"

out=$(printf '%s\n' "$ROOT/tests/fixtures/person-shape.ttl" \
  | $CLI from-paths \
  | $CLI validate --builtin shacl --report-graph urn:report:meta)
assert_contains "$out" "<urn:report:meta>" "validate builtin shacl: custom report graph present"

out=$(printf '%s\n' "$ROOT/tests/fixtures/skos-valid.ttl" \
  | $CLI from-paths \
  | $CLI validate --builtin skos)
assert_contains "$out" "<urn:validation-report>" "validate builtin skos: default report graph present"

if printf '%s\n' "$ROOT/tests/fixtures/skos-invalid.ttl" \
  | $CLI from-paths \
  | $CLI validate --builtin skos --markdown-report \
  >"$TMP/skos-invalid.nq" 2>"$TMP/skos-invalid.err"; then
  fail "validate builtin skos: expected invalid data to fail"
else
  ok "validate builtin skos: invalid data exits non-zero"
fi
assert_contains "$(cat "$TMP/skos-invalid.nq")" "<urn:validation-report>" "validate builtin skos: invalid report still emitted"
assert_contains "$(cat "$TMP/skos-invalid.err")" "SHACL Validation (SKOS)" "validate builtin skos: markdown report on stderr"

printf '\ngraph policy\n'

out=$(printf '%s\n' "$DATA/bob-likes-alice.ttl" \
  | $CLI from-paths \
  | $CLI graph-assign urn:batch \
  | $CLI pretty --format trig)
assert_contains "$out" "<urn:batch>" "graph-assign: named graph added"
assert_contains "$out" "Bob" "graph-assign: data preserved"

out=$(printf '%s\n' "$DATA/bob-likes-alice.ttl" \
  | $CLI from-paths --graph-from path \
  | $CLI graph-drop \
  | $CLI pretty)
assert_contains "$out" "Bob" "graph-drop | pretty: turtle renders after dropping graphs"
assert_not_contains "$out" "file://" "graph-drop: file graph removed"

if printf '%s\n' "$DATA/bob-likes-alice.ttl" \
  | $CLI from-paths --graph-from path \
  | $CLI pretty 2>"$TMP/err"; then
  fail "pretty turtle: expected failure on named graphs"
else
  ok "pretty turtle: fails on named graphs"
fi
assert_contains "$(cat "$TMP/err")" "graph-drop first" "pretty turtle: stderr explains graph policy"

printf '\nserialize\n'

out=$(printf '%s\n' "$DATA/bob-likes-alice.ttl" | $CLI from-paths | $CLI serialize)
assert_lines "$out" 3 "serialize nquads: 3 graphless statements"
assert_not_contains "$out" "file://" "serialize nquads: graphless remains graphless"

out=$(printf '%s\n' "$DATA/bob-likes-alice.ttl" \
  | $CLI from-paths \
  | $CLI graph-assign urn:batch \
  | $CLI serialize)
assert_contains "$out" "<urn:batch>" "serialize nquads: named graph preserved"

out=$(printf '%s\n' "$DATA/bob-likes-alice.ttl" \
  | $CLI from-paths \
  | $CLI graph-assign urn:batch \
  | $CLI serialize --format ntriples)
assert_not_contains "$out" "urn:batch" "serialize ntriples: graph dropped by format"
assert_lines "$out" 3 "serialize ntriples: 3 triples"

printf '\npretty\n'

out=$(printf '%s\n' "$DATA/bob-likes-alice.ttl" | $CLI from-paths | $CLI pretty)
assert_contains "$out" "Bob" "pretty turtle: graphless turtle works"
assert_not_contains "$out" "file://" "pretty turtle: no named graphs"

out=$(printf '%s\n' "$DATA/bob-likes-alice.ttl" \
  | $CLI from-paths \
  | $CLI graph-assign urn:batch \
  | $CLI pretty --format trig)
assert_contains "$out" "<urn:batch>" "pretty trig: named graph shown"
assert_contains "$out" "Bob" "pretty trig: data preserved"

printf '\nprefixes autodiscovery\n'

cat >"$TMP/.prefixes.json" <<'EOF'
{"ex":"http://example.org/","foaf":"http://xmlns.com/foaf/0.1/"}
EOF
out=$(cd "$TMP" && printf '%s\n' "$DATA/bob-likes-alice.ttl" | $CLI from-paths | $CLI pretty)
assert_contains "$out" "@prefix ex:" "prefix ex: applied"
assert_contains "$out" "@prefix foaf:" "prefix foaf: applied"

printf '\n'
if [[ "$fail" -eq 0 ]]; then
  printf 'all %d tests passed\n' "$pass"
else
  printf '%d passed, %d failed\n' "$pass" "$fail" >&2
  exit 1
fi
