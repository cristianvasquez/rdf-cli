import formats from '@rdfjs/formats'
import { createReadStream } from 'node:fs'
import rdf from 'rdf-ext'
import { guessMimeType } from './io.js'

export function pathToFileGraph (path) {
  const normalized = path.replace(/\\/g, '/')
  if (/^[a-zA-Z]:/.test(normalized)) return rdf.namedNode(`file:///${normalized}`)
  return rdf.namedNode(
    `file://${normalized.startsWith('/') ? '' : './'}${normalized}`,
  )
}

export function streamFileQuads (filePath, mimeType) {
  const resolved = mimeType || guessMimeType(filePath)
  if (!resolved) throw new Error(`unknown format for ${filePath}`)
  return formats.parsers.import(resolved, createReadStream(filePath, 'utf8'))
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
export async function * quadsFromPaths (paths, { format, graphFrom, onError } = {}) {
  for await (const file of paths) {
    const map = graphFrom === 'path' ? assignDefaultGraph(pathToFileGraph(file)) : null
    try {
      for await (const quad of streamFileQuads(file, format)) {
        yield map ? map(quad) : quad
      }
    } catch (error) {
      onError?.(file, error)
    }
  }
}
