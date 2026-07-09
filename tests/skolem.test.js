import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import test from 'node:test'
import rdf from 'rdf-ext'
import { skolemize } from '../src/transforms/skolem.js'

async function collect (stream) {
  const quads = []
  for await (const quad of stream) quads.push(quad)
  return quads
}

test('skolemize rewrites blank nodes and preserves non-blank terms', async () => {
  const s = rdf.blankNode('s')
  const p = rdf.namedNode('http://example.org/p')
  const o = rdf.blankNode('o')
  const g = rdf.namedNode('urn:graph')
  const input = [rdf.quad(s, p, o, g)]

  const [quad] = await collect(
    Readable.from(input, { objectMode: true }).pipe(skolemize('https://example.org/genid/')),
  )

  assert.equal(quad.subject.termType, 'NamedNode')
  assert.equal(quad.predicate.value, p.value)
  assert.equal(quad.object.termType, 'NamedNode')
  assert.equal(quad.graph.value, g.value)
  assert.match(quad.subject.value, /^https:\/\/example\.org\/genid\//)
})

test('skolemize maps the same blank node to the same IRI within a run', async () => {
  const shared = rdf.blankNode('shared')
  const other = rdf.blankNode('other')
  const input = [rdf.quad(shared, rdf.namedNode('http://example.org/p'), shared, other)]

  const [quad] = await collect(
    Readable.from(input, { objectMode: true }).pipe(skolemize('https://example.org/genid/')),
  )

  assert.equal(quad.subject.value, quad.object.value)
  assert.notEqual(quad.subject.value, quad.graph.value)
})

test('skolemize appends a trailing slash to a base without one', async () => {
  const input = [rdf.quad(rdf.blankNode('b'), rdf.namedNode('http://example.org/p'), rdf.literal('x'))]

  const [quad] = await collect(
    Readable.from(input, { objectMode: true }).pipe(skolemize('https://example.org/genid')),
  )

  assert.match(quad.subject.value, /^https:\/\/example\.org\/genid\//)
})
