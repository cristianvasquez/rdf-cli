// Claim = shacl-engine coverage + the target-navigation patch.
//
// Coverage marks a quad claimed when a constraint reads its value. Target
// resolution also READS quads (?focus rdf:type C for sh:targetClass, the
// (s, p, o) triples for sh:targetSubjectsOf / sh:targetObjectsOf) but those
// reads never land in the coverage report — that gap is why claim modules
// used to carry [ sh:path rdf:type ] boilerplate. Patching it here, outside
// the engine, removes both.
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

// Split `working` into the quads the shapes claim and the quads that don't.
// Laws (spec/manifest.hs Split): claimed ∪ remaining = working, claimed ∩ remaining = ∅.
// Precondition: `working` is graphless (spec 'WorkingSet') — applyClaimer
// guarantees it by selecting the graphless subset of the wire. Named-graph
// quads would break both laws: coverage comes back as bare triples that no
// longer match the originals.
export async function claim ({ shapes, working, factory = rdf }) {
  const validator = new Validator(shapes, { coverage: true, factory })
  const report = await validator.validate({ dataset: working })

  // coverage quads flattened to (s, p, o), matching the default-graph working set
  const claimed = factory.dataset(report.coverage().map((quad) =>
    factory.quad(quad.subject, quad.predicate, quad.object)))

  // target patch: claim the quads target resolution read
  const targets = shapeTargets(shapes)
  const typeTerm = factory.namedNode(RDF_TYPE)
  for (const cls of targets.classes) {
    for (const quad of working.match(null, typeTerm, cls)) claimed.add(quad)
  }
  for (const p of targets.subjectsOf) {
    for (const quad of working.match(null, p, null)) claimed.add(quad)
  }
  for (const p of targets.objectsOf) {
    for (const quad of working.match(null, p, null)) claimed.add(quad)
  }

  const remaining = factory.dataset([...working].filter((quad) => !claimed.has(quad)))
  return { claimed, remaining }
}
