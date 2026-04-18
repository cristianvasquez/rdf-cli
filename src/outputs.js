import { TrigSerializer, TurtleSerializer } from '@rdfjs-elements/formats-pretty'
import getStream from 'get-stream'
import rdf from 'rdf-ext'
import { Readable } from 'node:stream'

export const TURTLE = 'text/turtle'
export const TRIG = 'application/trig'

async function combineInSink(sink, dataset, mapQuad = quad => quad) {
  const stream = new Readable({
    objectMode: true,
    read() {},
  })

  dataset.forEach(quad => stream.push(mapQuad(quad)))
  stream.push(null)
  return sink.import(stream)
}

async function toTurtleString(dataset, prefixes = {}) {
  const serializer = new TurtleSerializer({ prefixes })
  const stream = await combineInSink(
    serializer,
    dataset,
    quad => rdf.quad(quad.subject, quad.predicate, quad.object),
  )
  return getStream(stream)
}

async function toTrigString(dataset, prefixes = {}) {
  const serializer = new TrigSerializer({ prefixes })
  const stream = await combineInSink(serializer, dataset)
  return getStream(stream)
}

export async function datasetToString(dataset, { format, prefixes }) {
  return format === TRIG
    ? toTrigString(dataset, prefixes)
    : toTurtleString(dataset, prefixes)
}
