import assert from 'node:assert/strict'
import test from 'node:test'
import rdf from 'rdf-ext'
import {
  loadClaimer, applyClaimer, emitClaimer, sourceGraphOf, frontierGraphOf,
} from '../src/transforms/claimer.js'

const ns = (s) => rdf.namedNode(`http://example.org/${s}`)
const SH = (s) => rdf.namedNode(`http://www.w3.org/ns/shacl#${s}`)
const RDF_TYPE = rdf.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type')
const QUERY = rdf.namedNode('urn:rdf-cli:cascade#query')

const personGraph = ns('claimers/person')
const upstreamGraph = ns('already/claimed')

// Person claimer: owns Person name quads (constraint read), borrows the type
// quads (target navigation). Two views — one derives a label, one matches
// nothing in the input below.
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

const looseGraph = ns('claimers/loose-ends')

// Bare navigation-only claimer: targets subjects of ex:unrelated but never
// reads anything with a constraint — it borrows, it owns nothing.
function bareLooseClaimerQuads () {
  return [
    rdf.quad(ns('LooseShape'), RDF_TYPE, SH('NodeShape'), looseGraph),
    rdf.quad(ns('LooseShape'), SH('targetSubjectsOf'), ns('unrelated'), looseGraph),
  ]
}

// The opt-in ownership idiom: an explicit constraint reading the target quads
// lands them in coverage, so the claimer takes them.
function owningLooseClaimerQuads () {
  return [
    ...bareLooseClaimerQuads(),
    rdf.quad(ns('LooseShape'), SH('property'), ns('looseP'), looseGraph),
    rdf.quad(ns('looseP'), SH('path'), ns('unrelated'), looseGraph),
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
  assert.throws(() => loadClaimer([...personClaimerQuads(), ...bareLooseClaimerQuads()]),
    /exactly one claimer.*found 2/)
})

test('loadClaimer rejects a document with no claimer', () => {
  assert.throws(() => loadClaimer(inputQuads().slice(0, 2)), /found 0/)
})

test('loadClaimer rejects a non-IRI view subject', () => {
  const quads = [...bareLooseClaimerQuads(),
    rdf.quad(rdf.blankNode(), QUERY, rdf.literal('CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }'), looseGraph)]
  assert.throws(() => loadClaimer(quads), /view subject must be an IRI/)
})

test('applyClaimer splits the working set: partition, disjointness, borrowed frontier', async () => {
  const claimer = loadClaimer(personClaimerQuads())
  const { claimed, frontier, rest } = await applyClaimer({ inputQuads: inputQuads(), claimer })

  assert.equal(claimed.size, 1, 'owned: the constraint-read name quad')
  assert.equal(frontier.size, 1, 'borrowed: the target-navigation type quad')
  assert.equal(rest.size, 2, 'type (borrowed, stays) and the loose quad')

  const graphless = inputQuads().filter((q) => q.graph.termType === 'DefaultGraph')
  const union = rdf.dataset([...claimed, ...rest])
  assert.equal(union.size, graphless.length, 'claimed ∪ rest = working set')
  for (const quad of claimed) assert.ok(!rest.has(quad), 'claimed ∩ rest = ∅')
  for (const quad of frontier) assert.ok(rest.has(quad), 'frontier ⊆ rest')
})

test('applyClaimer passes named-graph quads through untouched', async () => {
  const claimer = loadClaimer(personClaimerQuads())
  const { passThrough } = await applyClaimer({ inputQuads: inputQuads(), claimer })
  assert.equal(passThrough.length, 1)
  assert.ok(passThrough[0].graph.equals(upstreamGraph))
})

test('every view reads the same feed; a view matching nothing stays present, empty', async () => {
  const claimer = loadClaimer(personClaimerQuads())
  const { views } = await applyClaimer({ inputQuads: inputQuads(), claimer })
  assert.equal(views.length, 2)
  assert.equal(views[0].quads.size, 1, 'card view derives the label')
  assert.equal(views[1].quads.size, 0, 'timeline view matched nothing but is still present')
})

test('views read the borrowed frontier too', async () => {
  const quads = [
    ...personClaimerQuads().filter((q) => !q.predicate.equals(QUERY)),
    rdf.quad(ns('views/types'), QUERY, rdf.literal(
      'CONSTRUCT { ?p <http://example.org/isA> ?c } WHERE { ?p a ?c }'), personGraph),
  ]
  const claimer = loadClaimer(quads)
  const { views } = await applyClaimer({ inputQuads: inputQuads(), claimer })
  assert.equal(views[0].quads.size, 1, 'view derived from the borrowed type quad')
})

