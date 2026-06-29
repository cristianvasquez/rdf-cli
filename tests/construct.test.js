import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import test from 'node:test'
import rdf from 'rdf-ext'
import { createConstructStream } from '../src/transforms/sparql.js'

const ex = (s) => rdf.namedNode(`http://example.org/${s}`)

function quadsStream (...quads) {
  return Readable.from(quads, { objectMode: true })
}

async function collect (stream) {
  const results = []
  for await (const q of stream) results.push(q)
  return results
}

test('createConstructStream returns matching triples in default graph', async () => {
  const input = quadsStream(
    rdf.quad(ex('Alice'), ex('knows'), ex('Bob')),
    rdf.quad(ex('Bob'), ex('knows'), ex('Carol')),
  )

  const stream = await createConstructStream(
    input,
    'CONSTRUCT { ?s <http://example.org/knows> ?o } WHERE { ?s <http://example.org/knows> ?o }',
  )

  const quads = await collect(stream)
  assert.equal(quads.length, 2)
  assert.ok(quads.every((q) => q.graph.termType === 'DefaultGraph'))
  assert.ok(quads.some((q) => q.subject.value === 'http://example.org/Alice'))
  assert.ok(quads.some((q) => q.subject.value === 'http://example.org/Bob'))
})

test('createConstructStream returns empty stream when query matches nothing', async () => {
  const input = quadsStream(
    rdf.quad(ex('Alice'), ex('knows'), ex('Bob')),
  )

  const stream = await createConstructStream(
    input,
    'CONSTRUCT { ?s <http://example.org/likes> ?o } WHERE { ?s <http://example.org/likes> ?o }',
  )

  const quads = await collect(stream)
  assert.equal(quads.length, 0)
})

test('createConstructStream accepts async iterable as source', async () => {
  async function * quads () {
    yield rdf.quad(ex('X'), ex('p'), ex('Y'))
  }

  const stream = await createConstructStream(
    quads(),
    'CONSTRUCT { ?s <http://example.org/p> ?o } WHERE { ?s <http://example.org/p> ?o }',
  )

  const results = await collect(stream)
  assert.equal(results.length, 1)
  assert.equal(results[0].subject.value, 'http://example.org/X')
})
