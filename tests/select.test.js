import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import test from 'node:test'
import rdf from 'rdf-ext'
import { createSelectStream } from '../src/sparql.js'

const ex = (s) => rdf.namedNode(`http://example.org/${s}`)

function quadsStream (...quads) {
  return Readable.from(quads, { objectMode: true })
}

async function collect (iterable) {
  const results = []
  for (const row of iterable) results.push(row)
  return results
}

test('createSelectStream returns bindings as plain objects', async () => {
  const input = quadsStream(
    rdf.quad(ex('Alice'), ex('knows'), ex('Bob')),
    rdf.quad(ex('Carol'), ex('knows'), ex('Dave')),
  )

  const bindings = await createSelectStream(
    input,
    'SELECT ?s ?o WHERE { ?s <http://example.org/knows> ?o }',
  )

  const rows = await collect(bindings)
  assert.equal(rows.length, 2)
  assert.ok(rows.every((r) => 's' in r && 'o' in r))
  assert.ok(rows.some((r) => r.s.value === 'http://example.org/Alice'))
})

test('createSelectStream returns empty iterable when query matches nothing', async () => {
  const input = quadsStream(
    rdf.quad(ex('Alice'), ex('knows'), ex('Bob')),
  )

  const bindings = await createSelectStream(
    input,
    'SELECT ?s WHERE { ?s <http://example.org/likes> ?o }',
  )

  const rows = await collect(bindings)
  assert.equal(rows.length, 0)
})

test('createSelectStream binding values are rdf-ext term instances', async () => {
  const input = quadsStream(
    rdf.quad(ex('Alice'), ex('name'), rdf.literal('Alice')),
  )

  const bindings = await createSelectStream(
    input,
    'SELECT ?name WHERE { <http://example.org/Alice> <http://example.org/name> ?name }',
  )

  const rows = await collect(bindings)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].name.termType, 'Literal')
  assert.equal(rows[0].name.value, 'Alice')
})
