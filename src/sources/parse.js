import formats from '@rdfjs/formats'

// Parse RDF bytes into quads. Blank-node labels are kept as written: N3 would
// otherwise prefix them (b0_, b1_, ...) at every parse, so labels grow by one
// prefix per pipe stage. Scoping between files is readFromPaths' job.
export function parseQuads (mimeType, input) {
  return formats.parsers.import(mimeType, input, { blankNodePrefix: '' })
}
