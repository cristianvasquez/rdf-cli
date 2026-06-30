import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { readFromGlob, readFromPaths, streamFileQuads } from '../src/sources/glob.js'

const FIXTURES = fileURLToPath(new URL('./fixtures', import.meta.url))

async function collect (source) {
  const quads = []
  for await (const quad of source) quads.push(quad)
  return quads
}

// --- streamFileQuads ---

test('streamFileQuads parses a Turtle file into quads', async () => {
  const quads = await collect(streamFileQuads(`${FIXTURES}/person-valid.ttl`))
  assert.equal(quads.length, 3)
  assert.ok(quads.some((q) => q.subject.value === 'http://example.org/alice'))
})

test('streamFileQuads throws synchronously for unknown file extension', () => {
  assert.throws(
    () => streamFileQuads(`${FIXTURES}/data.unknownext`),
    /unknown format/,
  )
})

// --- readFromGlob ---

test('readFromGlob yields quads from a single file', async () => {
  const quads = await collect(readFromGlob([`${FIXTURES}/person-valid.ttl`]))
  assert.ok(quads.length > 0)
  assert.ok(quads.some((q) => q.subject.value === 'http://example.org/alice'))
})

test('readFromGlob merges quads from multiple files', async () => {
  const quads = await collect(
    readFromGlob([`${FIXTURES}/person-valid.ttl`, `${FIXTURES}/person-invalid.ttl`]),
  )
  assert.ok(quads.length > 3)
})

test('readFromGlob assigns file path as named graph when graphFrom=path', async () => {
  const quads = await collect(
    readFromGlob([`${FIXTURES}/person-valid.ttl`], { graphFrom: 'path' }),
  )
  assert.ok(quads.length > 0)
  assert.ok(quads.every((q) => q.graph.termType === 'NamedNode'))
  assert.ok(quads.some((q) => q.graph.value.includes('person-valid.ttl')))
})

test('readFromGlob leaves existing named graphs untouched when graphFrom=path', async () => {
  const quads = await collect(
    readFromGlob([`${FIXTURES}/person-valid.ttl`], { graphFrom: 'path' }),
  )
  const graphValues = [...new Set(quads.map((q) => q.graph.value))]
  assert.equal(graphValues.length, 1)
  assert.ok(graphValues[0].includes('person-valid.ttl'))
})

test('readFromGlob yields nothing for an unmatched glob', async () => {
  const quads = await collect(readFromGlob([`${FIXTURES}/*.noquads`]))
  assert.equal(quads.length, 0)
})

test('readFromGlob calls onError for a file that fails to parse', async () => {
  const errors = []
  const quads = await collect(
    readFromGlob(
      [`${FIXTURES}/person-valid.ttl`, `${FIXTURES}/../../examples/data/with-errors/alice-cat.md`],
      {
        onError: (file, err) => errors.push({ file, err }),
      },
    ),
  )
  assert.equal(quads.length, 3)
  assert.equal(errors.length, 1)
  assert.match(String(errors[0].err), /unknown format/)
})

test('readFromPaths yields quads from stdin-supplied file paths', async () => {
  const quads = await collect(
    readFromPaths([`${FIXTURES}/person-valid.ttl`, `${FIXTURES}/person-invalid.ttl`]),
  )
  assert.ok(quads.length > 3)
})
