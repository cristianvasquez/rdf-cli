import { createReadStream } from 'node:fs'
import { glob } from 'glob'
import rdf from 'rdf-ext'
import { guessMimeType } from '../formats.js'
import { parseQuads } from './parse.js'
import { mapTerm } from '../utils.js'

export function streamFileQuads (filePath, mimeType) {
  const resolved = mimeType || guessMimeType(filePath)
  if (!resolved) throw new Error(`unknown format for ${filePath}`)
  return parseQuads(resolved, createReadStream(filePath, 'utf8'))
}

function pathToFileGraph (path) {
  const normalized = path.replace(/\\/g, '/')
  if (/^[a-zA-Z]:/.test(normalized)) return rdf.namedNode(`file:///${normalized}`)
  return rdf.namedNode(
    `file://${normalized.startsWith('/') ? '' : './'}${normalized}`,
  )
}

// One blank-node scope per file: label L in file i becomes b<i>_L. The digits
// before the first '_' identify the file, so two files never share a label.
export function scopeBlankNodes (index) {
  const prefix = `b${index}_`
  const term = (t) => mapTerm(t, (u) => (u.termType === 'BlankNode' ? rdf.blankNode(prefix + u.value) : u))
  return (quad) => rdf.quad(term(quad.subject), quad.predicate, term(quad.object), term(quad.graph))
}

export function assignDefaultGraph (graph) {
  return (quad) =>
    quad.graph.termType === 'DefaultGraph'
      ? rdf.quad(quad.subject, quad.predicate, quad.object, graph)
      : quad
}

export async function * readFromPaths (files, { graphFrom, format, onError } = {}) {
  let index = 0
  for await (const file of files) {
    const scope = scopeBlankNodes(index++)
    const toGraph = graphFrom === 'path' ? assignDefaultGraph(pathToFileGraph(file)) : null
    try {
      for await (const quad of streamFileQuads(file, format)) {
        const scoped = scope(quad)
        yield toGraph ? toGraph(scoped) : scoped
      }
    } catch (error) {
      onError?.(file, error)
    }
  }
}

export async function * readFromGlob (patterns, options = {}) {
  const files = (
    await Promise.all(patterns.map((pattern) => glob(pattern, { nodir: true })))
  ).flat()
  yield * readFromPaths(files, options)
}
