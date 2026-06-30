import formats from '@rdfjs/formats'
import { createReadStream } from 'node:fs'
import { glob } from 'glob'
import rdf from 'rdf-ext'
import { guessMimeType } from '../formats.js'

export function streamFileQuads (filePath, mimeType) {
  const resolved = mimeType || guessMimeType(filePath)
  if (!resolved) throw new Error(`unknown format for ${filePath}`)
  return formats.parsers.import(resolved, createReadStream(filePath, 'utf8'))
}

function pathToFileGraph (path) {
  const normalized = path.replace(/\\/g, '/')
  if (/^[a-zA-Z]:/.test(normalized)) return rdf.namedNode(`file:///${normalized}`)
  return rdf.namedNode(
    `file://${normalized.startsWith('/') ? '' : './'}${normalized}`,
  )
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

export async function * readFromGlob (patterns, { format, graphFrom, onError } = {}) {
  const files = (
    await Promise.all(patterns.map((pattern) => glob(pattern, { nodir: true })))
  ).flat()

  for (const file of files) {
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
