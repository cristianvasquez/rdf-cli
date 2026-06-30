import { TurtleSerializer } from '@rdfjs/formats'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import rdf from 'rdf-ext'
import { collectDataset } from '../utils.js'
import { TRIG, TURTLE } from '../formats.js'

export { TRIG, TURTLE }

export async function loadPrefixes (prefixFile) {
  const candidates = [
    prefixFile,
    join(process.cwd(), '.prefixes.json'),
    join(process.cwd(), 'prefixes.json'),
  ].filter(Boolean)

  for (const file of candidates) {
    if (existsSync(file)) {
      return JSON.parse(await readFile(file, 'utf8'))
    }
  }
  return {}
}

function prefixesToMap (prefixes = {}) {
  return new Map(
    Object.entries(prefixes).map(([prefix, namespace]) => [
      prefix,
      rdf.namedNode(namespace),
    ]),
  )
}

function serializeTriples (quads, prefixMap) {
  const serializer = new TurtleSerializer({ prefixes: prefixMap })
  return serializer.transform(rdf.dataset(quads))
}

function splitHeader (turtle) {
  const lines = turtle.split('\n')
  let i = 0
  while (i < lines.length && /^@(prefix|base)\b/.test(lines[i])) i++
  const header = lines.slice(0, i).join('\n')
  while (i < lines.length && lines[i].trim() === '') i++
  return { header, body: lines.slice(i).join('\n').trimEnd() }
}

function indent (text) {
  return text.split('\n').map((line) => (line ? `  ${line}` : line)).join('\n')
}

function graphLabel (graph) {
  return graph.termType === 'BlankNode' ? `_:${graph.value}` : `<${graph.value}>`
}

async function toTurtleString (dataset, prefixes = {}) {
  return serializeTriples([...dataset], prefixesToMap(prefixes))
}

async function toTrigString (dataset, prefixes = {}) {
  const defaultGraph = []
  const namedGraphs = new Map()
  for (const quad of dataset) {
    if (quad.graph.termType === 'DefaultGraph') {
      defaultGraph.push(quad)
      continue
    }
    const entry = namedGraphs.get(quad.graph.value)
    if (entry) entry.quads.push(quad)
    else namedGraphs.set(quad.graph.value, { graph: quad.graph, quads: [quad] })
  }

  if (namedGraphs.size === 0) return toTurtleString(dataset, prefixes)

  const prefixMap = prefixesToMap(prefixes)
  let header = ''
  const blocks = []

  if (defaultGraph.length) {
    const { header: h, body } = splitHeader(await serializeTriples(defaultGraph, prefixMap))
    header ||= h
    if (body) blocks.push(body)
  }

  for (const { graph, quads } of namedGraphs.values()) {
    const { header: h, body } = splitHeader(await serializeTriples(quads, prefixMap))
    header ||= h
    blocks.push(`${graphLabel(graph)} {\n${indent(body)}\n}`)
  }

  return `${[header, blocks.join('\n\n')].filter(Boolean).join('\n\n')}\n`
}

export async function datasetToString (dataset, { format, prefixes }) {
  return format === TRIG
    ? toTrigString(dataset, prefixes)
    : toTurtleString(dataset, prefixes)
}

export async function writePretty (source, { format = TRIG, prefixes = {} } = {}) {
  const dataset = await collectDataset(source)
  try {
    process.stdout.write(await datasetToString(dataset, { format, prefixes }))
  } catch (error) {
    process.stderr.write(`error: ${error.message}\n`)
    process.exit(1)
  }
}
