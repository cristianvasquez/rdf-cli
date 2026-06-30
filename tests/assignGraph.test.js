import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import test from 'node:test'
import rdf from 'rdf-ext'
import { assignGraph } from '../src/transforms/assignGraph.js'

async function collect (stream) {
  const quads = []
  for await (const quad of stream) quads.push(quad)
  return quads
}

const s = rdf.namedNode('http://example.org/s')
const p = rdf.namedNode('http://example.org/p')
const o = rdf.namedNode('http://example.org/o')
const g = rdf.namedNode('urn:graph')

test('assignGraph moves default-graph quads to target graph', async () => {
  const input = [
    rdf.quad(s, p, o),
    rdf.quad(s, p, o, g),
  ]
  const quads = await collect(Readable.from(input, { objectMode: true }).pipe(assignGraph('urn:target')))

  assert.equal(quads.length, 2)
  assert.equal(quads[0].graph.value, 'urn:target')
  assert.equal(quads[1].graph.value, g.value)
})
