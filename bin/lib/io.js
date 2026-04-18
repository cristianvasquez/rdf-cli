import formats from '@rdfjs/formats'
import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { getStreamAsBuffer } from 'get-stream'
import { join } from 'path'
import { Readable } from 'stream'
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
  const t = sample.trimStart()
  if (/^(@prefix|@base|\bPREFIX\b|\bBASE\b)/i.test(t)) return 'text/turtle'
  if (t.startsWith('{') || t.startsWith('[')) return 'application/ld+json'
  if (/^<\?xml|^<rdf:/i.test(t)) return 'application/rdf+xml'
  if (/^\s*(?:GRAPH\s+<|<[^>]+>\s*\{)/m.test(t)) return 'application/trig'
  // Count RDF terms on first non-comment line to distinguish N-Quads from N-Triples
  const firstLine = t.split('\n').find(l => l.trim() && !l.trim().startsWith('#')) || ''
  const terms = firstLine.match(/(<[^>]+>|_:\S+|"(?:[^"\\]|\\.)*"(?:[@^][^\s.]+)?|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g) || []
  if (terms.length >= 4) return 'application/n-quads'
  if (terms.length === 3) return 'application/n-triples'
  return null
}

export async function readStdin(hintFormat) {
  const buffer = await getStreamAsBuffer(process.stdin)
  const format = hintFormat || detectFormat(buffer.toString('utf8', 0, 500))
  if (!format) {
    process.stderr.write('error: cannot detect stdin format — use --format\n')
    process.exit(1)
  }
  const stream = Readable.from([buffer])
  const dataset = rdf.dataset()
  await dataset.import(formats.parsers.import(format, stream))
  return dataset
}

export async function loadPrefixes(prefixFile) {
  const candidates = [
    prefixFile,
    join(process.cwd(), '.prefixes.json'),
    join(process.cwd(), 'prefixes.json'),
  ].filter(Boolean)
  for (const f of candidates) {
    if (existsSync(f)) {
      return JSON.parse(await readFile(f, 'utf8'))
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
    case 'NamedNode': return `<${term.value}>`
    case 'BlankNode': return `_:${term.value}`
    case 'Literal': {
      let lit = `"${escapeLiteral(term.value)}"`
      if (term.language) lit += `@${term.language}`
      else if (term.datatype && term.datatype.value !== 'http://www.w3.org/2001/XMLSchema#string') lit += `^^<${term.datatype.value}>`
      return lit
    }
    default: return `<${term.value}>`
  }
}

export function writeDatasetAsNQ(dataset) {
  for (const quad of dataset) {
    const s = termToNQ(quad.subject)
    const p = termToNQ(quad.predicate)
    const o = termToNQ(quad.object)
    const g = quad.graph.termType === 'DefaultGraph' ? '' : ` ${termToNQ(quad.graph)}`
    process.stdout.write(`${s} ${p} ${o}${g} .\n`)
  }
}
