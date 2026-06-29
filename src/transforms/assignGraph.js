import { Transform } from 'node:stream'
import rdf from 'rdf-ext'

export function assignGraph (iri) {
  const graph = rdf.namedNode(iri)
  return new Transform({
    objectMode: true,
    transform (quad, _encoding, callback) {
      callback(
        null,
        quad.graph.termType === 'DefaultGraph'
          ? rdf.quad(quad.subject, quad.predicate, quad.object, graph)
          : quad,
      )
    },
  })
}
