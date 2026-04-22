import { defineCommand } from 'citty'
import rdf from 'rdf-ext'
import { readQuadStreamFromStdin, resolveFormat, writeQuadStreamAsNQ } from '../io.js'

export default defineCommand({
  meta: { name: 'graph-assign', description: 'Assign a named graph to graphless statements' },
  args: {
    graph: { type: 'positional', description: 'Named graph IRI' },
    format: { type: 'string', alias: 'f', description: 'Input format (default: n-quads)' },
  },
  async run({ args }) {
    if (!args.graph) {
      process.stderr.write('error: provide a graph IRI\n')
      process.exit(1)
    }

    const graph = rdf.namedNode(args.graph)
    await writeQuadStreamAsNQ(
      readQuadStreamFromStdin(resolveFormat(args.format) || 'application/n-quads'),
      quad => rdf.quad(
        quad.subject,
        quad.predicate,
        quad.object,
        quad.graph.termType === 'DefaultGraph' ? graph : quad.graph,
      ),
    )
  },
})
