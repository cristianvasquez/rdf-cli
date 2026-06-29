import { Transform } from 'node:stream'
import rdf from 'rdf-ext'

export function dropGraph () {
  return new Transform({
    objectMode: true,
    transform (quad, _encoding, callback) {
      callback(
        null,
        rdf.quad(quad.subject, quad.predicate, quad.object, rdf.defaultGraph()),
      )
    },
  })
}
