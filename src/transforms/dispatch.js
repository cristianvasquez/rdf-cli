import formats from '@rdfjs/formats'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import rdf from 'rdf-ext'
import { NQUADS, NTRIPLES, TRIG, TURTLE, guessMimeType } from '../formats.js'
import { datasetToString } from '../sinks/pretty.js'
import { collectDataset } from '../utils.js'

// Write each named graph whose IRI starts with root to a file under
// destination (spec/manifest.hs: dispatch). The path is the IRI relative to
// root; the format comes from the extension; graph terms are dropped in the
// file. Written quads leave the stream, all others are returned. Per-graph
// failures go to onError and the other graphs continue.

async function serialize (dataset, mimeType, prefixes) {
  if (mimeType === TRIG || mimeType === TURTLE) return datasetToString(dataset, { format: TURTLE, prefixes })
  const serializer = mimeType === NQUADS ? NTRIPLES : mimeType
  if (!formats.serializers.has(serializer)) throw new Error(`no serializer for ${mimeType}`)
  const chunks = []
  for await (const chunk of formats.serializers.import(serializer, Readable.from([...dataset]))) chunks.push(chunk)
  return chunks.join('')
}

function relativePath (graph, root) {
  if (graph.termType !== 'NamedNode' || !graph.value.startsWith(root)) return null
  return graph.value.slice(root.length)
}

export async function dispatch (source, root, { destination = '.', overwrite = false, prefixes = {}, onError = () => {}, onWrite = () => {} } = {}) {
  const base = root.endsWith('/') ? root : `${root}/`
  const dataset = await collectDataset(source)
  const graphs = new Map()
  const rest = rdf.dataset()

  for (const quad of dataset) {
    const path = relativePath(quad.graph, base)
    if (path === null) { rest.add(quad); continue }
    if (!graphs.has(path)) graphs.set(path, { graph: quad.graph, dataset: rdf.dataset() })
    graphs.get(path).dataset.add(rdf.quad(quad.subject, quad.predicate, quad.object))
  }

  for (const [path, { graph, dataset: triples }] of graphs) {
    try {
      if (!path || path.split('/').some((segment) => segment === '..' || segment === '')) {
        throw new Error('graph path is empty or leaves the destination')
      }
      const mimeType = guessMimeType(path)
      if (!mimeType) throw new Error('unknown file extension')
      const file = join(destination, path)
      if (!overwrite && existsSync(file)) throw new Error(`${file} exists (use --overwrite)`)
      await mkdir(dirname(file), { recursive: true })
      await writeFile(file, await serialize(triples, mimeType, prefixes))
      onWrite(file, graph)
    } catch (error) {
      onError(graph, error)
      for (const quad of triples) rest.add(rdf.quad(quad.subject, quad.predicate, quad.object, graph))
    }
  }

  return rest.toStream()
}