test('a navigation-only claimer borrows but owns nothing', async () => {
  const claimer = loadClaimer(bareLooseClaimerQuads())
  assert.deepEqual(claimer.views, [])
  const { claimed, frontier } = await applyClaimer({ inputQuads: inputQuads(), claimer })
  assert.equal(claimed.size, 0, 'no constraint read anything — nothing owned')
  assert.equal(frontier.size, 1, 'the target quad is only borrowed')
})

test('ownership of target quads is opt-in via an explicit constraint', async () => {
  const claimer = loadClaimer(owningLooseClaimerQuads())
  const { claimed, frontier } = await applyClaimer({ inputQuads: inputQuads(), claimer })
  assert.equal(claimed.size, 1, 'sh:path ex:unrelated lands the quad in coverage')
  assert.equal(frontier.size, 0, 'owned quads are not borrowed')
})

test('emitClaimer routes the channels: pass-through, source, frontier, views, graphless rest', async () => {
  const claimer = loadClaimer(personClaimerQuads())
  const result = await applyClaimer({ inputQuads: inputQuads(), claimer })
  const emitted = await collect(emitClaimer(result))

  const byGraph = (iri) => emitted.filter((q) => q.graph.value === iri)
  assert.equal(byGraph(upstreamGraph.value).length, 1, 'upstream claim untouched')
  assert.equal(byGraph(sourceGraphOf(personGraph.value)).length, 1, 'owned quad in source graph')
  assert.equal(byGraph(frontierGraphOf(personGraph.value)).length, 1, 'borrowed copy in frontier graph')
  assert.equal(byGraph(ns('views/card').value).length, 1, 'view quads in the view graph')
  const graphless = emitted.filter((q) => q.graph.termType === 'DefaultGraph')
  assert.equal(graphless.length, 2, 'rest (incl. borrowed original) stays graphless')
})

test('a later claimer in the pipe cannot take an earlier claimer\'s quads', async () => {
  const person = loadClaimer(personClaimerQuads())
  const loose = loadClaimer(owningLooseClaimerQuads())

  const afterPerson = await applyClaimer({ inputQuads: inputQuads(), claimer: person })
  const afterLoose = await applyClaimer({
    inputQuads: emitClaimer(afterPerson), claimer: loose,
  })

  assert.equal(afterLoose.claimed.size, 1, 'owns the loose quad from the graphless rest')
  assert.equal(afterLoose.rest.size, 1, 'the borrowed type quad remains graphless')
  // person's source + frontier copy + view quad plus the upstream claim arrive named
  assert.equal(afterLoose.passThrough.length, 4, 'earlier claims pass through untouchable')

  const emitted = await collect(emitClaimer(afterLoose))
  const graphs = new Set(emitted.map((q) => q.graph.value))
  assert.ok(graphs.has(sourceGraphOf(personGraph.value)))
  assert.ok(graphs.has(sourceGraphOf(looseGraph.value)))
})

test('regression: two claimers over the same class both claim their content', async () => {
  // both target ex:Person, read different properties — the borrowed frontier
  // keeps the shared type quad available to the second claimer
  function metaphor (name, path) {
    const g = ns(`claimers/${name}`)
    return loadClaimer([
      rdf.quad(ns(`${name}Shape`), RDF_TYPE, SH('NodeShape'), g),
      rdf.quad(ns(`${name}Shape`), SH('targetClass'), ns('Person'), g),
      rdf.quad(ns(`${name}Shape`), SH('property'), ns(`${name}P`), g),
      rdf.quad(ns(`${name}P`), SH('path'), ns(path), g),
    ])
  }
  const input = [
    rdf.quad(ns('alice'), RDF_TYPE, ns('Person')),
    rdf.quad(ns('alice'), ns('name'), rdf.literal('Alice')),
    rdf.quad(ns('alice'), ns('born'), rdf.literal('1990')),
  ]

  const afterCard = await applyClaimer({ inputQuads: input, claimer: metaphor('card', 'name') })
  assert.equal(afterCard.claimed.size, 1, 'card owns the name quad')

  const afterTimeline = await applyClaimer({
    inputQuads: emitClaimer(afterCard), claimer: metaphor('timeline', 'born'),
  })
  assert.equal(afterTimeline.claimed.size, 1, 'timeline still finds Person targets and owns born')
  assert.equal(afterTimeline.rest.size, 1, 'the shared type quad is owned by nobody')
  assert.ok([...afterTimeline.rest][0].predicate.equals(RDF_TYPE))
})
