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

printf '\nread\n'

out=$($CLI read "$DATA/alice-knows-bob.rdf" "$DATA/bob-likes-alice.ttl" 2>"$TMP/err")
assert_lines "$out" 7 "read: 7 statements from two files"
assert_not_contains "$out" "file://" "read: preserves graphless statements by default"
assert_empty "$(cat "$TMP/err")" "read: no stderr for valid files"

out=$($CLI read "$DATA/*.ttl" 2>"$TMP/err")
assert_contains "$out" "Bob" "read glob: ttl files matched and parsed"
assert_empty "$(cat "$TMP/err")" "read glob: no stderr"

out=$($CLI read --graph-from path "$DATA/bob-likes-alice.ttl" 2>"$TMP/err")
assert_contains "$out" "<file://$DATA/bob-likes-alice.ttl>" "read: --graph-from path assigns file graph"
assert_empty "$(cat "$TMP/err")" "read: graph-from path has no stderr"

out=$($CLI read "$DATA/two-graphs.trig" 2>"$TMP/err")
assert_contains "$out" "<urn:g1>" "read: trig preserves first named graph"
assert_contains "$out" "<urn:g2>" "read: trig preserves second named graph"
assert_not_contains "$out" "two-graphs.trig>" "read: trig does not invent file graph"
assert_empty "$(cat "$TMP/err")" "read: no stderr for valid trig"

out=$($CLI read "$DATA/alice-knows-bob.rdf" "$DATA/with-errors/wrong-turtle.ttl" 2>"$TMP/err" || true)
assert_contains "$(cat "$TMP/err")" "wrong-turtle.ttl" "read: parse error goes to stderr"
assert_contains "$out" "Alice" "read: valid file still emits data"

out=$(cat "$DATA/bob-likes-alice.ttl" | $CLI read)
assert_lines "$out" 3 "read stdin: turtle emits 3 statements"
assert_not_contains "$out" "file://" "read stdin: stdin stays graphless"

out=$(printf '<http://example.org/s> <http://example.org/p> <http://example.org/o> .\n' | $CLI read)
assert_contains "$out" "example.org/s" "read stdin: autodetects n-triples"

printf '\nfrom-paths\n'

out=$(printf '%s\n%s\n' "$DATA/alice-knows-bob.rdf" "$DATA/bob-likes-alice.ttl" | $CLI from-paths 2>"$TMP/err")
assert_lines "$out" 7 "from-paths: 7 statements from two files"
assert_empty "$(cat "$TMP/err")" "from-paths: no stderr for valid files"

out=$(printf '%s\n' "$DATA/bob-likes-alice.ttl" | $CLI from-paths --graph-from path)
assert_contains "$out" "<file://$DATA/bob-likes-alice.ttl>" "from-paths: --graph-from path assigns file graph"

printf '\nselect + table\n'

out=$($CLI read "$DATA/alice-knows-bob.rdf" "$DATA/bob-likes-alice.ttl" \
  | $CLI select 'PREFIX foaf: <http://xmlns.com/foaf/0.1/> SELECT ?name WHERE { ?s foaf:name ?name }' \
  | $CLI table)
assert_contains "$out" "name" "table csv: header row present"
assert_contains "$out" "Alice" "table csv: Alice present"
assert_contains "$out" "Bob" "table csv: Bob present"
assert_lines "$out" 3 "table csv: header plus 2 results"

out=$($CLI read --graph-from path "$DATA/bob-likes-alice.ttl" \
  | $CLI select 'PREFIX foaf: <http://xmlns.com/foaf/0.1/> SELECT ?g ?name WHERE { GRAPH ?g { ?s foaf:name ?name } }' \
  | $CLI table --format tsv)
assert_contains "$out" "file://$DATA/bob-likes-alice.ttl" "table tsv: graph binding present"
assert_contains "$out" "Bob" "table tsv: Bob present"

out=$($CLI read "$DATA/bob-likes-alice.ttl" \
  | $CLI select 'PREFIX foaf: <http://xmlns.com/foaf/0.1/> SELECT ?name WHERE { ?s foaf:name ?name }' \
  | $CLI table --format jsonl)
assert_contains "$out" '"name":"Bob"' "table jsonl: Bob present"

