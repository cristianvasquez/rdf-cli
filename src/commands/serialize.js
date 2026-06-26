import { defineCommand } from 'citty'
import rdf from 'rdf-ext'
import {
  NQUADS,
  NTRIPLES,
  readQuadStreamFromStdin,
  readStdin,
  resolveFormat,
  writeQuads,
} from '../io.js'

const dropGraph = (quad) =>
  rdf.quad(quad.subject, quad.predicate, quad.object, rdf.defaultGraph())

export default defineCommand({
  meta: {
    name: 'serialize',
    description: 'Serialize dataset stream as N-Quads or N-Triples',
  },
  args: {
    format: {
      type: 'string',
      alias: 'f',
      description: 'Output format: nquads (default) or ntriples',
      default: 'nquads',
    },
    'input-format': {
      type: 'string',
      description: 'Input format (default: n-quads)',
    },
  },
  async run ({ args }) {
    const inputFormat = resolveFormat(args['input-format']) || NQUADS
    const triples = resolveFormat(args.format) === NTRIPLES

    // N-Quads input streams quad-by-quad; other formats must be buffered to a
    // dataset before serializing.
    const source =
      inputFormat === NQUADS
        ? readQuadStreamFromStdin(inputFormat)
        : await readStdin(inputFormat)

    // The N-Triples serializer still emits the graph term, so drop it here to
    // keep the output graphless.
    await writeQuads(source, {
      format: triples ? NTRIPLES : NQUADS,
      map: triples ? dropGraph : undefined,
    })
  },
})
