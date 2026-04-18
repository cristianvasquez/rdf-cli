import formats from '@rdfjs/formats'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { getStreamAsBuffer } from 'get-stream'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import rdf from 'rdf-ext'

export const FORMAT_ALIASES = {
  turtle: 'text/turtle',
  ttl: 'text/turtle',
  trig: 'application/trig',
  ntriples: 'application/n-triples',
  nt: 'application/n-triples',
  nquads: 'application/n-quads',
  nq: 'application/n-quads',
  jsonld: 'application/ld+json',
  json: 'application/ld+json',
  rdfxml: 'application/rdf+xml',
  xml: 'application/rdf+xml',
  n3: 'text/n3',
}

export function resolveFormat(fmt) {
  if (!fmt) return null
  return FORMAT_ALIASES[fmt.toLowerCase()] || fmt
}

export function detectFormat(sample) {
  const text = sample.trimStart()
  if (/^(@prefix|@base|\bPREFIX\b|\bBASE\b)/i.test(text)) return 'text/turtle'
  if (text.startsWith('{') || text.startsWith('[')) return 'application/ld+json'
  if (/^<\?xml|^<rdf:/i.test(text)) return 'application/rdf+xml'
  if (/^\s*(?:GRAPH\s+<|<[^>]+>\s*\{)/m.test(text)) return 'application/trig'

  const firstLine = text.split('\n').find(line => line.trim() && !line.trim().startsWith('#')) || ''
  const terms = firstLine.match(/(<[^>]+>|_:\S+|"(?:[^"\\]|\\.)*"(?:[@^][^\s.]+)?|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g) || []
  if (terms.length >= 4) return 'application/n-quads'
  if (terms.length === 3) return 'application/n-triples'
  return null
}

export async function readDatasetFromStream(stream, hintFormat, errorMessage) {
  const buffer = await getStreamAsBuffer(stream)
  const format = hintFormat || detectFormat(buffer.toString('utf8', 0, 500))
  if (!format) {
    process.stderr.write(`${errorMessage}\n`)
    process.exit(1)
  }

  const dataset = rdf.dataset()
  await dataset.import(formats.parsers.import(format, Readable.from([buffer])))
  return dataset
}

export async function readStdin(hintFormat) {
  return readDatasetFromStream(process.stdin, hintFormat, 'error: cannot detect stdin format — use --format')
}

export async function loadPrefixes(prefixFile) {
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

function escapeLiteral(value) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
}

export function termToNQ(term) {
  switch (term.termType) {
    case 'NamedNode':
      return `<${term.value}>`
    case 'BlankNode':
      return `_:${term.value}`
    case 'Literal': {
      let literal = `"${escapeLiteral(term.value)}"`
      if (term.language) literal += `@${term.language}`
      else if (term.datatype && term.datatype.value !== 'http://www.w3.org/2001/XMLSchema#string') {
        literal += `^^<${term.datatype.value}>`
      }
      return literal
    }
    default:
      return `<${term.value}>`
  }
}

export function writeDatasetAsNQ(dataset) {
  for (const quad of dataset) {
    const graph = quad.graph.termType === 'DefaultGraph' ? '' : ` ${termToNQ(quad.graph)}`
    process.stdout.write(`${termToNQ(quad.subject)} ${termToNQ(quad.predicate)} ${termToNQ(quad.object)}${graph} .\n`)
  }
}
