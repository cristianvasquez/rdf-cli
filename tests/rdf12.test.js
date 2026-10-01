import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { Readable } from 'node:stream'
import rdf from 'rdf-ext'
import { quadToNQ } from '../src/serializers/ntriples.js'
import { triplify } from '../src/serializers/triplify.js'
import { parseQuads } from '../src/sources/parse.js'

// RDF 1.2 triple terms: read, and write as N-Quads, Turtle and TriG.
const TURTLE = `@prefix ex: <http://ex/> .
ex:p1 ex:element <<( ex:alice ex:knows ex:bob )>> .
ex:p2 ex:element <<( ex:alice ex:says <<( ex:bob ex:age 42 )>> )>> .
ex:a ex:b ex:c ~ ex:r1 {| ex:source ex:wiki |} .
`
const PREFIXES = { ex: 'http://ex/' }
const BIN = new URL('../bin/rdf.js', import.meta.url).pathname

async function parse (mimeType, text) {
  const quads = []
  for await (const quad of parseQuads(mimeType, Readable.from([text]))) quads.push(quad)
  return quads
}

const lines = (quads) => quads.map(quadToNQ).sort()

test('reads triple terms, and the ( ) of a triple term is not an RDF list', async () => {
  const quads = await parse('text/turtle', TURTLE)
  assert.equal(quads.length, 5)
  assert.equal(quads[0].object.termType, 'Quad')
  assert.ok(quads.every((q) => !q.predicate.value.endsWith('#first')))
})

test('writes N-Quads lines that read back as the same quads', async () => {
  const nq = lines(await parse('text/turtle', TURTLE))
  assert.ok(nq.includes('<http://ex/p1> <http://ex/element> <<( <http://ex/alice> <http://ex/knows> <http://ex/bob> )>> .\n'))
  assert.deepEqual(lines(await parse('application/n-quads', nq.join(''))), nq)
})

test('triplify writes triple terms with prefixes, and the Turtle reads back', async () => {
  const quads = await parse('text/turtle', TURTLE)
  const text = await triplify(rdf.dataset(quads), PREFIXES)
  assert.match(text, /ex:element <<\( ex:alice ex:knows ex:bob \)>>/)
  assert.match(text, /<<\( ex:alice ex:says <<\( ex:bob ex:age 42 \)>> \)>>/)
  assert.deepEqual(lines(await parse('text/turtle', text)), lines(quads))
})

test('triplify writes triple terms in named graphs, and the TriG reads back', async () => {
  const g = rdf.namedNode('http://ex/g')
  const quads = (await parse('text/turtle', TURTLE)).map((q) => rdf.quad(q.subject, q.predicate, q.object, g))
  const text = await triplify(rdf.dataset(quads), PREFIXES)
  assert.deepEqual(lines(await parse('application/trig', text)), lines(quads))
})

test('rdf read | rdf pretty keeps triple terms', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rdf12-'))
  const file = join(dir, 'in.ttl')
  writeFileSync(file, TURTLE)
  const nq = execFileSync('node', [BIN, 'read', file], { encoding: 'utf8' })
  assert.match(nq, /<<\( <http:\/\/ex\/alice> <http:\/\/ex\/knows> <http:\/\/ex\/bob> \)>>/)
  const ttl = execFileSync('node', [BIN, 'pretty', '--format', 'turtle'], { input: nq, encoding: 'utf8' })
  writeFileSync(file, ttl)
  assert.equal(execFileSync('node', [BIN, 'read', file], { encoding: 'utf8' }).split('\n').sort().join('\n'), nq.split('\n').sort().join('\n'))
})
