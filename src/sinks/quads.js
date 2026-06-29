import formats from '@rdfjs/formats'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { NQUADS } from '../formats.js'

export function toReadable (source) {
  return source instanceof Readable ? source : Readable.from(source, { objectMode: true })
}

export async function writeQuads (source, { format = NQUADS } = {}) {
  const quads = toReadable(source)
  const bytes = formats.serializers.import(format, quads)
  await pipeline(bytes, process.stdout, { end: false })
}
