import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Readable } from 'node:stream'
import test from 'node:test'
import rdf from 'rdf-ext'
import { Validator } from 'shacl-engine'
import { validate } from '../src/transforms/shacl.js'
import { materialize } from '../src/transforms/sparql.js'
import { streamFileQuads } from '../src/sources/paths.js'

const fixturesDir = fileURLToPath(new URL('./fixtures', import.meta.url))
const shapesFile = `${fixturesDir}/person-shape.ttl`

async function collect (stream) {
  const quads = []
  for await (const q of stream) quads.push(q)
  return quads
}

async function storeFixture (name) {
  const path = `${fixturesDir}/${name}`
  return materialize(Readable.from(streamFileQuads(path), { objectMode: true }))
}

test('validate summary.conforms=true for valid data', async () => {
  const store = await storeFixture('person-valid.ttl')
  const { summary } = await validate(store, [shapesFile])
  assert.equal(summary.conforms, true)
})

test('validate summary.conforms=false for invalid data', async () => {
  const store = await storeFixture('person-invalid.ttl')
  const { summary } = await validate(store, [shapesFile])
  assert.equal(summary.conforms, false)
  assert.ok(summary.violationCount > 0)
})

test('validate stream emits data quads plus report in named graph', async () => {
  const store = await storeFixture('person-valid.ttl')
  const reportGraph = 'urn:test-report'
  const { stream } = await validate(store, [shapesFile], { reportGraph })

  const quads = await collect(stream)
  assert.ok(quads.length > 0)

  const reportQuads = quads.filter((q) => q.graph.value === reportGraph)
  assert.ok(reportQuads.length > 0, 'report quads should be present in named graph')

  const dataQuads = quads.filter((q) => q.graph.termType === 'DefaultGraph')
  assert.ok(dataQuads.length > 0, 'data quads should be present in default graph')
})

test('validate summary carries conforms and violations', async () => {
  const store = await storeFixture('person-valid.ttl')
  const { summary } = await validate(store, [shapesFile])
  assert.ok('conforms' in summary)
  assert.ok(Array.isArray(summary.violations))
})

// Regression tests for upstream fixes released in shacl-engine 1.1.3 (rdf-ext/shacl-engine PR #90).
// Each case is shapes and data in one file, expected results from the PR's test manifest.

async function violationsOf (name) {
  const store = await storeFixture(name)
  const { summary } = await validate(store, [`${fixturesDir}/${name}`])
  return summary
}

test('validate: sh:not with several values checks each of them', async () => {
  const summary = await violationsOf('shacl-not-multi.ttl')
  assert.equal(summary.conforms, false)
  assert.deepEqual(
    summary.violations.map((v) => [v.focusNode, v.sourceConstraint]),
    [['http://example.org/InvalidPoint1', 'http://www.w3.org/ns/shacl#NotConstraintComponent']],
  )
})

test('validate: sh:qualifiedValueShape in a shape reached via sh:node', async () => {
  const summary = await violationsOf('shacl-qualified-node.ttl')
  assert.equal(summary.conforms, false)
  assert.deepEqual(
    summary.violations.map((v) => [v.focusNode, v.sourceConstraint]),
    [['http://example.org/citizen-b', 'http://www.w3.org/ns/shacl#NodeConstraintComponent']],
  )
})

// Catenary patch regressions: structural paths and repeated constraint parameters.
const sh = (name) => rdf.namedNode(`http://www.w3.org/ns/shacl#${name}`)
const iri = (name) => rdf.namedNode(`urn:${name}`)

test('patched engine: skolemized inverse path is evaluated as a path', async () => {
  const shapes = rdf.dataset([
    rdf.quad(iri('shape'), sh('targetNode'), iri('x')),
    rdf.quad(iri('shape'), sh('property'), iri('property')),
    rdf.quad(iri('property'), sh('path'), iri('path')),
    rdf.quad(iri('path'), sh('inversePath'), iri('p')),
    rdf.quad(iri('property'), sh('minCount'), rdf.literal('1', rdf.namedNode('http://www.w3.org/2001/XMLSchema#integer'))),
  ])
  const validator = new Validator(shapes, { factory: rdf })
  const valid = rdf.dataset([rdf.quad(iri('y'), iri('p'), iri('x'))])
  assert.equal((await validator.validate({ dataset: valid })).conforms, true)
  const invalid = rdf.dataset([rdf.quad(iri('x'), iri('unrelated'), iri('y'))])
  assert.equal((await new Validator(shapes, { factory: rdf }).validate({ dataset: invalid })).conforms, false)
})

for (const constraint of ['hasValue', 'disjoint', 'equals', 'lessThan', 'lessThanOrEquals']) {
  test(`patched engine: sh:${constraint} checks the second parameter`, async () => {
    const isHasValue = constraint === 'hasValue'
    const shapes = rdf.dataset([
      rdf.quad(iri('shape'), sh('targetNode'), iri('x')),
      rdf.quad(iri('shape'), sh('property'), iri('property')),
      rdf.quad(iri('property'), sh('path'), iri('p')),
      rdf.quad(iri('property'), sh(constraint), isHasValue ? rdf.literal('1') : iri('first')),
      rdf.quad(iri('property'), sh(constraint), isHasValue ? rdf.literal('2') : iri('second')),
    ])
    const data = rdf.dataset([rdf.quad(iri('x'), iri('p'), rdf.literal('1'))])
    if (!isHasValue) {
      data.add(rdf.quad(iri('x'), iri('first'), rdf.literal(constraint === 'equals' ? '1' : '2')))
      data.add(rdf.quad(iri('x'), iri('second'), rdf.literal(constraint === 'disjoint' ? '1' : '0')))
    }
    const report = await new Validator(shapes, { factory: rdf }).validate({ dataset: data })
    assert.equal(report.conforms, false)
    assert.equal(report.results.length, constraint === 'equals' ? 2 : 1)
  })
}

test('validate: blank nodes of two shapes files stay apart', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'rdf-cli-shapes-'))
  const shapes = (name, path) => {
    const file = join(dir, `${name}.ttl`)
    writeFileSync(file, `@prefix sh: <http://www.w3.org/ns/shacl#> .
<urn:${name}> a sh:NodeShape ; sh:targetNode <urn:x> ; sh:property [ sh:path <${path}> ; sh:minCount 1 ] .
`)
    return file
  }
  const data = [rdf.quad(rdf.namedNode('urn:x'), rdf.namedNode('urn:a'), rdf.literal('1'))]
  const store = await materialize(Readable.from(data, { objectMode: true }))

  // Each file has one property shape: urn:a is present, urn:b is missing.
  const { summary } = await validate(store, [shapes('one', 'urn:a'), shapes('two', 'urn:b')])
  assert.equal(summary.conforms, false)
  assert.equal(summary.violationCount, 1)
})
