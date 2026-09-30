import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import test from 'node:test'
import rdf from 'rdf-ext'
import { TO_DEFAULT, filterQuads, mapQuad, mapQuads } from '../src/transforms/quadExpr.js'

const ex = (name) => rdf.namedNode(`http://example.org/${name}`)
const g1 = rdf.namedNode('urn:g1')

async function run (transform, quads) {
  const out = []
  for await (const quad of Readable.from(quads, { objectMode: true }).pipe(transform)) out.push(quad)
  return out
}

const input = [
  rdf.quad(ex('a'), ex('p'), rdf.literal('x', 'en')),
  rdf.quad(ex('b'), ex('p'), rdf.literal('y', 'fr'), g1),
  rdf.quad(rdf.blankNode('n1'), ex('q'), ex('c')),
]

test('filterQuads keeps quads where the expression is true', async () => {
  const out = await run(filterQuads('?p = <http://example.org/p>'), input)
  assert.equal(out.length, 2)
})

test('filterQuads binds ?g only for named graphs', async () => {
  const named = await run(filterQuads('bound(?g)'), input)
  assert.deepEqual(named.map((q) => q.graph.value), ['urn:g1'])
})

test('filterQuads counts an expression error as false', async () => {
  const out = await run(filterQuads('?o + 1 > 0'), input)
  assert.equal(out.length, 0)
})

test('filterQuads keeps blank-node labels', async () => {
  const out = await run(filterQuads('isBlank(?s)'), input)
  assert.equal(out[0].subject.termType, 'BlankNode')
  assert.equal(out[0].subject.value, 'n1')
})

test('filterQuads fuses: filter p then q = filter (q && p)', async () => {
  const p = '?p = <http://example.org/p>'
  const q = 'lang(?o) = "en"'
  const chained = await run(filterQuads(q), await run(filterQuads(p), input))
  const fused = await run(filterQuads(`(${q}) && (${p})`), input)
  assert.deepEqual(chained.map((x) => x.subject.value), fused.map((x) => x.subject.value))
})

test('filterQuads rejects an invalid expression before reading', () => {
  assert.throws(() => filterQuads('?s ='), /invalid expression/)
})

test('filterQuads handles more quads than one batch', async () => {
  const many = Array.from({ length: 1500 }, (_, i) => rdf.quad(ex(`s${i}`), ex('p'), rdf.literal(String(i))))
  const kept = await run(filterQuads('<http://www.w3.org/2001/XMLSchema#integer>(?o) < 1000'), many)
  assert.equal(kept.length, 1000)
})

test('mapQuads rewrites matching quads and passes the others unchanged', async () => {
  const out = await run(mapQuads('!bound(?g)', { graph: '<urn:batch>' }), input)
  const graphs = out.map((q) => q.graph.value).sort()
  assert.deepEqual(graphs, ['urn:batch', 'urn:batch', 'urn:g1'])
})

test('mapQuads with graph TO_DEFAULT removes graphs', async () => {
  const out = await run(mapQuads('true', { graph: TO_DEFAULT }), input)
  assert.ok(out.every((q) => q.graph.termType === 'DefaultGraph'))
})

test('mapQuads reports an invalid term and passes the input quad unchanged', async () => {
  const errors = []
  const out = await run(mapQuads('true', { subject: 'str(?s)' }, (e) => errors.push(e)), input)
  assert.equal(out.length, 3)
  assert.equal(errors.length, 3)
  assert.ok(errors.some((e) => /not valid as subject/.test(e.message)))
})

test('mapQuads reports a rewrite that gives no value', async () => {
  const errors = []
  await run(mapQuads('true', { object: '?o + 1' }, (e) => errors.push(e)), input)
  assert.equal(errors.length, 3)
  assert.match(errors[0].message, /gave no value/)
})

test('mapQuads fails the stream when no onMapError is given', async () => {
  await assert.rejects(run(mapQuads('true', { subject: 'str(?s)' }), input), /^Error: map: subject expression/)
})

test('mapQuads requires at least one rewrite', () => {
  assert.throws(() => mapQuads('true', {}), /at least one rewrite/)
})

test('mapQuad returns quad or error for one quad', () => {
  const ok = mapQuad('true', { predicate: '<http://example.org/r>' }, input[0])
  assert.equal(ok.quad.predicate.value, 'http://example.org/r')
  const failed = mapQuad('true', { predicate: '"lit"' }, input[0])
  assert.match(failed.error.message, /not valid as predicate/)
})
