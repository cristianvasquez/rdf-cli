import toNT from '@rdfjs/to-ntriples'
import { Transform } from 'node:stream'

// N-Triples / N-Quads lines with RDF 1.2 triple terms. @rdfjs/to-ntriples 3.0.1
// writes a triple term as a statement ("s p o .") inside the outer statement;
// here a triple term is written as "<<( s p o )>>".

export function termToNT (term) {
  if (term.termType === 'Quad') {
    return `<<( ${termToNT(term.subject)} ${termToNT(term.predicate)} ${termToNT(term.object)} )>>`
  }
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
