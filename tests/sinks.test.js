import assert from 'node:assert/strict'
import { Readable, Writable } from 'node:stream'
import test from 'node:test'
import rdf from 'rdf-ext'
import { bindingToJSONL, writeBindings } from '../src/sinks/bindings.js'
import { writeTable } from '../src/sinks/table.js'

function textStream (text) {
  const s = new Readable({ read () {} })
  s.push(text)
  s.push(null)
  return s
}

function makeCapture () {
  let data = ''
  const stream = new Writable({
    write (chunk, _enc, cb) { data += chunk.toString(); cb() },
  })
  stream.get = () => data
  return stream
}

// --- bindingToJSONL ---

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

// --- writeBindings ---

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

// --- writeTable ---

test('writeTable renders CSV with header row', async () => {
  const out = makeCapture()
  await writeTable(textStream('{"name":"Alice","age":"30"}\n{"name":"Bob","age":"25"}\n'), { out })
  const lines = out.get().trim().split('\n')
  assert.equal(lines[0], 'name,age')
  assert.equal(lines[1], 'Alice,30')
  assert.equal(lines[2], 'Bob,25')
})

test('writeTable escapes values containing commas', async () => {
  const out = makeCapture()
  await writeTable(textStream('{"val":"a,b"}\n'), { out })
  const lines = out.get().trim().split('\n')
  assert.equal(lines[1], '"a,b"')
})

test('writeTable escapes values containing double quotes', async () => {
  const out = makeCapture()
  await writeTable(textStream('{"val":"say \\"hi\\""}\n'), { out })
  const lines = out.get().trim().split('\n')
  assert.equal(lines[1], '"say ""hi"""')
})

test('writeTable renders TSV with tab-separated header and rows', async () => {
  const out = makeCapture()
  await writeTable(textStream('{"a":"1","b":"2"}\n'), { format: 'tsv', out })
  const lines = out.get().trim().split('\n')
  assert.equal(lines[0], 'a\tb')
  assert.equal(lines[1], '1\t2')
})

test('writeTable passes JSONL rows through unchanged', async () => {
  const out = makeCapture()
  const row = { x: 'hello', y: 42 }
  await writeTable(textStream(`${JSON.stringify(row)}\n`), { format: 'jsonl', out })
  assert.deepEqual(JSON.parse(out.get().trim()), row)
})

test('writeTable produces no output for empty stream', async () => {
  const out = makeCapture()
  await writeTable(textStream(''), { out })
  assert.equal(out.get(), '')
})
