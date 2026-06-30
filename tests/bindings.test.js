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
  assert.deepEqual(JSON.parse(line), { s: 'http://example.org/Alice' })
})

test('bindingToJSONL serializes literal values', () => {
  const line = bindingToJSONL({ name: rdf.literal('Alice') })
  assert.deepEqual(JSON.parse(line), { name: 'Alice' })
})

test('bindingToJSONL prefixes blank nodes with _:', () => {
  const line = bindingToJSONL({ x: rdf.blankNode('b0') })
  assert.deepEqual(JSON.parse(line), { x: '_:b0' })
})

test('bindingToJSONL emits empty string for undefined term', () => {
  const line = bindingToJSONL({ s: undefined })
  assert.deepEqual(JSON.parse(line), { s: '' })
})

test('writeBindings writes one JSONL line per row', async () => {
  const out = makeCapture()
  const rows = [
    { s: rdf.namedNode('http://a'), o: rdf.namedNode('http://b') },
    { s: rdf.namedNode('http://c'), o: rdf.literal('hello') },
  ]

  await writeBindings(rows, { out })
  const lines = out.get().trim().split('\n')

  assert.equal(lines.length, 2)
  assert.deepEqual(JSON.parse(lines[0]), { s: 'http://a', o: 'http://b' })
  assert.deepEqual(JSON.parse(lines[1]), { s: 'http://c', o: 'hello' })
})

test('writeBindings produces no output for empty iterable', async () => {
  const out = makeCapture()
  await writeBindings([], { out })
  assert.equal(out.get(), '')
})
