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
import { skolemize } from '../src/transforms/skolem.js'
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

// Review findings (branch rdf-1.2-triple-terms).
const sameDataset = async (text, quads) => assert.equal(canonicalNQuads(await parse('text/turtle', text)), canonicalNQuads(quads))

test('triplify keeps the identity of a blank node that is also inside a triple term', async () => {
  for (const body of [
    'ex:a ex:b _:o ~ _:r {| ex:src ex:w |} . _:o ex:v 1 .',
    'ex:s ex:p <<( _:a ex:q ex:o )>> . _:a ex:name "A" .',
    'ex:s ex:p <<( _:a ex:q ex:o )>> . _:a ex:name "A" . ex:t ex:r _:a .',
    'ex:s ex:q _:x . ex:s ex:p <<( ex:a ex:b _:x )>> .',
    'ex:s ex:p <<( _:l ex:q ex:o )>> . _:l rdf:first ex:a ; rdf:rest ( ex:b ) .',
    'ex:s ex:p _:h . _:h rdf:first 1 ; rdf:rest _:c2 . _:c2 rdf:first 2 ; rdf:rest rdf:nil . ex:t ex:q <<( _:c2 ex:r ex:o )>> .',
    'ex:s ex:p ( 1 2 _:c3x 4 ) . ex:t ex:q <<( _:c3x ex:r ex:o )>> .',
    'ex:s ex:p _:h . _:h rdf:first 1 ; rdf:rest _:c2 . _:c2 rdf:first 2 ; rdf:rest _:c3 . _:c3 rdf:first 3 ; rdf:rest _:c4 . _:c4 rdf:first 4 ; rdf:rest rdf:nil . ex:t ex:q <<( _:c3 ex:r ex:o )>> .',
  ]) {
    const quads = await parse('text/turtle', PREFIX + '@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .\n' + body)
    await sameDataset(await triplify(rdf.dataset(quads), PREFIXES), quads)
  }
})

test('triplify declares the prefixes used inside triple terms', async () => {
  const quads = await parse('text/turtle', PREFIX + 'ex:s ex:p <<( <http://foo/a> <http://foo/b> "1"^^<http://foo/dt> )>> .')
  const text = await triplify(rdf.dataset(quads), { ...PREFIXES, foo: 'http://foo/' })
  assert.match(text, /@prefix foo: <http:\/\/foo\/>/)
  await sameDataset(text, quads)
})

test('literals with a base direction keep language and direction', async () => {
  const quads = await parse('text/turtle', PREFIX + 'ex:s ex:p "hello"@en--ltr, "x"@ar--rtl, "z"@ar . ex:s ex:q <<( ex:a ex:b "y"@en--rtl )>> .')
  const nq = lines(quads)
  assert.ok(nq.includes('<http://ex/s> <http://ex/p> "hello"@en--ltr .\n'))
  assert.deepEqual(lines(await parse('application/n-quads', nq.join(''))), nq)
  const ttl = await triplify(rdf.dataset(quads), PREFIXES)
  assert.match(ttl, /"hello"@en--ltr/)
  assert.doesNotMatch(ttl, /@prefix rdf:/)
  await sameDataset(ttl, quads)
  const canonical = canonicalNQuads(quads)
  assert.match(canonical, /"hello"@en--ltr/)
  assert.match(canonical, /"y"@en--rtl/)
  assert.notEqual(canonicalNQuads(quads.filter((q) => q.object.direction !== 'rtl')), canonical)
})

test('canonical form handles blank-node cycles as toCanonical() does (maxDeepIterations 500)', async () => {
  const cycles = PREFIX + '_:a0 ex:p _:b0 . _:b0 ex:p _:a0 . _:a1 ex:p _:b1 . _:b1 ex:p _:a1 .'
  assert.ok(canonicalNQuads(await parse('text/turtle', cycles)))
  assert.ok(canonicalNQuads(await parse('text/turtle', cycles + ' ex:s ex:p <<( _:a0 ex:q _:b1 )>> .')))
})

test('canonical form refuses the reserved IRIs in any position', async () => {
  const quads = await parse('text/turtle', PREFIX + 'ex:s ex:p <<( ex:a ex:b ex:c )>> . ex:s ex:p <urn:x-rdf-cli:triple-term> .')
  assert.throws(() => canonicalNQuads(quads), /reserved/)
})

test('rdf read scopes blank nodes inside triple terms as outside', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rdf12-'))
  const file = join(dir, 'in.ttl')
  writeFileSync(file, PREFIX + 'ex:s ex:p <<( _:o ex:q ex:r )>> . _:o ex:v 1 .')
  const nq = execFileSync('node', [BIN, 'read', file], { encoding: 'utf8' })
  const labels = [...nq.matchAll(/_:(\S+)/g)].map((m) => m[1])
  assert.equal(labels.length, 2)
  assert.equal(new Set(labels).size, 1)
})

