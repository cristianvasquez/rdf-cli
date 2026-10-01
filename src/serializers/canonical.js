import { _canonizeSync } from 'rdf-canonize'
import rdf from 'rdf-ext'
import { termsOf } from '../utils.js'
import { isDirectional, termToNT } from './ntriples.js'

// Canonical N-Quads text (RDFC-1.0) of quads that can contain RDF 1.2 terms:
// triple terms, and literals with a base direction. RDFC-1.0 does not define
// them: rdf-canonize 5.0.0 fails on a triple term, and writes a directional
// literal as "v"^^rdf:dirLangString (language and direction lost).
// Each distinct such term is encoded as a blank node with quads in a reserved
// graph, so that the blank nodes inside triple terms get canonical labels too:
//   triple term:         _:t <NS#subject> s, <NS#predicate> p, <NS#object> o
//   directional literal: _:t <NS#literal> "v"@lang, <NS#direction> "dir"
// After canonicalization these quads are decoded back and the lines are sorted
// again. The canonical labels then have gaps (the encoding nodes use some).
// Without such terms, the output is that of rdf-canonize. Synchronous.
// Options as @rdfjs/normalize (rdf-ext dataset.toCanonical()).

const NS = 'urn:x-rdf-cli:triple-term'
const GRAPH = rdf.namedNode(NS)
const PARTS = ['subject', 'predicate', 'object']
const PREDICATE = Object.fromEntries([...PARTS, 'literal', 'direction'].map((part) => [part, rdf.namedNode(`${NS}#${part}`)]))
const GRAPH_SUFFIX = ` <${NS}> .`
const OPTIONS = { algorithm: 'RDFC-1.0', maxDeepIterations: 500 }

const isSpecial = (term) => term.termType === 'Quad' || isDirectional(term)

// A blank node label prefix that no input label starts with.
function freshPrefix (labels) {
  let prefix = 'tt'
  while (labels.some((label) => label.startsWith(prefix))) prefix += '_'
  return prefix
}

function encode (quads, labels) {
  const prefix = freshPrefix(labels)
  const nodes = new Map()
  const extra = []
  const term = (t) => {
    if (!isSpecial(t)) return t
    const key = termToNT(t)
    if (!nodes.has(key)) {
      const node = rdf.blankNode(`${prefix}${nodes.size}`)
      nodes.set(key, node)
      if (t.termType === 'Quad') {
        for (const part of PARTS) extra.push(rdf.quad(node, PREDICATE[part], term(t[part]), GRAPH))
      } else {
        extra.push(rdf.quad(node, PREDICATE.literal, rdf.literal(t.value, t.language), GRAPH))
        extra.push(rdf.quad(node, PREDICATE.direction, rdf.literal(t.direction), GRAPH))
      }
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

function decode (nquads, specialLabels) {
  const parts = new Map()
  const lines = []
  for (const line of nquads.split('\n').filter(Boolean)) {
    const { subject, predicate, rest } = splitLine(line)
    // The input has no IRI of NS (checked), so this test only matches encoding quads.
    if (!specialLabels.has(subject) || !predicate.startsWith(`<${NS}#`)) { lines.push(line); continue }
    const entry = parts.get(subject) ?? parts.set(subject, {}).get(subject)
    entry[predicate.slice(NS.length + 2, -1)] = rest.slice(0, -GRAPH_SUFFIX.length)
  }
  const text = (token) => {
    if (!specialLabels.has(token)) return token
    const { subject, predicate, object, literal, direction } = parts.get(token)
    if (literal !== undefined) return `${literal}--${direction.slice(1, -1)}`
    return `<<( ${text(subject)} ${predicate} ${text(object)} )>>`
  }
  const objectToken = (rest) => (rest.startsWith('_:') ? rest.slice(0, rest.indexOf(' ')) : null)
  return lines.map((line) => {
    const { subject, predicate, rest } = splitLine(line)
    const object = objectToken(rest)
    const restText = object && specialLabels.has(object) ? text(object) + rest.slice(object.length) : rest
    return `${text(subject)} ${predicate} ${restText}`
  })
}

export function canonicalNQuads (quads) {
  quads = [...quads]
  const terms = quads.flatMap((q) => [...termsOf(q)])
  if (!terms.some(isSpecial)) return _canonizeSync(quads, OPTIONS)
  if (terms.some((t) => t.termType === 'NamedNode' && (t.value === NS || t.value.startsWith(`${NS}#`)))) {
    throw new Error(`the IRIs of ${NS} are reserved for the encoding of RDF 1.2 terms`)
  }
  const { encoded, prefix } = encode(quads, terms.filter((t) => t.termType === 'BlankNode').map((t) => t.value))
  const ids = new Map()
  const nquads = _canonizeSync(encoded, { ...OPTIONS, canonicalIdMap: ids })
  const specialLabels = new Set([...ids].filter(([input]) => input.startsWith(prefix)).map(([, id]) => `_:${id}`))
  const lines = decode(nquads, specialLabels)
  lines.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  return lines.map((line) => `${line}\n`).join('')
}
