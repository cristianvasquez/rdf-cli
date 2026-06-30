import { defineCommand } from 'citty'
import { NQUADS } from '../formats.js'
import { readFromStdin } from '../sources/stdin.js'
import { toReadable, writeQuads } from '../sinks/quads.js'
import { assignGraph } from '../transforms/assignGraph.js'

export default defineCommand({
  io: { stdin: 'NQuads', stdout: 'NQuads' },
  meta: {
    name: 'graph-assign',
    description:
      'Read an N-Quads dataset stream from stdin and assign a named graph to graphless statements.',
  },
  args: {
    graph: { type: 'positional', description: 'Named graph IRI' },
  },
  async run ({ args }) {
    if (!args.graph) {
      process.stderr.write('error: provide a graph IRI\n')
      process.exit(1)
    }

    const source = await readFromStdin(NQUADS)
    await writeQuads(toReadable(source).pipe(assignGraph(args.graph)))
  },
})