test('skolemize maps a blank node inside a triple term to the same IRI', async () => {
  const quads = await parse('text/turtle', PREFIX + 'ex:s ex:p <<( _:o ex:q ex:r )>> . _:o ex:v 1 .')
  const out = []
  for await (const q of Readable.from(quads).pipe(skolemize('https://x/'))) out.push(q)
  const inside = out.find((q) => q.object.termType === 'Quad').object.subject
  const outside = out.find((q) => q.predicate.value === 'http://ex/v').subject
  assert.equal(inside.termType, 'NamedNode')
  assert.ok(inside.equals(outside))
})

test('parse keeps [ ] and an explicit _:b1 as two blank nodes', async () => {
  const quads = await parse('text/turtle', PREFIX + 'ex:a ex:b _:b1 . [ ex:c ex:d ] .')
  assert.notEqual(quads[0].object.value, quads[1].subject.value)
})

// Known limit: @rdfjs/dataset 2.0.2 (rdf-ext datasets) keys a literal by value
// and language only (DatasetCore.js termToId), so "x"@ar and "x"@ar--rtl are
// one quad in a dataset. Every command that collects a dataset loses one.
test('a dataset keeps "x"@ar and "x"@ar--rtl as two quads', { todo: 'upstream @rdfjs/dataset 2.0.2 termToId ignores the direction' }, async () => {
  const quads = await parse('text/turtle', PREFIX + 'ex:s ex:p "x"@ar--rtl, "x"@ar .')
  assert.equal(rdf.dataset(quads).size, 2)
})

// RDF 1.2 version directive. n3 2.7.12 reads "@prefix" after a literal as a
// language tag, also after whitespace, so 'VERSION "1.2"' fails before '@prefix'.
test('parse reads VERSION "1.2" before @prefix and @base', async () => {
  for (const mimeType of ['text/turtle', 'application/trig']) {
    const quads = await parse(mimeType, 'VERSION "1.2"\n@prefix ex: <http://ex/> .\n@base <http://ex/> .\nex:a ex:b <c> .\n')
    assert.deepEqual(lines(quads), ['<http://ex/a> <http://ex/b> <http://ex/c> .\n'])
  }
  const tagged = await parse('text/turtle', '<http://ex/a> <http://ex/b> "x"@en, "y"@en-GB--rtl .\n')
  assert.deepEqual(lines(tagged), ['<http://ex/a> <http://ex/b> "x"@en .\n', '<http://ex/a> <http://ex/b> "y"@en-GB--rtl .\n'])
})

// End to end: rdf read (.ttl, .trig, .nq) | rdf pretty (turtle, trig, nquads),
// with triple terms, reified triples and annotations; each output reads back
// isomorphic to the input.
test('rdf read | rdf pretty keeps triple terms, reifiers and annotations in Turtle, TriG and N-Quads', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rdf12-'))
  const body = `ex:p1 ex:element <<( ex:alice ex:knows <<( _:x ex:age 42 )>> )>> .
  << ex:alice ex:age 23 >> ex:certainty 0.9 .
  << ex:alice ex:age 24 ~ ex:r2 >> ex:source ex:census .
  ex:a ex:b ex:c ~ ex:r1 {| ex:source ex:wiki |} .
  ex:a ex:b ex:d {| ex:source _:x |} .`
  const run = (args, input) => execFileSync('node', [BIN, ...args], { input, encoding: 'utf8' })
  const canon = (nq) => run(['canonicalize'], nq)
  const files = {
    'in.ttl': `VERSION "1.2"\n${PREFIX}${body}\n`,
    'in.trig': `VERSION "1.2"\n${PREFIX}ex:g { ${body} }\n${body}\n`,
  }
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text)
  writeFileSync(join(dir, 'in.nq'), run(['read', join(dir, 'in.trig')]))
  for (const name of ['in.ttl', 'in.trig', 'in.nq']) {
    const nq = run(['read', join(dir, name)])
    assert.match(nq, /rdf-syntax-ns#reifies> <<\( /, name)
    const graphs = name !== 'in.ttl'
    for (const [format, ext] of [['trig', 'trig'], ['nquads', 'nq'], ...(graphs ? [] : [['turtle', 'ttl']])]) {
      const out = join(dir, `out-${name}.${ext}`)
      writeFileSync(out, run(['pretty', '--format', format], nq))
      assert.equal(canon(run(['read', out])), canon(nq), `${name} -> ${format}`)
    }
  }
})
