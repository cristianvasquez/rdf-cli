import { Store } from 'oxigraph'
import { Readable } from 'node:stream'
import rdf from 'rdf-ext'

function termInstance (term) {
  if (term.termType === 'Literal')
    return rdf.literal(term.value, term.language || term.datatype)
  if (term.termType === 'NamedNode') return rdf.namedNode(term.value)
  if (term.termType === 'BlankNode') return rdf.blankNode(term.value)
  if (term.termType === 'DefaultGraph') return rdf.defaultGraph()
  return term
}

// Drain a quad stream into an oxigraph store. This is the single materialization
// point: one store can then feed many query ops instead of each op re-draining.
export async function materialize (source) {
  const store = new Store()
  let dropped = 0
  for await (const quad of source) {
    try {
      store.add(quad)
    } catch {
      dropped++
    }
  }
  if (dropped > 0) process.stderr.write(`warning: dropped ${dropped} quads\n`)
  return store
}

// Copy a store back into an rdf-ext dataset (e.g. for shacl-engine, which needs a
// dataset rather than a SPARQL store). Terms are re-instantiated as rdf-ext terms.
export function storeToDataset (store) {
  const dataset = rdf.dataset()
  for (const quad of store.match()) {
    dataset.add(
      rdf.quad(
        termInstance(quad.subject),
        termInstance(quad.predicate),
        termInstance(quad.object),
        termInstance(quad.graph),
      ),
    )
  }
  return dataset
}

function * constructQuads (store, query) {
  for (const triple of store.query(query)) {
    yield rdf.quad(
      termInstance(triple.subject),
      termInstance(triple.predicate),
      termInstance(triple.object),
      rdf.defaultGraph(),
    )
  }
}

function * selectBindings (store, query) {
  for (const binding of store.query(query)) {
    const row = Object.fromEntries(binding)
    for (const [key, value] of Object.entries(row)) row[key] = termInstance(value)
    yield row
  }
}

// SPARQL CONSTRUCT over a materialized store. Output is graphless.
export function construct (store, query) {
  return Readable.from(constructQuads(store, query), { objectMode: true })
}

// SPARQL SELECT over a materialized store. Leaves RDF space, yields bindings rows.
export function select (store, query) {
  return selectBindings(store, query)
}
