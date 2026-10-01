import formats from '@rdfjs/formats'
import rdf from 'rdf-ext'

// Parse RDF bytes into quads. Blank-node labels are kept as written: N3 would
// otherwise prefix them (b0_, b1_, ...) at every parse, so labels grow by one
// prefix per pipe stage. Scoping between files is readFromPaths' job.
// Anonymous blank nodes ([ ], lists) get n3-<n> labels, one counter per parse.
// The default factory gives b<n>, the same as an explicit _:b<n> in the same
// input, and the two nodes would merge. An explicit _:n3-<n> label still
// collides with an anonymous node.
export function parseQuads (mimeType, input) {
  let count = 0
  const factory = Object.create(rdf)
  factory.blankNode = (name) => rdf.blankNode(name ?? `n3-${count++}`)
  return formats.parsers.import(mimeType, input, { blankNodePrefix: '', factory })
}
