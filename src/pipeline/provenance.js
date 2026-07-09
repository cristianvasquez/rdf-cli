import rdf from 'rdf-ext'

// Render a history array (the OpResults from a run) to PROV-O RDF. Each op becomes a
// prov:Activity that generates a prov:Entity; input edges become prov:used (activity →
// input entity) and prov:wasDerivedFrom (entity → input entity). Measured meta lands on
// the activity under the urn:rdf-cli:prov# namespace.
//
// Provenance is RDF, so the result composes straight back into the tool (e.g. render it
// with sinks.datasetToString, or query it with a SPARQL SELECT).

const prov = rdf.namespace('http://www.w3.org/ns/prov#')
const rdfs = rdf.namespace('http://www.w3.org/2000/01/rdf-schema#')
const xsd = rdf.namespace('http://www.w3.org/2001/XMLSchema#')
const cli = rdf.namespace('urn:rdf-cli:prov#')
const activity = rdf.namespace('urn:rdf-cli:activity:')
const entity = rdf.namespace('urn:rdf-cli:entity:')
const rdfType = rdf.namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#').type

const int = (v) => rdf.literal(String(v), xsd.integer)
const bool = (v) => rdf.literal(String(v), xsd.boolean)
const dateTime = (v) => rdf.literal(v, xsd.dateTime)

export function provenanceToDataset (history) {
  const dataset = rdf.dataset()
  const add = (s, p, o) => dataset.add(rdf.quad(s, p, o))

  for (const { opId, kind, inputs = [], meta = {} } of history) {
    const act = activity[opId]
    const ent = entity[opId]

    add(act, rdfType, prov.Activity)
    add(act, rdfs.label, rdf.literal(kind))

    if (meta.startedAt) {
      add(act, prov.startedAtTime, dateTime(meta.startedAt))
      if (typeof meta.durationMs === 'number') {
        const ended = new Date(Date.parse(meta.startedAt) + meta.durationMs).toISOString()
        add(act, prov.endedAtTime, dateTime(ended))
      }
    }
    if (typeof meta.durationMs === 'number') add(act, cli.durationMs, int(meta.durationMs))
    if (typeof meta.quadsIn === 'number') add(act, cli.quadsIn, int(meta.quadsIn))
    if (typeof meta.quadsOut === 'number') add(act, cli.quadsOut, int(meta.quadsOut))
    if (typeof meta.droppedIn === 'number') add(act, cli.droppedIn, int(meta.droppedIn))
    if (typeof meta.passed === 'boolean') add(act, cli.passed, bool(meta.passed))
    if (meta.validation) {
      add(act, cli.conforms, bool(meta.validation.conforms))
      add(act, cli.violationCount, int(meta.validation.violationCount))
    }

    add(ent, rdfType, prov.Entity)
    add(ent, prov.wasGeneratedBy, act)

    for (const inputId of inputs) {
      add(act, prov.used, entity[inputId])
      add(ent, prov.wasDerivedFrom, entity[inputId])
    }
  }

  return dataset
}
