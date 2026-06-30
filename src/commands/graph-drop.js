import { defineCommand } from 'citty'
import { NQUADS } from '../formats.js'
import { readFromStdin } from '../sources/stdin.js'
import { toReadable, writeQuads } from '../sinks/quads.js'
import { dropGraph } from '../transforms/dropGraph.js'

export default defineCommand({
  io: { stdin: 'NQuads', stdout: 'NQuads' },
  meta: {
    name: 'graph-drop',
    description: 'Drop graph terms — move all quads into the default graph.',
  },
  async run ({ args }) {
    const source = await readFromStdin(NQUADS)
    await writeQuads(toReadable(source).pipe(dropGraph()))
  },
})
