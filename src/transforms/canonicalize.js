import { canonize } from 'rdf-canonize'
import { Readable } from 'node:stream'
import { parseQuads } from '../sources/parse.js'
import { NQUADS } from '../formats.js'
import { collectDataset } from '../utils.js'

// RDFC-1.0 canonical form (spec/manifest.hs: canonicalize): canonical
// blank-node labels (c14n0, c14n1, ...), quads sorted. Materializes the stream.
export async function canonicalize (source) {
  const dataset = await collectDataset(source)
  const nquads = await canonize([...dataset], { algorithm: 'RDFC-1.0' })
  return parseQuads(NQUADS, Readable.from([nquads]))
}
