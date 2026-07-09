import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import test from 'node:test'
import rdf from 'rdf-ext'
import { construct, materialize, select } from '../src/transforms/sparql.js'

const ex = (s) => rdf.namedNode(`http://example.org/${s}`)

function quadsStream (...quads) {
  return Readable.from(quads, { objectMode: true })
}

const runConstruct = async (source, query) => construct(await materialize(source), query)
const runSelect = async (source, query) => select(await materialize(source), query)

async function collect (iterable) {
  const results = []
  for await (const item of iterable) results.push(item)
  return results
}

// --- construct ---

test('construct returns matching triples in default graph', async () => {
  const input = quadsStream(
    rdf.quad(ex('Alice'), ex('knows'), ex('Bob')),
    rdf.quad(ex('Bob'), ex('knows'), ex('Carol')),
  )

  const stream = await runConstruct(
    input,
    'CONSTRUCT { ?s <http://example.org/knows> ?o } WHERE { ?s <http://example.org/knows> ?o }',
  )

  const quads = await collect(stream)
  assert.equal(quads.length, 2)
  assert.ok(quads.every((q) => q.graph.termType === 'DefaultGraph'))
  assert.ok(quads.some((q) => q.subject.value === 'http://example.org/Alice'))
  assert.ok(quads.some((q) => q.subject.value === 'http://example.org/Bob'))
})

test('construct returns empty stream when query matches nothing', async () => {
  const input = quadsStream(
    rdf.quad(ex('Alice'), ex('knows'), ex('Bob')),
  )

  const stream = await runConstruct(
    input,
    'CONSTRUCT { ?s <http://example.org/likes> ?o } WHERE { ?s <http://example.org/likes> ?o }',
  )

  const quads = await collect(stream)
  assert.equal(quads.length, 0)
})

test('construct accepts async iterable as source', async () => {
  async function * quads () {
    yield rdf.quad(ex('X'), ex('p'), ex('Y'))
  }

  const stream = await runConstruct(
    quads(),
    'CONSTRUCT { ?s <http://example.org/p> ?o } WHERE { ?s <http://example.org/p> ?o }',
  )

  const results = await collect(stream)
  assert.equal(results.length, 1)
  assert.equal(results[0].subject.value, 'http://example.org/X')
})

// --- select ---

test('select returns bindings as plain objects', async () => {
  const input = quadsStream(
    rdf.quad(ex('Alice'), ex('knows'), ex('Bob')),
    rdf.quad(ex('Carol'), ex('knows'), ex('Dave')),
  )

  const bindings = await runSelect(
    input,
    'SELECT ?s ?o WHERE { ?s <http://example.org/knows> ?o }',
  )

  const rows = await collect(bindings)
  assert.equal(rows.length, 2)
  assert.ok(rows.every((r) => 's' in r && 'o' in r))
  assert.ok(rows.some((r) => r.s.value === 'http://example.org/Alice'))
})

test('select returns empty iterable when query matches nothing', async () => {
  const input = quadsStream(
    rdf.quad(ex('Alice'), ex('knows'), ex('Bob')),
  )

  const bindings = await runSelect(
    input,
    'SELECT ?s WHERE { ?s <http://example.org/likes> ?o }',
  )

  const rows = await collect(bindings)
  assert.equal(rows.length, 0)
})

test('select binding values are rdf-ext term instances', async () => {
  const input = quadsStream(
    rdf.quad(ex('Alice'), ex('name'), rdf.literal('Alice')),
  )

  const bindings = await runSelect(
    input,
    'SELECT ?name WHERE { <http://example.org/Alice> <http://example.org/name> ?name }',
  )

  const rows = await collect(bindings)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].name.termType, 'Literal')
  assert.equal(rows[0].name.value, 'Alice')
})
