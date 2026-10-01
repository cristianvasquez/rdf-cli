import toNT from '@rdfjs/to-ntriples'
import { Transform } from 'node:stream'
import rdf from 'rdf-ext'

// N-Triples / N-Quads lines with RDF 1.2 terms. @rdfjs/to-ntriples 3.0.1 writes
// a triple term as a statement ("s p o .") inside the outer statement, and a
// literal with a base direction as "v"^^rdf:dirLangString (language and
// direction lost). Here: "<<( s p o )>>" and "v"@lang--dir.

export function isDirectional (term) {
  return term.termType === 'Literal' && Boolean(term.direction)
}

// "v"@lang--dir, with the escapes of to-ntriples.
export function directionalToNT (term, toText = toNT) {
  return `${toText(rdf.literal(term.value, term.language))}--${term.direction}`
}

export function termToNT (term) {
  if (term.termType === 'Quad') {
    return `<<( ${termToNT(term.subject)} ${termToNT(term.predicate)} ${termToNT(term.object)} )>>`
  }
  if (isDirectional(term)) return directionalToNT(term)
  return toNT(term)
}

// The graph is dropped when it is the default graph (N-Triples line).
export function quadToNQ (quad) {
  const graph = quad.graph.termType === 'DefaultGraph' ? '' : ` ${termToNT(quad.graph)}`
  return `${termToNT(quad.subject)} ${termToNT(quad.predicate)} ${termToNT(quad.object)}${graph} .\n`
}

export function nquadsStream () {
  return new Transform({
    writableObjectMode: true,
    transform (quad, encoding, callback) {
      callback(null, quadToNQ(quad))
    },
  })
}
