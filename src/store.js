import { Store } from 'oxigraph'
import rdf from 'rdf-ext'

function termInstance(term) {
  if (term.termType === 'Literal') return rdf.literal(term.value, term.language || term.datatype)
  if (term.termType === 'NamedNode') return rdf.namedNode(term.value)
  if (term.termType === 'BlankNode') return rdf.blankNode(term.value)
  if (term.termType === 'DefaultGraph') return rdf.defaultGraph()
  return term
}

export function datasetToStore(dataset) {
  const store = new Store()
  let dropped = 0

  for (const quad of dataset) {
    try {
      store.add(quad)
    } catch {
      dropped++
    }
  }

  if (dropped > 0) process.stderr.write(`warning: dropped ${dropped} quads\n`)
  return store
}

export function storeConstruct(store, query) {
  const dataset = rdf.dataset()
  for (const triple of store.query(query)) {
    dataset.add(rdf.quad(
      termInstance(triple.subject),
      termInstance(triple.predicate),
      termInstance(triple.object),
      rdf.defaultGraph(),
    ))
  }
  return dataset
}

export function storeSelect(store, query) {
  const rows = []
  for (const binding of store.query(query)) {
    const row = Object.fromEntries(binding)
    for (const [key, value] of Object.entries(row)) row[key] = termInstance(value)
    rows.push(row)
  }
  return rows
}
