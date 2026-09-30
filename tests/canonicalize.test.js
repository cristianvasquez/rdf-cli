import assert from 'node:assert/strict'
import test from 'node:test'
import rdf from 'rdf-ext'
import { canonicalize } from '../src/transforms/canonicalize.js'
import { ask, materialize } from '../src/transforms/sparql.js'

const p = rdf.namedNode('http://example.org/p')

async function nquads (quads) {
  const out = []
  for await (const quad of await canonicalize(quads)) out.push(`${quad.subject.value} ${quad.object.value}`)
  return out
}

test('canonicalize gives equal output for isomorphic inputs', async () => {
  const a = await nquads([rdf.quad(rdf.blankNode('x'), p, rdf.blankNode('y')), rdf.quad(rdf.blankNode('y'), p, rdf.literal('v'))])
  const b = await nquads([rdf.quad(rdf.blankNode('q'), p, rdf.literal('v')), rdf.quad(rdf.blankNode('z'), p, rdf.blankNode('q'))])
  assert.deepEqual(a, b)
  assert.ok(a.every((line) => line.startsWith('c14n')))
})

test('ask returns a boolean and rejects other query forms', async () => {
  const store = await materialize([rdf.quad(rdf.namedNode('http://example.org/s'), p, rdf.literal('v'))])
  assert.equal(ask(store, 'ASK { ?s ?p ?o }'), true)
  assert.equal(ask(store, 'ASK { ?s <urn:none> ?o }'), false)
  assert.throws(() => ask(store, 'SELECT * { ?s ?p ?o }'), /not an ASK query/)
})
