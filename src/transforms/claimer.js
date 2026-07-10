// One claimer per document, applied once per process — the cascade IS the
// Unix pipe (spec/manifest.hs: 'Claimer', 'applyClaimer', 'emitClaimer').
//
// A claimer pairs one claim (SHACL shapes) with a fan-out of named views
// (SPARQL CONSTRUCTs). Claimed/rest is marked by graph terms, reusing the
// graph policy: the working set is the GRAPHLESS subset of the incoming
// stream; quads that already carry a named graph were claimed upstream and
// pass through untouched; claiming moves quads out of graphless space
// (source graph, view graphs) and the rest stays graphless for the next
// claimer in the pipe. Precedence is therefore pipe order, by construction —
// no order metadata exists. Making named data claimable is explicit: pipe
// `rdf graph-drop` first.
import { Readable } from 'node:stream'
import rdf from 'rdf-ext'
import { claim } from './claim.js'
import { materialize, construct } from './sparql.js'

// view metadata predicate for the TriG claimer document 'loadClaimer' parses
// (same urn:rdf-cli:* convention as scripts/manifest.js).
const CLAIMER_NS = 'urn:rdf-cli:cascade#'
const VIEW_QUERY = `${CLAIMER_NS}query`

// Parse a claimer document: exactly ONE named graph (the claimer), holding
// the shapes plus the views. Each view is a subject carrying a cascade:query
// value; the subject IRI names the graph its output lands in. Views are
// sorted by IRI — the fan-out is commutative, sorting only keeps the wire
// deterministic.
export function loadClaimer (quads, factory = rdf) {
  const all = [...quads]
  const graphs = new Map()
  for (const quad of all) {
    if (quad.graph.termType === 'DefaultGraph') continue
    graphs.set(quad.graph.value, quad.graph)
  }
  if (graphs.size !== 1) {
    throw new Error(
      `a claimer document defines exactly one claimer (one named graph); found ${graphs.size}`)
  }
  const [graph] = graphs.values()

  const views = all.
    filter((quad) => quad.predicate.value === VIEW_QUERY).
    map((quad) => {
      if (quad.subject.termType !== 'NamedNode') {
        throw new Error('a view subject must be an IRI: it names the output graph')
      }
      return { graph: quad.subject, query: quad.object.value }
    }).
    sort((left, right) => left.graph.value < right.graph.value ? -1 : 1)

  const shapes = factory.dataset(all.
    filter((quad) => !quad.predicate.value.startsWith(CLAIMER_NS)).
    map((quad) => factory.quad(quad.subject, quad.predicate, quad.object)))

  return { graph, shapes, views }
}

// `graph:source` — where a claimer's claimed input is preserved for provenance.
export function sourceGraphOf (graphIri) {
  return `${graphIri}:source`
}

// Fan-out law (spec 'projectView'): every view reads the SAME claimed set —
// one materialization, independent queries, each deduped into a dataset. An
// empty result means "this view matched nothing"; the view still emits.
async function runViews (views, claimed, factory) {
  if (views.length === 0) return []
  const store = await materialize(claimed)
  const results = []
  for (const view of views) {
    const quads = []
    for await (const quad of construct(store, view.query)) {
      quads.push(factory.quad(quad.subject, quad.predicate, quad.object))
    }
    results.push({ graph: view.graph, quads: factory.dataset(quads) })
  }
  return results
}

// Apply one claimer to the wire: split off the graphless working set, claim
// from it, fan the views out over the claimed side. Laws (spec 'Split'):
// claimed ∪ rest = working, claimed ∩ rest = ∅ — sound because the working
// set is graphless by construction here.
export async function applyClaimer ({ inputQuads, claimer, factory = rdf }) {
  const working = factory.dataset()
  const passThrough = []
  for await (const quad of inputQuads) {
    if (quad.graph.termType === 'DefaultGraph') working.add(quad)
    else passThrough.push(quad)
  }

  const { claimed, remaining } = await claim({ shapes: claimer.shapes, working, factory })
  const views = await runViews(claimer.views, claimed, factory)
  return { claimer, claimed, views, rest: remaining, passThrough }
}

function * emitQuads ({ claimer, claimed, views, rest, passThrough }, factory) {
  yield * passThrough

  const sourceGraph = factory.namedNode(sourceGraphOf(claimer.graph.value))
  for (const quad of claimed) {
    yield factory.quad(quad.subject, quad.predicate, quad.object, sourceGraph)
  }

  for (const { graph, quads } of views) {
    for (const quad of quads) {
      yield factory.quad(quad.subject, quad.predicate, quad.object, graph)
    }
  }

  yield * rest
}

// Serialize the wire channels (passThrough ‖ source ‖ views ‖ rest) into one
// QuadStream — the same stream shape every other transform produces.
export function emitClaimer (result, { factory = rdf } = {}) {
  return Readable.from(emitQuads(result, factory), { objectMode: true })
}
