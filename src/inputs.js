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

export function pathToFileGraph(path) {
  const normalized = path.replace(/\\/g, '/')
  if (/^[a-zA-Z]:/.test(normalized)) return rdf.namedNode(`file:///${normalized}`)
  return rdf.namedNode(`file://${normalized.startsWith('/') ? '' : './'}${normalized}`)
}

export async function parseFile(filePath) {
  const dataset = rdf.dataset()

  try {
    const mimeType = guessMimeType(filePath)
    if (!mimeType) {
      return { path: filePath, error: "I don't know how to parse" }
    }

    await dataset.import(formats.parsers.import(mimeType, createReadStream(filePath, 'utf8')))

    return { path: filePath, dataset }
  } catch (error) {
    return { path: filePath, error }
  }
}
