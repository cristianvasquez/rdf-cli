import assert from 'node:assert/strict'
import { Readable, Writable } from 'node:stream'
import test from 'node:test'
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

test('writeTable rejects jsonl: select already emits JSON Lines', async () => {
  await assert.rejects(writeTable(textStream('{"x":"1"}\n'), { format: 'jsonl', out: makeCapture() }), /unsupported table format/)
})

test('writeTable produces no output for empty stream', async () => {
  const out = makeCapture()
  await writeTable(textStream(''), { out })
  assert.equal(out.get(), '')
})

test('writeTable header is the union of keys: a variable unbound in the first row is kept', async () => {
  const out = makeCapture()
  await writeTable(textStream('{"m":"urn:a","l":"Frame A"}\n{"m":"urn:b","l":"Note B","text":"hello"}\n'), { out })
  assert.equal(out.get(), 'm,l,text\nurn:a,Frame A,\nurn:b,Note B,hello\n')
})

test('writeTable header keeps the projection order when early rows skip a middle variable', async () => {
  const out = makeCapture()
  await writeTable(textStream('{"m":"1","text":"t"}\n{"m":"2","l":"L"}\n{"m":"3","l":"L","text":"t"}\n'), { format: 'tsv', out })
  assert.equal(out.get().split('\n')[0], 'm\tl\ttext')
})
