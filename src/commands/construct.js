import { defineCommand } from 'citty'
import { readFile } from 'node:fs/promises'
import { NQUADS } from '../formats.js'
import { readFromStdin } from '../sources/stdin.js'
import { writeQuads } from '../sinks/quads.js'
import { materialize, construct } from '../transforms/sparql.js'

export default defineCommand({
  io: { stdin: 'NQuads', stdout: 'NQuads' },
  meta: {
    name: 'construct',
    description:
      'Read an N-Quads dataset stream from stdin, run SPARQL CONSTRUCT, and emit N-Quads. ' +
      'Output is always graphless (all triples go into the default graph). ' +
      'GRAPH clauses in the CONSTRUCT template are not supported by the SPARQL engine — ' +
      'they cause a cryptic parse error ("expected one of \'.\', \':\'"). ' +
      'To assign a named graph to the output, pipe through graph-assign.',
  },
  args: {
    query: {
      type: 'positional',
      description: 'SPARQL CONSTRUCT query string',
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
    await writeQuads(construct(store, query))
  },
})
