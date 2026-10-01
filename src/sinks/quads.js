import formats from '@rdfjs/formats'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { NQUADS, NTRIPLES } from '../formats.js'
import { nquadsStream } from '../serializers/ntriples.js'

export function toReadable (source) {
  return source instanceof Readable ? source : Readable.from(source, { objectMode: true })
}

export async function writeQuads (source, { format = NQUADS } = {}) {
  const quads = toReadable(source)
  // N-Triples and N-Quads: own writer, for RDF 1.2 triple terms (serializers/ntriples.js).
  const bytes = format === NQUADS || format === NTRIPLES ? quads.pipe(nquadsStream()) : formats.serializers.import(format, quads)
  await pipeline(bytes, process.stdout, { end: false })
}
