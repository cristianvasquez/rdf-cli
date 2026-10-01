import TurtleSerializer from '@rdfjs/serializer-turtle/lib/TurtleSerializer.js'
import termCompare from '@rdfjs/serializer-turtle/lib/termCompare.js'
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
// - The blank nodes in `labeled` (used in more than one graph) get a label too.
// - The serializer writes the triples of a blank node where it nests the node.
//   It loses them when no written node nests it (a cycle, the object of
//   rdf:type), and writes them twice when it nests the node and also writes it
//   as a subject (a list value under a cell that is not written as "( … )").
//   A dry run counts how often each subject is written; a blank node written
//   0 or 2+ times gets a label, until each subject is written once.
// - With `termSerializer`, the serializers of all graphs share one blank-node
//   numbering, so the blank nodes of different graphs keep different labels.
// - The prefixes of the terms inside triple terms are declared too.
class Rdf12TurtleSerializer extends TurtleSerializer {
  constructor (quads, { prefixes, termSerializer, labeled = [] } = {}) {
    super(quads, { prefixes })
    if (termSerializer) this.termSerializer = termSerializer
    this.previous = rdf.termMap() // cell -> the cell whose rdf:rest it is
    for (const node of this.tree.nodes.values()) {
      for (const next of node.predicates.get(RDF_REST)?.objects.values() ?? []) this.previous.set(next.term, node)
    }
    this.labeled = rdf.termSet()
    for (const node of this.tree.nodes.values()) {
      if (node.term.termType === 'Quad') for (const b of blankNodesIn(node.term)) this.label(b)
    }
    for (const term of labeled) this.label(term)
    this.labelUntilWrittenOnce()
  }

  // Writes the node with its label: it gets placeholder references, and so do
  // the list cells before it.
  label (term) {
    let added = false
    for (let node = this.tree.nodes.get(term); node && !this.labeled.has(node.term); node = this.previous.get(node.term)) {
      this.labeled.add(node.term)
      node.refs.push(PLACEHOLDER, PLACEHOLDER)
      added = true
    }
    return added
  }

  // Number of times serialize() writes the triples of each subject.
  dryRun () {
    const output = this.output
    this.output = []
    this.writes = rdf.termMap()
    try {
      this.serialize()
      return this.writes
    } finally {
      this.output = output
      this.writes = null
    }
  }

  labelUntilWrittenOnce () {
    for (;;) {
      const writes = this.dryRun()
      const subjects = [...this.tree.subjects.values()].filter((n) => n.quads.length > 0)
      const twice = subjects.filter((n) => (writes.get(n.term) ?? 0) > 1)
      const unwritten = new Set(subjects.filter((n) => !writes.has(n.term)))
      if (twice.length === 0 && unwritten.size === 0) return
      let added = false
      for (const node of twice) added = this.label(node.term) || added
      // One label for each group of unwritten nodes that nest each other.
      const covered = new Set()
      for (const root of [...unwritten].sort(termCompare)) {
        if (covered.has(root)) continue
        added = this.label(root.term) || added
        const stack = [root]
        while (stack.length) {
          const node = stack.pop()
          if (covered.has(node)) continue
          covered.add(node)
          for (const predicate of node.predicates.values()) {
            for (const object of predicate.objects.values()) if (unwritten.has(object)) stack.push(object)
          }
        }
      }
      if (!added) throw new Error('triplify: cannot write each blank node once')
    }
  }

  serializeTypes (node) {
    if (this.writes) this.writes.set(node.term, (this.writes.get(node.term) ?? 0) + 1)
    return super.serializeTypes(node)
  }

  // A list written as "( … )" writes the triples of its cells.
  serializeList (objectNode, options) {
    if (this.writes) for (const cell of objectNode.items ?? []) this.writes.set(cell.term, (this.writes.get(cell.term) ?? 0) + 1)
    return super.serializeList(objectNode, options)
  }

  toNT (term) {
    if (this.writes) return '' // dry run: no blank-node numbers are taken
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

function serializer (quads, prefixMap, options) {
  return new Rdf12TurtleSerializer(rdf.dataset(quads), { prefixes: prefixMap, ...options })
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

// The blank nodes used in more than one graph (a graph name counts as one more
// graph). Each graph is written by its own serializer, so these need a label.
function sharedBlankNodes (quads) {
  const graphsOf = rdf.termMap()
  const add = (term, graph) => {
    for (const b of blankNodesIn(term)) {
      if (!graphsOf.has(b)) graphsOf.set(b, new Set())
      graphsOf.get(b).add(graph)
    }
  }
  for (const quad of quads) {
    const graph = quad.graph.termType === 'DefaultGraph' ? '' : `${quad.graph.termType}:${quad.graph.value}`
    add(quad.subject, graph)
    add(quad.object, graph)
    if (quad.graph.termType === 'BlankNode') add(quad.graph, 'graph name')
  }
  return [...graphsOf].filter(([, graphs]) => graphs.size > 1).map(([b]) => b)
}

export async function toTurtleString (dataset, prefixes = {}) {
  return serializer([...dataset], prefixesToMap(prefixes)).serialize().join('')
}

export async function triplify (dataset, prefixes = {}) {
  const defaultGraph = []
  const namedGraphs = new Map()
  for (const quad of dataset) {
    if (quad.graph.termType === 'DefaultGraph') {
      defaultGraph.push(quad)
      continue
    }
    const key = `${quad.graph.termType}:${quad.graph.value}`
    const entry = namedGraphs.get(key)
    if (entry) entry.quads.push(quad)
    else namedGraphs.set(key, { graph: quad.graph, quads: [quad] })
  }

  if (namedGraphs.size === 0) return toTurtleString(dataset, prefixes)

  const prefixMap = prefixesToMap(prefixes)
  const labeled = sharedBlankNodes(dataset)
  let termSerializer // one blank-node numbering for all graphs
  const write = (quads) => {
    const s = serializer(quads, prefixMap, { termSerializer, labeled })
    termSerializer = s.termSerializer
    return s
  }
  const headerLines = new Set()
  const blocks = []
  const addHeader = (h) => { for (const line of h.split('\n')) if (line) headerLines.add(line) }

  if (defaultGraph.length) {
    const { header: h, body } = splitHeader(write(defaultGraph).serialize().join(''))
    addHeader(h)
    if (body) blocks.push(body)
  }

  for (const { graph, quads } of namedGraphs.values()) {
    const s = write(quads)
    const label = graph.termType === 'BlankNode' ? s.toNT(graph) : `<${graph.value}>`
    const { header: h, body } = splitHeader(s.serialize().join(''))
    addHeader(h)
    blocks.push(`${label} {\n${indent(body)}\n}`)
  }

  const header = [...headerLines].join('\n')
  return `${[header, blocks.join('\n\n')].filter(Boolean).join('\n\n')}\n`
}
