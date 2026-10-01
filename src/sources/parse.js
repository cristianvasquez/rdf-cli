import formats from '@rdfjs/formats'
import { Lexer } from 'n3'
import rdf from 'rdf-ext'

const N3_TYPES = new Set(['text/turtle', 'application/trig', 'application/n-triples', 'application/n-quads', 'text/n3'])

// n3 2.7.12 reads "@prefix" and "@base" after a literal as a language tag, also
// after whitespace: 'VERSION "1.2"' followed by '@prefix' fails. The Turtle
// grammar reserves them as keywords. The lexer is the parser's default one
// (no format option: not line mode, not N3), with these two words excluded
// from language tags.
function lexer () {
  const l = new Lexer({ lineMode: false, n3: false })
  l._langcode = /^@(?!(?:prefix|base)(?![a-z0-9-]))([a-z]+(?:-[a-z0-9]+)*)(?=[^a-z0-9])/i
  return l
}

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
  const options = { blankNodePrefix: '', factory }
  if (N3_TYPES.has(mimeType)) options.lexer = lexer()
  return formats.parsers.import(mimeType, input, options)
}
