import assert from 'node:assert/strict'
import { Writable } from 'node:stream'
import test from 'node:test'
import rdf from 'rdf-ext'
import { bindingToJSONL, writeBindings } from '../src/sinks/bindings.js'

function makeCapture () {
  let data = ''
  const stream = new Writable({
    write (chunk, _enc, cb) { data += chunk.toString(); cb() },
  })
  stream.get = () => data
  return stream
}

test('bindingToJSONL serializes named node values', () => {
  const line = bindingToJSONL({ s: rdf.namedNode('http://example.org/Alice') })
  assert.deepEqual(JSON.parse(line), { s: { type: 'uri', value: 'http://example.org/Alice' } })
})

test('bindingToJSONL serializes literal values', () => {
  const line = bindingToJSONL({ name: rdf.literal('Alice') })
  assert.deepEqual(JSON.parse(line), { name: { type: 'literal', value: 'Alice', datatype: 'http://www.w3.org/2001/XMLSchema#string' } })
})

test('bindingToJSONL serializes blank node terms', () => {
  const line = bindingToJSONL({ x: rdf.blankNode('b0') })
  assert.deepEqual(JSON.parse(line), { x: { type: 'bnode', value: 'b0' } })
})

test('bindingToJSONL omits unbound terms', () => {
  const line = bindingToJSONL({ s: undefined })
  assert.deepEqual(JSON.parse(line), {})
})

test('writeBindings writes the projection head then one JSONL line per row', async () => {
  const out = makeCapture()
  const rows = [
    { s: rdf.namedNode('http://a'), o: rdf.namedNode('http://b') },
    { s: rdf.namedNode('http://c'), o: rdf.literal('hello') },
  ]

  await writeBindings({ vars: ['s', 'o'], rows }, { out })
  const lines = out.get().trim().split('\n')

  assert.equal(lines.length, 3)
  assert.deepEqual(JSON.parse(lines[0]), { head: { vars: ['s', 'o'] } })
  assert.deepEqual(JSON.parse(lines[1]), { s: { type: 'uri', value: 'http://a' }, o: { type: 'uri', value: 'http://b' } })
  assert.deepEqual(JSON.parse(lines[2]), { s: { type: 'uri', value: 'http://c' }, o: { type: 'literal', value: 'hello', datatype: 'http://www.w3.org/2001/XMLSchema#string' } })
})

test('writeBindings writes a head for zero rows', async () => {
  const out = makeCapture()
  await writeBindings({ vars: ['s'], rows: [] }, { out })
  assert.equal(out.get(), '{"head":{"vars":["s"]}}\n')
})
