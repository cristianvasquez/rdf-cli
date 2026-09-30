import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import rdf from 'rdf-ext'
import { writeQuads } from './quads.js'
import { toTurtleString, triplify } from '../serializers/triplify.js'
import { dropGraph } from '../transforms/dropGraph.js'
import { collectDataset } from '../utils.js'
import { NQUADS, NTRIPLES, TRIG, TURTLE } from '../formats.js'

export { NQUADS, NTRIPLES, TRIG, TURTLE }
export { triplify } from '../serializers/triplify.js'

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

export async function datasetToString (dataset, { format, prefixes }) {
  return format === TRIG
    ? triplify(dataset, prefixes)
    : toTurtleString(dataset, prefixes)
}

const PRETTY_FORMATS = [TRIG, TURTLE, NQUADS, NTRIPLES]

// Any format outside PRETTY_FORMATS is an error; there is no fallback to TriG.
export async function writePretty (source, { format = TRIG, prefixes = {} } = {}) {
  if (!PRETTY_FORMATS.includes(format)) throw new Error(`unsupported output format: ${format}`)
  const dataset = await collectDataset(source)
  try {
    if (format === NQUADS || format === NTRIPLES) {
      await writeQuads(format === NTRIPLES ? rdf.dataset([...dataset]).toStream().pipe(dropGraph()) : dataset, { format })
      return
    }
    process.stdout.write(await datasetToString(dataset, { format, prefixes }))
  } catch (error) {
    process.stderr.write(`error: ${error.message}\n`)
    process.exit(1)
  }
}
