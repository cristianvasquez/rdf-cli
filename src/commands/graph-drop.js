import { defineCommand } from 'citty'
import { NQUADS, resolveFormat } from '../formats.js'
import { readFromStdin } from '../sources/stdin.js'
import { toReadable, writeQuads } from '../sinks/quads.js'
import { dropGraph } from '../transforms/dropGraph.js'

export default defineCommand({
  io: { stdin: 'NQuads', stdout: 'NQuads' },
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
    const source = await readFromStdin(resolveFormat(args.format) || NQUADS)
    await writeQuads(toReadable(source).pipe(dropGraph()))
  },
})
