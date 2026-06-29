export const NQUADS = 'application/n-quads'
export const NTRIPLES = 'application/n-triples'
export const TURTLE = 'text/turtle'
export const TRIG = 'application/trig'

const FORMAT_ALIASES = {
  turtle: TURTLE,
  ttl: TURTLE,
  trig: TRIG,
  ntriples: NTRIPLES,
  nt: NTRIPLES,
  nquads: NQUADS,
  nq: NQUADS,
  jsonld: 'application/ld+json',
  json: 'application/ld+json',
  rdfxml: 'application/rdf+xml',
  xml: 'application/rdf+xml',
  n3: 'text/n3',
}

const FILE_EXTENSIONS = {
  '.jsonld': 'application/ld+json',
  '.trig': TRIG,
  '.nq': NQUADS,
  '.nt': NTRIPLES,
  '.n3': 'text/n3',
  '.ttl': TURTLE,
  '.rdf': 'application/rdf+xml',
}

export function resolveFormat (fmt) {
  if (!fmt) return null
  return FORMAT_ALIASES[fmt.toLowerCase()] || fmt
}

export function guessMimeType (filePath) {
  return FILE_EXTENSIONS[filePath.slice(filePath.lastIndexOf('.'))] ?? null
}

export function detectFormat (sample) {
  const text = sample.trimStart()
  if (/^(@prefix|@base|\bPREFIX\b|\bBASE\b)/i.test(text)) return 'text/turtle'
  if (text.startsWith('{') || text.startsWith('[')) return 'application/ld+json'
  if (/^<\?xml|^<rdf:/i.test(text)) return 'application/rdf+xml'
  if (/^\s*(?:GRAPH\s+<|<[^>]+>\s*\{)/m.test(text)) return 'application/trig'

  const firstLine =
    text.split('\n').find((line) => line.trim() && !line.trim().startsWith('#')) || ''
  const terms =
    firstLine.match(
      /(<[^>]+>|_:\S+|"(?:[^"\\]|\\.)*"(?:[@^][^\s.]+)?|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    ) || []
  if (terms.length >= 4) return 'application/n-quads'
  if (terms.length === 3) return 'application/n-triples'
  return null
}
