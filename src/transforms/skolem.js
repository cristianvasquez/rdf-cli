import { Transform } from 'node:stream'
import rdf from 'rdf-ext'
import { mapTerm } from '../utils.js'

export const DEFAULT_SKOLEM_BASE_IRI = 'https://rdf-viz.local/.well-known/genid/'

function randomId () {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

// Replace blank nodes with generated IRIs under `baseIri`. The same blank node
// maps to the same IRI within a single run.
export function skolemize (baseIri = DEFAULT_SKOLEM_BASE_IRI) {
  const base = baseIri.endsWith('/') ? baseIri : `${baseIri}/`
  const blankNodes = rdf.termMap()

  // Blank nodes inside triple terms get the same IRI as outside.
  const map = (term) => mapTerm(term, (t) => {
    if (t.termType !== 'BlankNode') return t
    if (!blankNodes.has(t)) blankNodes.set(t, rdf.namedNode(`${base}${randomId()}`))
    return blankNodes.get(t)
  })

  return new Transform({
    objectMode: true,
    transform (quad, _encoding, callback) {
      callback(null, rdf.quad(map(quad.subject), map(quad.predicate), map(quad.object), map(quad.graph)))
    },
  })
}
