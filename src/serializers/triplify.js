import TurtleSerializer from '@rdfjs/serializer-turtle/lib/TurtleSerializer.js'
import { activeNamespaces } from '@rdfjs/serializer-turtle/lib/utils.js'
import rdf from 'rdf-ext'
import { directionalToNT, isDirectional } from './ntriples.js'

const RDF_REST = rdf.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#rest')

// A reference that is not a node: it only makes refs.length larger.
const PLACEHOLDER = Object.freeze({ quads: [], predicates: new Map(), isListItem: false })

function * blankNodesIn (term) {
  if (term.termType === 'BlankNode') yield term
  if (term.termType === 'Quad') for (const t of [term.subject, term.object]) yield * blankNodesIn(t)
}

// RDF 1.2 for @rdfjs/serializer-turtle 1.1.5, which does not know triple terms
// and base directions. All terms go through toNT.
// - A triple term is written as "<<( s p o )>>", a directional literal as "v"@lang--dir.
// - The serializer writes a blank node as "[ … ]" when it counts 0 or 1
//   references, and it does not count uses inside triple terms. So each blank
//   node that is also inside a triple term gets two placeholder references,
//   and is written with its label everywhere. The tree (and its list
//   detection) is complete when super() returns; after it, only the
//   serializer reads refs.length.
//   A list cell inside a triple term: the cells before it (up to the head)
//   get placeholders too. Otherwise the head writes the whole list as
//   "( … )", with new anonymous cells, and the cell is written twice.
// - The prefixes of the terms inside triple terms are declared too.
class Rdf12TurtleSerializer extends TurtleSerializer {
  constructor (quads, options) {
    super(quads, options)
    const inside = rdf.termSet()
    for (const node of this.tree.nodes.values()) {
      if (node.term.termType === 'Quad') for (const b of blankNodesIn(node.term)) inside.add(b)
    }
    const previous = rdf.termMap() // cell -> the cell whose rdf:rest it is
    for (const node of this.tree.nodes.values()) {
      for (const next of node.predicates.get(RDF_REST)?.objects.values() ?? []) previous.set(next.term, node)
    }
    const labeled = rdf.termSet()
    for (const term of inside) {
      for (let node = this.tree.nodes.get(term); node && !labeled.has(node.term); node = previous.get(node.term)) {
        labeled.add(node.term)
        node.refs.push(PLACEHOLDER, PLACEHOLDER)
      }
    }
  }

  toNT (term) {
    if (term.termType === 'Quad') {
      return `<<( ${this.toNT(term.subject)} ${this.toNT(term.predicate)} ${this.toNT(term.object)} )>>`
    }
    if (isDirectional(term)) return directionalToNT(term, (t) => super.toNT(t))
    return super.toNT(term)
  }

  // As TurtleSerializer.serializePrefixes, with the terms inside triple terms,
  // and a directional literal checked as a language-tagged literal.
  serializePrefixes () {
    const nodes = []
    const add = (term) => {
      if (term.termType === 'Quad') {
        for (const t of [term.subject, term.predicate, term.object]) add(t)
        return
      }
      nodes.push({ term: isDirectional(term) ? rdf.literal(term.value, term.language) : term, predicates: new Map() })
    }
    for (const node of this.tree.nodes.values()) {
      add(node.term)
      for (const predicate of node.predicates.keys()) add(predicate)
    }
    const active = activeNamespaces({ nodes }, this.prefixes)
    if (active.size === 0) return
    this.state.serializedPrefixes = true
    for (const prefix of [...active].sort()) {
      this.output.push(`@prefix ${prefix}: <${this.prefixes.get(prefix).value}>.\n`)
    }
  }
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
  return new Rdf12TurtleSerializer(rdf.dataset(quads), { prefixes: prefixMap }).serialize().join('')
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

export async function toTurtleString (dataset, prefixes = {}) {
  return serializeTriples([...dataset], prefixesToMap(prefixes))
}

export async function triplify (dataset, prefixes = {}) {
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
  const headerLines = new Set()
  const blocks = []

  if (defaultGraph.length) {
    const { header: h, body } = splitHeader(await serializeTriples(defaultGraph, prefixMap))
    for (const line of h.split('\n')) if (line) headerLines.add(line)
    if (body) blocks.push(body)
  }

  for (const { graph, quads } of namedGraphs.values()) {
    const { header: h, body } = splitHeader(await serializeTriples(quads, prefixMap))
    for (const line of h.split('\n')) if (line) headerLines.add(line)
    blocks.push(`${graphLabel(graph)} {\n${indent(body)}\n}`)
  }

  const header = [...headerLines].join('\n')
  return `${[header, blocks.join('\n\n')].filter(Boolean).join('\n\n')}\n`
}
