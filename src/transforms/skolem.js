import { Transform } from 'node:stream'
import rdf from 'rdf-ext'

export const DEFAULT_SKOLEM_BASE_IRI = 'https://rdf-viz.local/.well-known/genid/'

function normalizeSkolemBaseIri (skolemBaseIri) {
  if (skolemBaseIri === false || skolemBaseIri == null || skolemBaseIri === '') {
    return null
  }

  const iri = String(skolemBaseIri)
  return iri.endsWith('/') ? iri : `${iri}/`
}

function randomId () {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

export function createSkolemizer (skolemBaseIri = DEFAULT_SKOLEM_BASE_IRI) {
  const baseIri = normalizeSkolemBaseIri(skolemBaseIri)
  if (!baseIri) return null

  const blankNodes = rdf.termMap()

  const skolemizeTerm = (term) => {
    if (!term || term.termType !== 'BlankNode') return term

    if (!blankNodes.has(term)) {
      blankNodes.set(term, rdf.namedNode(`${baseIri}${randomId()}`))
    }

    return blankNodes.get(term)
  }

  return (quad) => rdf.quad(
    skolemizeTerm(quad.subject),
    skolemizeTerm(quad.predicate),
    skolemizeTerm(quad.object),
    skolemizeTerm(quad.graph),
  )
}

export function skolemizeDataset (dataset, { skolemBaseIri = DEFAULT_SKOLEM_BASE_IRI } = {}) {
  const skolemizeQuad = createSkolemizer(skolemBaseIri)
  if (!skolemizeQuad) return dataset

  const result = rdf.dataset()
  for (const quad of dataset) {
    result.add(skolemizeQuad(quad))
  }

  return result
}

export function skolemize (skolemBaseIri = DEFAULT_SKOLEM_BASE_IRI) {
  const skolemizeQuad = createSkolemizer(skolemBaseIri)

  return new Transform({
    objectMode: true,
    transform (quad, _encoding, callback) {
      callback(null, skolemizeQuad ? skolemizeQuad(quad) : quad)
    },
  })
}
