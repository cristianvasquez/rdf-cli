import { defineCommand } from 'citty'
import { readFile } from 'node:fs/promises'
import { NQUADS } from '../formats.js'
import { readFromStdin } from '../sources/stdin.js'
import { writeBindings } from '../sinks/bindings.js'
import { materialize, select } from '../transforms/sparql.js'

export default defineCommand({
  io: { stdin: 'NQuads', stdout: 'JSONLinesBindings' },
  meta: {
    name: 'select',
    description:
      'Read an N-Quads dataset stream from stdin, run SPARQL SELECT, and emit JSON Lines bindings.',
  },
  args: {
    query: {
      type: 'positional',
      description: 'SPARQL SELECT query string',
    },
    'query-file': {
      type: 'string',
      description: 'Read SPARQL query from file instead',
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
    const store = await materialize(await readFromStdin(NQUADS))
    await writeBindings(select(store, query))
  },
})
