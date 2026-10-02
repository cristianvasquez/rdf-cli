import { defineCommand } from 'citty'
import { endpointConstruct } from '../sources/http.js'
import { writeQuads } from '../sinks/quads.js'
import { fail, httpArgs, httpOpts, queryArgs, readQuery } from './shared.js'

export default defineCommand({
  io: { stdin: 'Nil', stdout: 'NQuads' },
  meta: {
    name: 'endpoint-construct',
    description:
      'Run a SPARQL CONSTRUCT or DESCRIBE on a remote endpoint and emit its triples, graphless. ' +
      'Stdin is not read. To assign a named graph to the output, pipe through map -g.',
  },
  args: {
    endpoint: { type: 'positional', description: 'SPARQL endpoint URL', required: true },
    ...queryArgs('CONSTRUCT or DESCRIBE'),
    ...httpArgs,
  },
  async run ({ args }) {
    const query = await readQuery(args)
    const http = httpOpts(args)
    try {
      await writeQuads(endpointConstruct(args.endpoint, query, http))
    } catch (error) {
      fail(error.message)
    }
  },
})
