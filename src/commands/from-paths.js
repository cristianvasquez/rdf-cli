import { defineCommand } from 'citty'
import rdf from 'rdf-ext'
import { parseFile, pathToFileGraph } from '../inputs.js'
import { resolveFormat, termToNQ } from '../io.js'

function normalizeDataset(dataset, graphFrom, filePath) {
  if (graphFrom !== 'path') return dataset

  const normalized = rdf.dataset()
  const graph = pathToFileGraph(filePath)
  for (const quad of dataset) {
    normalized.add(rdf.quad(
      quad.subject,
      quad.predicate,
      quad.object,
      quad.graph.termType === 'DefaultGraph' ? graph : quad.graph,
    ))
  }
  return normalized
}

function writeDataset(dataset) {
  for (const quad of dataset) {
    const graph = quad.graph.termType === 'DefaultGraph' ? '' : ` ${termToNQ(quad.graph)}`
    process.stdout.write(`${termToNQ(quad.subject)} ${termToNQ(quad.predicate)} ${termToNQ(quad.object)}${graph} .\n`)
  }
}

export default defineCommand({
  meta: { name: 'from-paths', description: 'Read paths from stdin, parse RDF files → dataset stream on stdout' },
  args: {
    format: { type: 'string', alias: 'f', description: 'Input format for all paths (auto-detected by extension by default)' },
    'graph-from': { type: 'string', description: 'Assign graph identity to graphless input: path' },
  },
  async run({ args }) {
    const stdin = await new Promise((resolve, reject) => {
      let text = ''
      process.stdin.setEncoding('utf8')
      process.stdin.on('data', chunk => { text += chunk })
      process.stdin.on('end', () => resolve(text))
      process.stdin.on('error', reject)
    })

    const paths = stdin
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)

    if (paths.length === 0) {
      process.stderr.write('error: expected one path per line on stdin\n')
      process.exit(1)
    }

    const graphFrom = args['graph-from']
    if (graphFrom && graphFrom !== 'path') {
      process.stderr.write('error: --graph-from only supports "path"\n')
      process.exit(1)
    }

    const forcedFormat = resolveFormat(args.format)
    for (const file of paths) {
      const parsed = forcedFormat ? await parseFileWithForcedFormat(file, forcedFormat) : await parseFile(file)
      if (parsed.error) {
        process.stderr.write(`error: ${file}: ${parsed.error}\n`)
        continue
      }
      writeDataset(normalizeDataset(parsed.dataset, graphFrom, file))
    }
  },
})

async function parseFileWithForcedFormat(filePath, mimeType) {
  const { createReadStream } = await import('node:fs')
  const { Readable } = await import('node:stream')
  const formats = (await import('@rdfjs/formats')).default
  const dataset = rdf.dataset()

  try {
    await dataset.import(formats.parsers.import(mimeType, createReadStream(filePath, 'utf8')))
    return { path: filePath, dataset }
  } catch (error) {
    return { path: filePath, error }
  }
}
