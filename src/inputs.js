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

function guessMimeType (filePath) {
  return MIME_TYPES[filePath.slice(filePath.lastIndexOf('.'))]
}

function resolveMimeType (filePath, mimeType) {
  return mimeType || guessMimeType(filePath)
}

export function pathToFileGraph (path) {
  const normalized = path.replace(/\\/g, '/')
  if (/^[a-zA-Z]:/.test(normalized))
    return rdf.namedNode(`file:///${normalized}`)
  return rdf.namedNode(
    `file://${normalized.startsWith('/') ? '' : './'}${normalized}`,
  )
}

export function streamFileQuads (filePath, mimeType) {
  const resolvedMimeType = resolveMimeType(filePath, mimeType)
  if (!resolvedMimeType) {
    throw new Error('I don\'t know how to parse')
  }

  return formats.parsers.import(
    resolvedMimeType,
    createReadStream(filePath, 'utf8'),
  )
}

export async function parseFile (filePath, mimeType) {
  const dataset = rdf.dataset()

  try {
    await dataset.import(streamFileQuads(filePath, mimeType))

    return { path: filePath, dataset }
  } catch (error) {
    return { path: filePath, error }
  }
}

function assignDefaultGraph (graph) {
  return (quad) =>
    rdf.quad(
      quad.subject,
      quad.predicate,
      quad.object,
      quad.graph.termType === 'DefaultGraph' ? graph : quad.graph,
    )
}

// Merge the RDF files named by `paths` (an array or async iterable of path
// strings) into a single quad stream. With graphFrom === "path", each file's
// default-graph triples are placed in a named graph derived from its path.
// Per-file parse errors are reported via onError and skipped.
export async function * quadsFromPaths (
  paths,
  { format, graphFrom, onError } = {},
) {
  for await (const file of paths) {
    const map =
      graphFrom === 'path' ? assignDefaultGraph(pathToFileGraph(file)) : null
    try {
      for await (const quad of streamFileQuads(file, format)) {
        yield map ? map(quad) : quad
      }
    } catch (error) {
      onError?.(file, error)
    }
  }
}
