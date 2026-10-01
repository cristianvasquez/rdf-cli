import { createInterface } from 'node:readline'
import rdf from 'rdf-ext'

export async function collectDataset (source) {
  const dataset = rdf.dataset()
  for await (const quad of source) dataset.add(quad)
  return dataset
}

export async function * readLines (stream) {
  const rl = createInterface({ input: stream, crlfDelay: Infinity })
  for await (const line of rl) {
    const trimmed = line.trim()
    if (trimmed) yield trimmed
  }
}

// Apply fn to each non-triple-term term; RDF 1.2 triple terms (termType Quad)
// are rebuilt with fn applied to their subject, predicate and object.
export function mapTerm (term, fn) {
  if (term.termType !== 'Quad') return fn(term)
  return rdf.quad(mapTerm(term.subject, fn), mapTerm(term.predicate, fn), mapTerm(term.object, fn))
}

// The terms of a quad, with the terms inside triple terms (depth first).
export function * termsOf (quad) {
  for (const term of [quad.subject, quad.predicate, quad.object, quad.graph]) {
    yield term
    if (term.termType === 'Quad') yield * termsOf(term)
  }
}
