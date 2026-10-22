// Claim = owned + borrowed (spec/manifest.hs 'ClaimSplit').
//
// Owned ('claimed'): quads a constraint read — shacl-engine coverage. These
// leave graphless space.
// Borrowed ('frontier'): quads target resolution read (?focus rdf:type C for
// sh:targetClass, the (s, p, o) triples for sh:targetSubjectsOf /
// sh:targetObjectsOf). The engine never puts those reads in coverage, so they
// are collected here. They feed the views but STAY in the remainder — taking
// navigation quads would starve later claimers of shared vocabulary like
// rdf:type. A shape that wants to own its target quads says so with an
// explicit constraint (e.g. [ sh:path rdf:type ]), which lands them in
// coverage.
import rdf from 'rdf-ext'
import { Validator } from 'shacl-engine'

const SH = 'http://www.w3.org/ns/shacl#'
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'

function shapeTargets (shapes) {
  const targets = { classes: [], subjectsOf: [], objectsOf: [] }
  for (const quad of shapes) {
    if (quad.predicate.value === `${SH}targetClass`) targets.classes.push(quad.object)
    if (quad.predicate.value === `${SH}targetSubjectsOf`) targets.subjectsOf.push(quad.object)
    if (quad.predicate.value === `${SH}targetObjectsOf`) targets.objectsOf.push(quad.object)
  }
  return targets
}

// Split `working` into { claimed, frontier, remaining }.
// Laws (spec/manifest.hs ClaimSplit): claimed ∪ remaining = working,
// claimed ∩ remaining = ∅, frontier ⊆ remaining, frontier ∩ claimed = ∅.
// Precondition: `working` is graphless (spec 'WorkingSet') — applyClaimer
// guarantees it by selecting the graphless subset of the wire. Named-graph
// quads would break the partition laws: coverage comes back as bare triples
// that no longer match the originals.
export async function claim ({ shapes, working, factory = rdf }) {
  const validator = new Validator(shapes, { coverage: true, factory })
  const report = await validator.validate({ dataset: working })

  // owned: coverage quads flattened to (s, p, o)
  const claimed = factory.dataset(report.coverage().map((quad) =>
    factory.quad(quad.subject, quad.predicate, quad.object)))

  // borrowed: the quads target resolution read, minus anything owned
  const targets = shapeTargets(shapes)
  const typeTerm = factory.namedNode(RDF_TYPE)
  const frontier = factory.dataset()
  for (const cls of targets.classes) {
    for (const quad of working.match(null, typeTerm, cls)) frontier.add(quad)
  }
  for (const p of targets.subjectsOf) {
    for (const quad of working.match(null, p, null)) frontier.add(quad)
  }
  for (const p of targets.objectsOf) {
    for (const quad of working.match(null, p, null)) frontier.add(quad)
  }
  for (const quad of claimed) frontier.delete(quad)

  const remaining = factory.dataset([...working].filter((quad) => !claimed.has(quad)))
  return { claimed, frontier, remaining }
}
