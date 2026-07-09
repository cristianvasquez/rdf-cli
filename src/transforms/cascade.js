// Claim-and-construct cascade (spec/manifest.hs: 'Cascade', 'runCascade', 'emitCascade').
//
// A cascade is an ordered list of modules ('SomeProjection' at the type level).
// Each module pairs a SHACL shapes graph with an optional SPARQL CONSTRUCT.
// For every module, in order:
//
//   1. claim: 'claim.js' reports exactly which quads of the current working
//      set the shapes read (coverage + the target patch), and splits the
//      working set into that claimed side and the remainder.
//   2. construct: the module's CONSTRUCT runs over the claimed quads only —
//      sandboxed, so its WHERE stays minimal and cannot overreach the claim.
//   3. the remainder becomes the working set for the next module.
//
// Whatever no module claims is the final pass-through. 'runCascade' computes
// the three channels (per-module claimed/view, plus pass-through) as data —
// this step needs the working set materialized, since SHACL coverage matches
// against the whole dataset. 'emitCascade' is the separate serialization step
// that assigns graph names and streams the result out as a QuadStream, same
// as every other transform in this package; callers decide where view quads
// land via 'routeView'.
import { Readable } from 'node:stream'
import rdf from 'rdf-ext'
import { claim } from './claim.js'
import { materialize, construct } from './sparql.js'

// module:order / module:construct metadata predicates for the TriG modules
// graph 'loadModules' parses (same urn:rdf-cli:* convention as scripts/manifest.js).
const MODULE_NS = 'urn:rdf-cli:cascade#'
const MODULE_ORDER = `${MODULE_NS}order`
const MODULE_CONSTRUCT = `${MODULE_NS}construct`

function moduleMetadataValue (quads, predicateIri) {
  return quads.find((quad) => quad.predicate.value === predicateIri)?.object
}

// Parse a TriG-style modules graph: each named graph is one module, carrying
// module:order / module:construct metadata plus the shapes themselves.
export function loadModules (quads, factory = rdf) {
  const modulesByGraph = new Map()

  for (const quad of quads) {
    if (quad.graph.termType === 'DefaultGraph') continue
    const graphId = quad.graph.value
    const current = modulesByGraph.get(graphId) ?? { graph: quad.graph, quads: [] }
    current.quads.push(quad)
    modulesByGraph.set(graphId, current)
  }

  return [...modulesByGraph.values()].map(({ graph, quads: moduleQuads }) => {
    const orderTerm = moduleMetadataValue(moduleQuads, MODULE_ORDER)
    const constructTerm = moduleMetadataValue(moduleQuads, MODULE_CONSTRUCT)
    const shapes = factory.dataset(
      moduleQuads.filter((quad) => !quad.predicate.value.startsWith(MODULE_NS)).
        map((quad) => factory.quad(quad.subject, quad.predicate, quad.object)))

    return {
      graph,
      order: Number(orderTerm?.value ?? 0),
      construct: constructTerm?.value ?? '',
      shapes,
    }
  }).sort((left, right) => left.order - right.order)
}

// `graph:source` — where a module's claimed input is preserved for provenance.
export function sourceGraphOf (graphIri) {
  return `${graphIri}:source`
}

async function runConstruct (query, claimed, factory) {
  if (!query) return factory.dataset()
  const store = await materialize(claimed)
  // CONSTRUCT repeats its template per solution; dedupe through a dataset.
  const quads = []
  for await (const quad of construct(store, query)) {
    quads.push(factory.quad(quad.subject, quad.predicate, quad.object))
  }
  return factory.dataset(quads)
}

// One claim/construct step. 'view' is null when the module has no CONSTRUCT
// (claim/source only, matching 'projectionConstructs :: Maybe Constructs').
async function cascadeStep (working, module, factory) {
  const { claimed, remaining } = await claim({ shapes: module.shapes, working, factory })
  const constructed = await runConstruct(module.construct, claimed, factory)
  const view = constructed.size > 0 ? constructed : null
  return { step: { module, claimed, view }, remaining }
}

// Fold every module over the working set, threading the remainder forward.
// Snapshots handed to 'onModule' are copies: the working set keeps mutating
// across steps, so a live reference would go stale under the callback.
export async function runCascade ({ inputQuads, modules, factory = rdf, onModule }) {
  let working = factory.dataset()
  for await (const quad of inputQuads) working.add(quad)
  const steps = []

  for (const module of modules) {
    const { step, remaining } = await cascadeStep(working, module, factory)
    steps.push(step)
    onModule?.({
      module,
      claimed: factory.dataset([...step.claimed]),
      view: step.view ? factory.dataset([...step.view]) : null,
      remaining: factory.dataset([...remaining]),
    })
    working = remaining
  }

  return { steps, passThrough: working }
}

// 'routeView(quad, module)' picks the graph for a view quad; defaults to the
// module's own graph. Source quads always land in 'sourceGraphOf(module.graph)';
// pass-through quads are emitted unchanged.
function * emitQuads ({ steps, passThrough }, { routeView, factory = rdf } = {}) {
  for (const { module, claimed, view } of steps) {
    const sourceGraph = factory.namedNode(sourceGraphOf(module.graph.value))
    for (const quad of claimed) {
      yield factory.quad(quad.subject, quad.predicate, quad.object, sourceGraph)
    }

    if (view) {
      const defaultViewGraph = factory.namedNode(module.graph.value)
      for (const quad of view) {
        yield factory.quad(
          quad.subject,
          quad.predicate,
          quad.object,
          routeView ? routeView(quad, module) : defaultViewGraph,
        )
      }
    }
  }

  yield * passThrough
}

// Serialize the logical channels (per-module source/view, pass-through) into
// one QuadStream — the same stream shape every other transform in this
// package produces and consumes.
export function emitCascade (result, options) {
  return Readable.from(emitQuads(result, options), { objectMode: true })
}
