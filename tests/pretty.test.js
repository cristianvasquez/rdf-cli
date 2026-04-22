import test from 'node:test'
import assert from 'node:assert/strict'
import rdf from 'rdf-ext'
import { datasetToString, TRIG, TURTLE } from '../src/outputs.js'

function namedNode(value) {
  return rdf.namedNode(value)
}

function literal(value) {
  return rdf.literal(value)
}

test('pretty trig groups quads from the same named graph', async () => {
  const dataset = rdf.dataset([
    rdf.quad(namedNode('http://example.org/Bob'), namedNode('http://xmlns.com/foaf/0.1/name'), literal('Bob'), namedNode('urn:batch')),
    rdf.quad(namedNode('http://example.org/Bob'), namedNode('http://example.org/likes'), namedNode('http://example.org/Alice'), namedNode('urn:batch')),
    rdf.quad(namedNode('http://example.org/Bob'), namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), namedNode('http://xmlns.com/foaf/0.1/Person'), namedNode('urn:batch')),
  ])

  const output = await datasetToString(dataset, { format: TRIG, prefixes: {} })

  assert.equal((output.match(/<urn:batch> \{/g) || []).length, 1)
  assert.match(output, /<http:\/\/example\.org\/Bob> <http:\/\/xmlns\.com\/foaf\/0\.1\/name> "Bob" ;/)
  assert.match(output, /<http:\/\/example\.org\/likes> <http:\/\/example\.org\/Alice> ;/)
  assert.match(output, /<http:\/\/www\.w3\.org\/1999\/02\/22-rdf-syntax-ns#type> <http:\/\/xmlns\.com\/foaf\/0\.1\/Person> \./)
})

test('pretty trig keeps graphless input as plain triples', async () => {
  const dataset = rdf.dataset([
    rdf.quad(namedNode('http://example.org/Bob'), namedNode('http://xmlns.com/foaf/0.1/name'), literal('Bob')),
    rdf.quad(namedNode('http://example.org/Bob'), namedNode('http://example.org/likes'), namedNode('http://example.org/Alice')),
  ])

  const output = await datasetToString(dataset, { format: TRIG, prefixes: {} })

  assert.doesNotMatch(output, /^\s*\{/m)
  assert.match(output, /<http:\/\/example\.org\/Bob> <http:\/\/xmlns\.com\/foaf\/0\.1\/name> "Bob" ;/)
})

test('pretty turtle groups predicates for the same subject', async () => {
  const dataset = rdf.dataset([
    rdf.quad(namedNode('http://example.org/Bob'), namedNode('http://xmlns.com/foaf/0.1/name'), literal('Bob')),
    rdf.quad(namedNode('http://example.org/Bob'), namedNode('http://example.org/likes'), namedNode('http://example.org/Alice')),
  ])

  const output = await datasetToString(dataset, { format: TURTLE, prefixes: {} })

  assert.match(output, /<http:\/\/example\.org\/Bob> <http:\/\/xmlns\.com\/foaf\/0\.1\/name> "Bob" ;/)
  assert.match(output, /<http:\/\/example\.org\/likes> <http:\/\/example\.org\/Alice> \./)
})
