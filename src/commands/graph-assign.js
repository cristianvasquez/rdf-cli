import { defineCommand } from 'citty'
import { NQUADS, resolveFormat } from '../formats.js'
import { readFromStdin } from '../sources/stdin.js'
import { toReadable, writeQuads } from '../sinks/quads.js'
import { assignGraph } from '../transforms/assignGraph.js'

export default defineCommand({
  io: { stdin: 'NQuads', stdout: 'NQuads' },
  meta: {
    name: 'graph-assign',
    description:
      'Assign a named graph to graphless statements. Applies a single fixed IRI to every default-graph quad in the stream; quads already in a named graph are passed through unchanged. For dynamic graph assignment based on a predicate value, use construct with a WHERE clause.',
  },
  args: {
    graph: { type: 'positional', description: 'Named graph IRI' },
    format: {
      type: 'string',
      alias: 'f',
      description: 'Input format (default: n-quads)',
    },
  },
  async run ({ args }) {
    if (!args.graph) {
      process.stderr.write('error: provide a graph IRI\n')
      process.exit(1)
    }

    const source = await readFromStdin(resolveFormat(args.format) || NQUADS)
    await writeQuads(toReadable(source).pipe(assignGraph(args.graph)))
  },
})
