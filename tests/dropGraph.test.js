import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import test from 'node:test'
import rdf from 'rdf-ext'
import { dropGraph } from '../src/transforms/dropGraph.js'

async function collect (stream) {
  const quads = []
  for await (const quad of stream) quads.push(quad)
  return quads
}

const s = rdf.namedNode('http://example.org/s')
const p = rdf.namedNode('http://example.org/p')
const o = rdf.namedNode('http://example.org/o')

test('dropGraph moves all named-graph quads to default graph', async () => {
  const g = rdf.namedNode('urn:graph')
  const g2 = rdf.namedNode('urn:other')
  const input = [
    rdf.quad(s, p, o, g),
    rdf.quad(s, p, o, g2),
    rdf.quad(s, p, o),
  ]
  const quads = await collect(Readable.from(input, { objectMode: true }).pipe(dropGraph()))

  assert.equal(quads.length, 3)
  assert.ok(quads.every((q) => q.graph.termType === 'DefaultGraph'))
})