printf '\nconstruct\n'

out=$($CLI read "$DATA/alice-knows-bob.rdf" "$DATA/bob-likes-alice.ttl" \
  | $CLI construct 'PREFIX foaf: <http://xmlns.com/foaf/0.1/> CONSTRUCT { ?s foaf:name ?name } WHERE { ?s foaf:name ?name }')
assert_contains "$out" "Alice" "construct: Alice emitted"
assert_not_contains "$out" "file://" "construct: output remains graphless"

out=$($CLI read "$DATA/alice-knows-bob.rdf" "$DATA/bob-likes-alice.ttl" \
  | $CLI construct 'PREFIX foaf: <http://xmlns.com/foaf/0.1/> CONSTRUCT { ?s foaf:name ?name } WHERE { ?s foaf:name ?name }' \
  | $CLI pretty)
assert_contains "$out" "Alice" "construct | pretty: renders graphless construct output"

printf '\nvalidate\n'

out=$($CLI read "$ROOT/tests/fixtures/person-valid.ttl" \
  | $CLI validate --shapes "$ROOT/tests/fixtures/person-shape.ttl")
assert_contains "$out" "<urn:validation-report>" "validate custom: default report graph present"
assert_contains "$out" "example.org/alice" "validate custom: input data preserved"

if $CLI read "$ROOT/tests/fixtures/person-invalid.ttl" \
  | $CLI validate --shapes "$ROOT/tests/fixtures/person-shape.ttl" \
  >"$TMP/person-invalid.nq"; then
  fail "validate custom: expected invalid data to fail"
else
  ok "validate custom: invalid data exits non-zero"
fi
assert_contains "$(cat "$TMP/person-invalid.nq")" "<urn:validation-report>" "validate custom: invalid report still emitted"

out=$($CLI read "$ROOT/tests/fixtures/person-shape.ttl" \
  | $CLI validate --builtin shacl --report-graph urn:report:meta)
assert_contains "$out" "<urn:report:meta>" "validate builtin shacl: custom report graph present"

out=$($CLI read "$ROOT/tests/fixtures/skos-valid.ttl" \
  | $CLI validate --builtin skos)
assert_contains "$out" "<urn:validation-report>" "validate builtin skos: default report graph present"

if $CLI read "$ROOT/tests/fixtures/skos-invalid.ttl" \
  | $CLI validate --builtin skos --markdown-report \
  >"$TMP/skos-invalid.nq" 2>"$TMP/skos-invalid.err"; then
  fail "validate builtin skos: expected invalid data to fail"
else
  ok "validate builtin skos: invalid data exits non-zero"
fi
assert_contains "$(cat "$TMP/skos-invalid.nq")" "<urn:validation-report>" "validate builtin skos: invalid report still emitted"
assert_contains "$(cat "$TMP/skos-invalid.err")" "SHACL Validation (SKOS)" "validate builtin skos: markdown report on stderr"

printf '\nclaim\n'

out=$($CLI read "$ROOT/tests/fixtures/person-valid.ttl" \
  | $CLI claim "$ROOT/tests/fixtures/person-claimer.trig")
assert_contains "$out" "<urn:claimers:person:source>" "claim: owned quads land in the source graph"
assert_contains "$out" "<urn:claimers:person:frontier>" "claim: borrowed navigation quads copied to the frontier graph"
assert_lines "$(printf '%s\n' "$out" | grep 'syntax-ns#type')" 2 "claim: borrowed type quad appears twice (frontier copy + graphless original)"
assert_contains "$out" "<urn:views:person-card>" "claim: view quads land in the view graph"
assert_contains "$out" "label" "claim: view derived the label"
assert_contains "$out" '"30"' "claim: unclaimed age quad passes through"

out=$($CLI read "$ROOT/tests/fixtures/person-valid.ttl" \
  | $CLI claim "$ROOT/tests/fixtures/person-claimer.trig" \
  | $CLI claim "$ROOT/tests/fixtures/person-claimer.trig")
assert_contains "$out" "<urn:claimers:person:source>" "claim twice: first claim survives the second"
assert_lines "$(printf '%s\n' "$out" | grep 'person:source')" 1 "claim twice: second pass owns nothing new (claims pass through)"

