import { defineCommand } from 'citty'
import {
  NQUADS,
  NTRIPLES,
  readQuadStreamFromStdin,
  readStdin,
  resolveFormat,
  toReadable,
  writeQuads,
} from '../io.js'
import { dropGraph } from '../transforms/dropGraph.js'

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
    const outputFormat = resolveFormat(args.format) === NTRIPLES ? NTRIPLES : NQUADS

    // N-Quads input streams quad-by-quad; other formats must be buffered to a
    // dataset before serializing.
    const raw =
      inputFormat === NQUADS
        ? readQuadStreamFromStdin(inputFormat)
        : await readStdin(inputFormat)

    // N-Triples serializer still emits the graph term, so strip it before output.
    const source = outputFormat === NTRIPLES ? toReadable(raw).pipe(dropGraph()) : raw
    await writeQuads(source, { format: outputFormat })
  },
})
