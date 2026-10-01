import { Readable } from 'node:stream'
import { parseQuads } from '../sources/parse.js'
import { NQUADS } from '../formats.js'
import { canonicalNQuads } from '../serializers/canonical.js'
import { collectDataset } from '../utils.js'

// RDFC-1.0 canonical form (spec/manifest.hs: canonicalize): canonical
// blank-node labels (c14n0, c14n1, ...), quads sorted. Materializes the stream.
// RDF 1.2 triple terms: see serializers/canonical.js.
export async function canonicalize (source) {
  const dataset = await collectDataset(source)
  const nquads = canonicalNQuads(dataset)
  return parseQuads(NQUADS, Readable.from([nquads]))
}
