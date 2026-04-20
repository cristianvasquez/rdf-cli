import formats from '@rdfjs/formats'
import { createReadStream } from 'node:fs'
import rdf from 'rdf-ext'

const MIME_TYPES = {
  '.jsonld': 'application/ld+json',
  '.trig': 'application/trig',
  '.nq': 'application/n-quads',
  '.nt': 'application/n-triples',
  '.n3': 'text/n3',
  '.ttl': 'text/turtle',
  '.rdf': 'application/rdf+xml',
}

function guessMimeType(filePath) {
  return MIME_TYPES[filePath.slice(filePath.lastIndexOf('.'))]
}

function defaultGraphFactory() {
  return rdf.defaultGraph()
}

export async function parseFile(filePath, graphFactory = defaultGraphFactory) {
  const dataset = rdf.dataset()

  try {
    const mimeType = guessMimeType(filePath)
    if (!mimeType) {
      return { path: filePath, error: "I don't know how to parse" }
    }

    await dataset.import(formats.parsers.import(mimeType, createReadStream(filePath, 'utf8')))
    for (const quad of [...dataset]) {
      if (quad.graph.termType === 'DefaultGraph') {
        quad.graph = graphFactory(filePath)
      }
    }

    return { path: filePath, dataset }
  } catch (error) {
    return { path: filePath, error }
  }
}
