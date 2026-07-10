import assert from 'node:assert/strict'
import test from 'node:test'
import rdf from 'rdf-ext'
import { loadClaimer, applyClaimer, emitClaimer, sourceGraphOf } from '../src/transforms/claimer.js'

const ns = (s) => rdf.namedNode(`http://example.org/${s}`)
const SH = (s) => rdf.namedNode(`http://www.w3.org/ns/shacl#${s}`)
const RDF_TYPE = rdf.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type')
const QUERY = rdf.namedNode('urn:rdf-cli:cascade#query')

const personGraph = ns('claimers/person')
const upstreamGraph = ns('already/claimed')

// Person claimer: claims Person type/name quads, two views — one derives a
// label, one matches nothing in the input below.
function personClaimerQuads () {
  return [
    rdf.quad(ns('PersonShape'), RDF_TYPE, SH('NodeShape'), personGraph),
    rdf.quad(ns('PersonShape'), SH('targetClass'), ns('Person'), personGraph),
    rdf.quad(ns('PersonShape'), SH('property'), ns('p1'), personGraph),
    rdf.quad(ns('p1'), SH('path'), ns('name'), personGraph),
    rdf.quad(ns('views/card'), QUERY, rdf.literal(
      'CONSTRUCT { ?p <http://example.org/label> ?n } WHERE { ?p <http://example.org/name> ?n }'), personGraph),
    rdf.quad(ns('views/timeline'), QUERY, rdf.literal(
      'CONSTRUCT { ?p <http://example.org/event> ?e } WHERE { ?p <http://example.org/born> ?e }'), personGraph),
  ]
}

// Claim-only claimer: reads subjects of ex:unrelated, derives nothing.
const looseGraph = ns('claimers/loose-ends')
function looseClaimerQuads () {
  return [
    rdf.quad(ns('LooseShape'), RDF_TYPE, SH('NodeShape'), looseGraph),
    rdf.quad(ns('LooseShape'), SH('targetSubjectsOf'), ns('unrelated'), looseGraph),
  ]
}

// Two graphless Person quads, one graphless loose quad, one quad already
// claimed upstream (named graph).
function inputQuads () {
  return [
    rdf.quad(ns('alice'), RDF_TYPE, ns('Person')),
    rdf.quad(ns('alice'), ns('name'), rdf.literal('Alice')),
    rdf.quad(ns('x'), ns('unrelated'), ns('y')),
    rdf.quad(ns('u'), ns('untouchable'), ns('v'), upstreamGraph),
  ]
}

async function collect (stream) {
  const quads = []
  for await (const q of stream) quads.push(q)
  return quads
}

test('loadClaimer parses one claimer: graph, shapes, views sorted by IRI', () => {
  const claimer = loadClaimer(personClaimerQuads())
  assert.ok(claimer.graph.equals(personGraph))
  assert.equal(claimer.shapes.size, 4, 'shapes exclude cascade# metadata')
  assert.deepEqual(claimer.views.map((v) => v.graph.value),
    [ns('views/card').value, ns('views/timeline').value])
})

test('loadClaimer rejects a document with two claimers', () => {
  assert.throws(() => loadClaimer([...personClaimerQuads(), ...looseClaimerQuads()]),
    /exactly one claimer.*found 2/)
})

test('loadClaimer rejects a document with no claimer', () => {
  assert.throws(() => loadClaimer(inputQuads().slice(0, 2)), /found 0/)
})

test('loadClaimer rejects a non-IRI view subject', () => {
  const quads = [...looseClaimerQuads(),
    rdf.quad(rdf.blankNode(), QUERY, rdf.literal('CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }'), looseGraph)]
  assert.throws(() => loadClaimer(quads), /view subject must be an IRI/)
})

test('applyClaimer splits the graphless working set: partition and disjointness', async () => {
  const claimer = loadClaimer(personClaimerQuads())
  const { claimed, rest } = await applyClaimer({ inputQuads: inputQuads(), claimer })

  assert.equal(claimed.size, 2, 'both Person quads claimed')
  assert.equal(rest.size, 1, 'loose quad stays')
  const graphless = inputQuads().filter((q) => q.graph.termType === 'DefaultGraph')
  const union = rdf.dataset([...claimed, ...rest])
  assert.equal(union.size, graphless.length, 'claimed ∪ rest = working set')
  for (const quad of claimed) assert.ok(!rest.has(quad), 'claimed ∩ rest = ∅')
})

test('applyClaimer passes named-graph quads through untouched', async () => {
  const claimer = loadClaimer(personClaimerQuads())
  const { passThrough } = await applyClaimer({ inputQuads: inputQuads(), claimer })
  assert.equal(passThrough.length, 1)
  assert.ok(passThrough[0].graph.equals(upstreamGraph))
})

test('every view reads the same claimed set; a view matching nothing stays present, empty', async () => {
  const claimer = loadClaimer(personClaimerQuads())
  const { views } = await applyClaimer({ inputQuads: inputQuads(), claimer })
  assert.equal(views.length, 2)
  assert.equal(views[0].quads.size, 1, 'card view derives the label')
  assert.equal(views[1].quads.size, 0, 'timeline view matched nothing but is still present')
})

test('a claim-only claimer has no views', async () => {
  const claimer = loadClaimer(looseClaimerQuads())
  assert.deepEqual(claimer.views, [])
  const { claimed, views } = await applyClaimer({ inputQuads: inputQuads(), claimer })
  assert.equal(claimed.size, 1)
  assert.deepEqual(views, [])
})

test('emitClaimer routes the channels: pass-through, source graph, view graphs, graphless rest', async () => {
  const claimer = loadClaimer(personClaimerQuads())
  const result = await applyClaimer({ inputQuads: inputQuads(), claimer })
  const emitted = await collect(emitClaimer(result))

  const byGraph = (iri) => emitted.filter((q) => q.graph.value === iri)
  assert.equal(byGraph(upstreamGraph.value).length, 1, 'upstream claim untouched')
  assert.equal(byGraph(sourceGraphOf(personGraph.value)).length, 2, 'claimed quads in source graph')
  assert.equal(byGraph(ns('views/card').value).length, 1, 'view quads in the view graph')
  const graphless = emitted.filter((q) => q.graph.termType === 'DefaultGraph')
  assert.equal(graphless.length, 1, 'rest stays graphless')
})

test('a later claimer in the pipe cannot take an earlier claimer\'s quads', async () => {
  const person = loadClaimer(personClaimerQuads())
  const loose = loadClaimer(looseClaimerQuads())

  const afterPerson = await applyClaimer({ inputQuads: inputQuads(), claimer: person })
  const afterLoose = await applyClaimer({
    inputQuads: emitClaimer(afterPerson), claimer: loose,
  })

  assert.equal(afterLoose.claimed.size, 1, 'claims the loose quad from the graphless rest')
  assert.equal(afterLoose.rest.size, 0)
  // person's source + view quads plus the upstream claim all arrive named
  assert.equal(afterLoose.passThrough.length, 4, 'earlier claims pass through untouchable')

  const emitted = await collect(emitClaimer(afterLoose))
  const graphs = new Set(emitted.map((q) => q.graph.value))
  assert.ok(graphs.has(sourceGraphOf(personGraph.value)))
  assert.ok(graphs.has(sourceGraphOf(looseGraph.value)))
})
