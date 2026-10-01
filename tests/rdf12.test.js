import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { Readable } from 'node:stream'
import rdf from 'rdf-ext'
import { _canonizeSync } from 'rdf-canonize'
import { canonicalNQuads } from '../src/serializers/canonical.js'
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

// Canonical form with triple terms (serializers/canonical.js).
const PREFIX = '@prefix ex: <http://ex/> .\n'

test('canonical form without triple terms is that of rdf-canonize', async () => {
  const quads = await parse('text/turtle', PREFIX + '_:x ex:p _:y . _:y ex:p "v" . ex:s ex:p ex:o .')
  assert.equal(canonicalNQuads(quads), _canonizeSync(quads, { algorithm: 'RDFC-1.0' }))
})

test('canonical form of triple terms: isomorphic inputs give the same text, and it reads back', async () => {
  const a = await parse('text/turtle', PREFIX + `
    ex:s ex:p <<( _:a ex:knows <<( _:b ex:age 42 )>> )>> . _:a ex:name "A" . _:b ex:name "B" .
    ex:a ex:b ex:c ~ ex:r1 {| ex:source "x y . z" |} .`)
  const b = await parse('text/turtle', PREFIX + `
    _:q ex:name "B" . ex:a ex:b ex:c ~ ex:r1 {| ex:source "x y . z" |} .
    _:z ex:name "A" . ex:s ex:p <<( _:z ex:knows <<( _:q ex:age 42 )>> )>> .`)
  const text = canonicalNQuads(a)
  assert.equal(canonicalNQuads(b), text)
  assert.match(text, /<http:\/\/ex\/s> <http:\/\/ex\/p> <<\( _:c14n\d+ <http:\/\/ex\/knows> <<\( _:c14n\d+ <http:\/\/ex\/age> "42"\^\^<[^>]+> \)>> \)>> \./)
  assert.doesNotMatch(text, /urn:x-rdf-cli/)
  assert.equal(canonicalNQuads(await parse('application/n-quads', text)), text)
})

test('canonical form keeps the identity of blank nodes inside triple terms', async () => {
  const linked = await parse('text/turtle', PREFIX + 'ex:s ex:p <<( _:a ex:q ex:o )>> . _:a ex:name "A" .')
  const unlinked = await parse('text/turtle', PREFIX + 'ex:s ex:p <<( _:b ex:q ex:o )>> . _:a ex:name "A" .')
  assert.notEqual(canonicalNQuads(linked), canonicalNQuads(unlinked))
})

test('canonical form refuses the reserved graph', async () => {
  const quads = await parse('application/n-quads', '<http://ex/s> <http://ex/p> <<( <http://ex/a> <http://ex/b> <http://ex/c> )>> <urn:x-rdf-cli:triple-term> .\n')
  assert.throws(() => canonicalNQuads(quads), /reserved/)
})

test('rdf canonicalize keeps triple terms', () => {
  const nq = '<http://ex/s> <http://ex/p> <<( _:x <http://ex/q> <http://ex/o> )>> .\n_:x <http://ex/name> "A" .\n'
  const out = execFileSync('node', [BIN, 'canonicalize'], { input: nq, encoding: 'utf8' })
  assert.match(out, /<<\( _:c14n\d+ <http:\/\/ex\/q> <http:\/\/ex\/o> \)>>/)
})