if printf '' | $CLI claim "$ROOT/tests/fixtures/person-valid.ttl" 2>"$TMP/claim.err"; then
  fail "claim: expected a document without a claimer graph to fail"
else
  ok "claim: rejects a document that defines no claimer"
fi
assert_contains "$(cat "$TMP/claim.err")" "exactly one claimer" "claim: error names the contract"

printf '\ngraph policy\n'

out=$($CLI read "$DATA/bob-likes-alice.ttl" \
  | $CLI graph-assign urn:batch \
  | $CLI pretty --format trig)
assert_contains "$out" "<urn:batch>" "graph-assign: named graph added"
assert_contains "$out" "Bob" "graph-assign: data preserved"

out=$($CLI read --graph-from path "$DATA/bob-likes-alice.ttl" \
  | $CLI graph-drop \
  | $CLI pretty)
assert_contains "$out" "Bob" "graph-drop | pretty: renders after dropping graphs"
assert_not_contains "$out" "file://" "graph-drop: file graph removed"

out=$(printf '_:a <http://example.org/p> _:b .\n_:a <http://example.org/q> <http://example.org/o> .\n' \
  | $CLI skolem --base-iri https://example.org/.well-known/genid \
  | $CLI pretty --format nquads)
assert_contains "$out" "https://example.org/.well-known/genid/" "skolem: generated IRIs use requested base"
assert_not_contains "$out" "_:" "skolem: blank nodes replaced"

out=$($CLI read --graph-from path "$DATA/bob-likes-alice.ttl" \
  | $CLI pretty)
assert_contains "$out" "file://" "pretty default: named graph shown as TriG"
assert_contains "$out" "Bob" "pretty default: data preserved"

out=$($CLI read --graph-from path "$DATA/bob-likes-alice.ttl" \
  | $CLI pretty --format turtle)
assert_not_contains "$out" "file://" "pretty forced turtle: graph assignment dropped"
assert_contains "$out" "Bob" "pretty forced turtle: data preserved"

printf '\npretty\n'

out=$($CLI read "$DATA/bob-likes-alice.ttl" | $CLI pretty)
assert_contains "$out" "Bob" "pretty: graphless input renders as turtle"
assert_not_contains "$out" "file://" "pretty: no named graphs in output"

out=$($CLI read "$DATA/*.ttl" | $CLI pretty)
assert_contains "$out" "Bob" "read glob | pretty: glob expansion works end-to-end"

out=$($CLI read "$DATA/bob-likes-alice.ttl" \
  | $CLI graph-assign urn:batch \
  | $CLI pretty --format trig)
assert_contains "$out" "<urn:batch>" "pretty trig: named graph shown"
assert_contains "$out" "Bob" "pretty trig: data preserved"

out=$($CLI read "$DATA/bob-likes-alice.ttl" | $CLI pretty --format nquads)
assert_lines "$out" 3 "pretty nquads: 3 graphless statements"
assert_not_contains "$out" "file://" "pretty nquads: graphless remains graphless"

out=$($CLI read "$DATA/bob-likes-alice.ttl" \
  | $CLI graph-assign urn:batch \
  | $CLI pretty --format nquads)
assert_contains "$out" "<urn:batch>" "pretty nquads: named graph preserved"

out=$($CLI read "$DATA/bob-likes-alice.ttl" \
  | $CLI graph-assign urn:batch \
  | $CLI pretty --format ntriples)
assert_not_contains "$out" "urn:batch" "pretty ntriples: graph dropped by format"
assert_lines "$out" 3 "pretty ntriples: 3 triples"

printf '\nprefixes autodiscovery\n'

cat >"$TMP/.prefixes.json" <<'EOF'
{"ex":"http://example.org/","foaf":"http://xmlns.com/foaf/0.1/"}
EOF
out=$(cd "$TMP" && $CLI read "$DATA/bob-likes-alice.ttl" | $CLI pretty)
assert_contains "$out" "@prefix ex:" "prefix ex: applied"
assert_contains "$out" "@prefix foaf:" "prefix foaf: applied"

printf '\n'
if [[ "$fail" -eq 0 ]]; then
  printf 'all %d tests passed\n' "$pass"
else
  printf '%d passed, %d failed\n' "$pass" "$fail" >&2
  exit 1
fi
