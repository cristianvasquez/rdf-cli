import { defineCommand } from 'citty'
import { readFile } from 'node:fs/promises'
import { NQUADS, resolveFormat } from '../formats.js'
import { readFromStdin } from '../sources/stdin.js'
import { writeBindings } from '../sinks/bindings.js'
import { createSelectStream } from '../transforms/sparql.js'

export default defineCommand({
  meta: {
    name: 'select',
    description:
      'SPARQL SELECT on dataset stream stdin → bindings stream (JSON Lines). ' +
      'Reads N-Quads from stdin by default. GRAPH patterns are supported (SPARQL 1.1).',
  },
  args: {
    query: { type: 'positional', description: 'SPARQL SELECT query string' },
    'query-file': {
      type: 'string',
      description: 'Read SPARQL query from file instead',
    },
    format: {
      type: 'string',
      alias: 'f',
      description: 'Input format (default: n-quads)',
    },
  },
  async run ({ args }) {
    const query = args['query-file']
      ? await readFile(args['query-file'], 'utf8')
      : args.query
    if (!query) {
      process.stderr.write('error: provide a SPARQL query as argument or via --query-file\n')
      process.exit(1)
    }

    const source = await readFromStdin(resolveFormat(args.format) || NQUADS)
    await writeBindings(await createSelectStream(source, query))
  },
})
