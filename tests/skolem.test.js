import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import test from 'node:test'
import rdf from 'rdf-ext'
import {
  DEFAULT_SKOLEM_BASE_IRI,
  createSkolemizer,
  skolemize,
  skolemizeDataset,
} from '../src/transforms/skolem.js'

async function collect (stream) {
  const quads = []
  for await (const quad of stream) quads.push(quad)
  return quads
}

test('createSkolemizer maps the same blank node to the same named node', () => {
  const shared = rdf.blankNode('shared')
  const other = rdf.blankNode('other')
  const quad = rdf.quad(shared, shared, other, shared)
  const skolemizeQuad = createSkolemizer('https://example.org/.well-known/genid')
  const result = skolemizeQuad(quad)

  assert.equal(result.subject.termType, 'NamedNode')
  assert.equal(result.predicate.termType, 'NamedNode')
  assert.equal(result.object.termType, 'NamedNode')
  assert.equal(result.graph.termType, 'NamedNode')
  assert.equal(result.subject.value, result.predicate.value)
  assert.equal(result.subject.value, result.graph.value)
  assert.notEqual(result.subject.value, result.object.value)
  assert.match(result.subject.value, /^https:\/\/example\.org\/\.well-known\/genid\//)
})

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
})

test('skolemizeDataset returns a new dataset with generated IRIs', () => {
  const shared = rdf.blankNode('shared')
  const dataset = rdf.dataset([
    rdf.quad(shared, rdf.namedNode('http://example.org/p'), rdf.literal('x')),
    rdf.quad(rdf.namedNode('http://example.org/s'), rdf.namedNode('http://example.org/p2'), shared),
  ])

  const result = skolemizeDataset(dataset, { skolemBaseIri: DEFAULT_SKOLEM_BASE_IRI })
  const [first, second] = [...result]

  assert.notEqual(result, dataset)
  assert.equal(first.subject.termType, 'NamedNode')
  assert.equal(second.object.termType, 'NamedNode')
  assert.equal(first.subject.value, second.object.value)
})
