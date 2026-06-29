import { defineCommand } from 'citty'
import { NQUADS, NTRIPLES, resolveFormat } from '../formats.js'
import { readFromStdin } from '../parse.js'
import { toReadable, writeQuads } from '../sinks/quads.js'
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

    const source = await readFromStdin(inputFormat)

    // N-Triples serializer still emits the graph term, so strip it before output.
    const piped = outputFormat === NTRIPLES ? toReadable(source).pipe(dropGraph()) : source
    await writeQuads(piped, { format: outputFormat })
  },
})
