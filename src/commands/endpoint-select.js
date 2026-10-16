import { defineCommand } from 'citty'
import { endpointSelect } from '../sources/http.js'
import { writeBindings } from '../sinks/bindings.js'
import { fail, httpArgs, httpOpts, queryArgs, readQuery } from './shared.js'

export default defineCommand({
  io: { stdin: 'Nil', stdout: 'JSONLinesBindings' },
  meta: {
    name: 'endpoint-select',
    description:
      'Run a remote SPARQL SELECT and emit SPARQL JSON results as a head line followed by binding lines. ' +
      'Stdin is not read.',
  },
  args: {
    endpoint: { type: 'positional', description: 'SPARQL endpoint URL', required: true },
    ...queryArgs('SELECT'),
    ...httpArgs,
  },
  async run ({ args }) {
    const query = await readQuery(args)
    const http = httpOpts(args)
    try {
      await writeBindings(await endpointSelect(args.endpoint, query, http))
    } catch (error) {
      fail(error.message)
    }
  },
})
