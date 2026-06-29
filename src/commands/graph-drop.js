import { defineCommand } from 'citty'
import { NQUADS, readQuadStreamFromStdin, resolveFormat, writeQuads } from '../io.js'
import { dropGraph } from '../transforms/dropGraph.js'

export default defineCommand({
  meta: {
    name: 'graph-drop',
    description: 'Drop graph terms — move all quads into the default graph.',
  },
  args: {
    format: {
      type: 'string',
      alias: 'f',
      description: 'Input format (default: n-quads)',
    },
  },
  async run ({ args }) {
    const source = readQuadStreamFromStdin(resolveFormat(args.format) || NQUADS)
    await writeQuads(source.pipe(dropGraph()))
  },
})
