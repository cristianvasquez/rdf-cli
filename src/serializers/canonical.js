import { _canonizeSync } from 'rdf-canonize'
import rdf from 'rdf-ext'
import { termToNT } from './ntriples.js'

// Canonical N-Quads text (RDFC-1.0) of quads that can contain RDF 1.2 triple
// terms. RDFC-1.0 does not define triple terms, and rdf-canonize 5.0.0 fails on
// them. Each distinct triple term is encoded as a blank node with three quads in
// a reserved graph (subject, predicate, object), so that the blank nodes inside
// triple terms get canonical labels too. After canonicalization these quads are
// decoded back to `<<( s p o )>>` and the lines are sorted again. Without triple
// terms, the output is that of rdf-canonize. Synchronous.

const NS = 'urn:x-rdf-cli:triple-term'
const GRAPH = rdf.namedNode(NS)
const PARTS = ['subject', 'predicate', 'object']
const PREDICATE = Object.fromEntries(PARTS.map((part) => [part, rdf.namedNode(`${NS}#${part}`)]))
const GRAPH_SUFFIX = ` <${NS}> .`

const hasTripleTerm = (quad) => quad.subject.termType === 'Quad' || quad.object.termType === 'Quad'

// A blank node label prefix that no input label starts with.
function freshPrefix (quads) {
  const labels = []
  const visit = (term) => {
    if (term.termType === 'BlankNode') labels.push(term.value)
    if (term.termType === 'Quad') for (const part of [...PARTS, 'graph']) visit(term[part])
  }
  for (const quad of quads) visit(quad)
  let prefix = 'tt'
  while (labels.some((label) => label.startsWith(prefix))) prefix += '_'
  return prefix
}

function encode (quads) {
  const prefix = freshPrefix(quads)
  const nodes = new Map()
  const extra = []
  const term = (t) => {
    if (t.termType !== 'Quad') return t
    const key = termToNT(t)
    if (!nodes.has(key)) {
      const node = rdf.blankNode(`${prefix}${nodes.size}`)
      nodes.set(key, node)
      for (const part of PARTS) extra.push(rdf.quad(node, PREDICATE[part], term(t[part]), GRAPH))
    }
    return nodes.get(key)
  }
  const encoded = quads.map((q) => rdf.quad(term(q.subject), q.predicate, term(q.object), q.graph))
  return { encoded: [...encoded, ...extra], prefix }
}

// A canonical N-Quads line: subject and predicate have no spaces; the object
// goes up to the graph or the final " .".
function splitLine (line) {
  const s = line.indexOf(' ')
  const p = line.indexOf(' ', s + 1)
  return { subject: line.slice(0, s), predicate: line.slice(s + 1, p), rest: line.slice(p + 1) }
}

function decode (nquads, ttLabels) {
  const parts = new Map()
  const lines = []
  for (const line of nquads.split('\n').filter(Boolean)) {
    if (!line.endsWith(GRAPH_SUFFIX)) { lines.push(line); continue }
    const { subject, predicate, rest } = splitLine(line)
    const part = PARTS.find((name) => predicate === `<${NS}#${name}>`)
    if (!part) throw new Error(`unexpected quad in ${NS}: ${line}`)
    const entry = parts.get(subject) ?? parts.set(subject, {}).get(subject)
    entry[part] = rest.slice(0, -GRAPH_SUFFIX.length)
  }
  const text = (token) => {
    if (!ttLabels.has(token)) return token
    const { subject, predicate, object } = parts.get(token)
    return `<<( ${text(subject)} ${predicate} ${text(object)} )>>`
  }
  const objectToken = (rest) => (rest.startsWith('_:') ? rest.slice(0, rest.indexOf(' ')) : null)
  return lines.map((line) => {
    const { subject, predicate, rest } = splitLine(line)
    const object = objectToken(rest)
    const restText = object && ttLabels.has(object) ? text(object) + rest.slice(object.length) : rest
    return `${text(subject)} ${predicate} ${restText}`
  })
}

export function canonicalNQuads (quads) {
  quads = [...quads]
  if (!quads.some(hasTripleTerm)) return _canonizeSync(quads, { algorithm: 'RDFC-1.0' })
  if (quads.some((q) => q.graph.equals(GRAPH))) throw new Error(`the graph ${NS} is reserved for triple terms`)
  const { encoded, prefix } = encode(quads)
  const ids = new Map()
  const nquads = _canonizeSync(encoded, { algorithm: 'RDFC-1.0', canonicalIdMap: ids })
  const ttLabels = new Set([...ids].filter(([input]) => input.startsWith(prefix)).map(([, id]) => `_:${id}`))
  const lines = decode(nquads, ttLabels)
  lines.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  return lines.map((line) => `${line}\n`).join('')
}
