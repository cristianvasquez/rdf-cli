import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import test from 'node:test'
import rdf from 'rdf-ext'
import { assignGraph } from '../src/transforms/assignGraph.js'
import { dropGraph } from '../src/transforms/dropGraph.js'

async function collect (stream) {
  const quads = []
  for await (const quad of stream) quads.push(quad)
  return quads
}

const s = rdf.namedNode('http://example.org/s')
const p = rdf.namedNode('http://example.org/p')
const o = rdf.namedNode('http://example.org/o')
const g = rdf.namedNode('urn:graph')

test('assignGraph', async () => {
  const input = [
    rdf.quad(s, p, o),        // default-graph → should be moved
    rdf.quad(s, p, o, g),     // already named → should be left alone
  ]
  const quads = await collect(Readable.from(input, { objectMode: true }).pipe(assignGraph('urn:target')))

  assert.equal(quads.length, 2)
  assert.equal(quads[0].graph.value, 'urn:target')
  assert.equal(quads[1].graph.value, g.value)
})

test('dropGraph', async () => {
  const g2 = rdf.namedNode('urn:other')
  const input = [
    rdf.quad(s, p, o, g),     // named → should be dropped
    rdf.quad(s, p, o, g2),    // different named graph → should also be dropped
    rdf.quad(s, p, o),        // already default → should stay default
  ]
  const quads = await collect(Readable.from(input, { objectMode: true }).pipe(dropGraph()))

  assert.equal(quads.length, 3)
  assert.ok(quads.every((q) => q.graph.termType === 'DefaultGraph'))
})
