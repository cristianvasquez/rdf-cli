import { Store } from 'oxigraph'
import rdf from 'rdf-ext'

function createTriplestore ({ assets }) {
  const store = new Store()
  const dropped = []
  for (const { dataset } of assets.filter(x => x.dataset)) {
    for (const quad of [...dataset]) {
      try {
        store.add(quad)
      } catch (error) {
        // Oxigraph rejects some quads (e.g. relative IRIs like 'locn.svg' as object)
        dropped.push({ quad, error })
      }
    }
  }
  return { store, dropped }
}

function doSelect ({ store, query }) {
  const result = []
  for (const binding of store.query(query)) {
    const item = Object.fromEntries(binding)
    for (const [varName, term] of Object.entries(item)) {
      item[varName] = termInstance(term)
    }
    result.push(item)
  }
  return result
}

function doConstruct ({ store, query }) {
  const result = rdf.dataset()
  for (const current of store.query(query)) {
    const quad = rdf.quad(termInstance(current.subject),
      termInstance(current.predicate), termInstance(current.object), rdf.defaultGraph())
    result.add(quad)
  }
  return result
}

// Oxigraph terms must be converted to rdf-ext instances before use,
// as accessing .value multiple times on Oxigraph terms can hang.
function termInstance (term) {
  if (term.termType === 'Literal') {
    return rdf.literal(term.value, term.language || term.datatype)
  } else if (term.termType === 'NamedNode') {
    return rdf.namedNode(term.value)
  } else if (term.termType === 'BlankNode') {
    return rdf.blankNode(term.value)
  } else if (term.termType === 'DefaultGraph') {
    return rdf.defaultGraph()
  } else {
    // Handle other RDF term types as needed
    return term
  }
}

export { createTriplestore, doSelect, doConstruct }
