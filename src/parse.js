import formats from '@rdfjs/formats'
import { getStreamAsBuffer } from 'get-stream'
import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { Readable } from 'node:stream'
import { glob } from 'glob'
import rdf from 'rdf-ext'
import { detectFormat, guessMimeType } from './formats.js'

function pathToFileGraph (path) {
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

// Read stdin bytes → Readable of quads. Streams directly when format is known;
// buffers to auto-detect otherwise.
export async function readFromStdin (hintFormat) {
  if (hintFormat) {
    return formats.parsers.import(hintFormat, process.stdin)
  }
  const buffer = await getStreamAsBuffer(process.stdin)
  const fmt = detectFormat(buffer.toString('utf8', 0, 500))
  if (!fmt) {
    process.stderr.write('error: cannot detect stdin format — use --format\n')
    process.exit(1)
  }
  return formats.parsers.import(fmt, Readable.from([buffer]))
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

// Expand glob patterns → parse each matched file → yield quads.
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

// Collect any async-iterable quad source into an rdf-ext dataset.
export async function collectDataset (source) {
  const dataset = rdf.dataset()
  for await (const quad of source) dataset.add(quad)
  return dataset
}

// Yield non-empty trimmed lines from a readable stream.
export async function * readLines (stream) {
  const rl = createInterface({ input: stream, crlfDelay: Infinity })
  for await (const line of rl) {
    const trimmed = line.trim()
    if (trimmed) yield trimmed
  }
}
