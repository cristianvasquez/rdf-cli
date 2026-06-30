import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import test from 'node:test'
import rdf from 'rdf-ext'
import { collectDataset, readLines } from '../src/utils.js'

const s = rdf.namedNode('http://example.org/s')
const p = rdf.namedNode('http://example.org/p')
const o = rdf.namedNode('http://example.org/o')

test('collectDataset accumulates quads into a dataset', async () => {
  const quads = [rdf.quad(s, p, o), rdf.quad(s, p, rdf.literal('hello'))]
  const dataset = await collectDataset(quads)
  assert.equal(dataset.size, 2)
  assert.ok(dataset.has(rdf.quad(s, p, o)))
})

test('collectDataset returns empty dataset for empty source', async () => {
  const dataset = await collectDataset([])
  assert.equal(dataset.size, 0)
})

test('readLines yields non-empty trimmed lines', async () => {
  const stream = new Readable({ read () {} })
  stream.push('line one\n  \nline two\n   line three   \n\n')
  stream.push(null)

  const lines = []
  for await (const line of readLines(stream)) lines.push(line)

  assert.deepEqual(lines, ['line one', 'line two', 'line three'])
})

test('readLines yields nothing for an empty stream', async () => {
  const stream = new Readable({ read () {} })
  stream.push(null)

  const lines = []
  for await (const line of readLines(stream)) lines.push(line)

  assert.equal(lines.length, 0)
})

test('readLines skips whitespace-only lines', async () => {
  const stream = new Readable({ read () {} })
  stream.push('   \n\t\n  real  \n')
  stream.push(null)

  const lines = []
  for await (const line of readLines(stream)) lines.push(line)

  assert.deepEqual(lines, ['real'])
})
