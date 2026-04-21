import trigWrite from '@graphy/content.trig.write'
import ttlWrite from '@graphy/content.ttl.write'
import getStream from 'get-stream'
import rdf from 'rdf-ext'
import { Readable } from 'node:stream'

export const TURTLE = 'text/turtle'
export const TRIG = 'application/trig'

function datasetToStream(dataset, mapQuad = quad => quad) {
  const stream = new Readable({
    objectMode: true,
    read() {},
  })

  dataset.forEach(quad => stream.push(mapQuad(quad)))
  stream.push(null)
  return stream
}

async function toTurtleString(dataset, prefixes = {}) {
  const writer = ttlWrite({ prefixes })
  datasetToStream(
    dataset,
    quad => rdf.quad(quad.subject, quad.predicate, quad.object),
  ).pipe(writer)
  return getStream(writer)
}

async function toTrigString(dataset, prefixes = {}) {
  const writer = trigWrite({ prefixes })
  datasetToStream(dataset).pipe(writer)
  return getStream(writer)
}

export async function datasetToString(dataset, { format, prefixes }) {
  return format === TRIG
    ? toTrigString(dataset, prefixes)
    : toTurtleString(dataset, prefixes)
}
