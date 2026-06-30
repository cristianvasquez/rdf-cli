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
