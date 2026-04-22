import trigWrite from '@graphy/content.trig.write'
import ttlWrite from '@graphy/content.ttl.write'
import getStream from 'get-stream'

export const TURTLE = 'text/turtle'
export const TRIG = 'application/trig'

function termToConcise(term) {
  switch (term.termType) {
    case 'NamedNode':
      return `>${term.value}`
    case 'BlankNode':
      return `_:${term.value}`
    case 'Literal':
      if (term.language) return `@${term.language}"${term.value}`
      if (term.datatype && term.datatype.value !== 'http://www.w3.org/2001/XMLSchema#string') {
        return `^>${term.datatype.value}"${term.value}`
      }
      return `"${term.value}`
    case 'DefaultGraph':
      return '*'
    default:
      return `>${term.value}`
  }
}

function addQuad(target, quad) {
  const subject = termToConcise(quad.subject)
  const predicate = termToConcise(quad.predicate)
  const object = termToConcise(quad.object)

  target[subject] ??= {}
  target[subject][predicate] ??= []
  target[subject][predicate].push(object)
}

function datasetToC3R(dataset) {
  const triples = {}
  for (const quad of dataset) {
    addQuad(triples, quad)
  }
  return triples
}

function datasetToC4R(dataset) {
  const quads = {}
  for (const quad of dataset) {
    const graph = termToConcise(quad.graph)
    quads[graph] ??= {}
    addQuad(quads[graph], quad)
  }
  return quads
}

async function writerToString(writer, event) {
  writer.write(event)
  writer.end()
  return getStream(writer)
}

async function toTurtleString(dataset, prefixes = {}) {
  for (const quad of dataset) {
    if (quad.graph.termType !== 'DefaultGraph') {
      throw new Error('turtle output requires graphless input; use graph-drop first')
    }
  }

  const writer = ttlWrite({ prefixes })
  return writerToString(writer, { type: 'c3r', value: datasetToC3R(dataset) })
}

async function toTrigString(dataset, prefixes = {}) {
  const writer = trigWrite({ prefixes })
  const hasNamedGraphs = [...dataset].some(quad => quad.graph.termType !== 'DefaultGraph')
  return writerToString(
    writer,
    hasNamedGraphs
      ? { type: 'c4r', value: datasetToC4R(dataset) }
      : { type: 'c3r', value: datasetToC3R(dataset) },
  )
}

export async function datasetToString(dataset, { format, prefixes }) {
  return format === TRIG
    ? toTrigString(dataset, prefixes)
    : toTurtleString(dataset, prefixes)
}
