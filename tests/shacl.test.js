import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { Readable } from 'node:stream'
import test from 'node:test'
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

test('validate conforms=true for valid data', async () => {
  const store = await storeFixture('person-valid.ttl')
  const { conforms } = await validate(store, [shapesFile])
  assert.equal(conforms, true)
})

test('validate conforms=false for invalid data', async () => {
  const store = await storeFixture('person-invalid.ttl')
  const { conforms } = await validate(store, [shapesFile])
  assert.equal(conforms, false)
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

test('validate report object is accessible', async () => {
  const store = await storeFixture('person-valid.ttl')
  const { report } = await validate(store, [shapesFile])
  assert.ok(report !== undefined)
  assert.ok('conforms' in report)
})
