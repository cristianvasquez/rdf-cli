import { defineCommand } from 'citty'
import { fetchIris } from '../sources/http.js'
import { writeQuads } from '../sinks/quads.js'
import { readLines } from '../utils.js'
import { httpArgs, httpOpts } from './shared.js'

export default defineCommand({
  io: { stdin: 'IriLines', stdout: 'NQuads' },
  meta: {
    name: 'fetch',
    description:
      'Dereference the IRIs on stdin, one per line, into N-Quads. ' +
      'The parser comes from the response Content-Type. ' +
      'Each response is its own blank-node scope.',
  },
  args: {
    'graph-from': {
      type: 'string',
      description: 'Assign graph identity to graphless responses: iri (the requested IRI)',
    },
    ...httpArgs,
  },
  async run ({ args }) {
    const graphFrom = args['graph-from']
    if (graphFrom && graphFrom !== 'iri') {
      process.stderr.write('error: --graph-from only supports "iri"\n')
      process.exit(1)
    }

    let failed = false
    await writeQuads(
      fetchIris(readLines(process.stdin), {
        graphFrom,
        http: httpOpts(args),
        onError: (iri, error) => {
          failed = true
          process.stderr.write(`error: ${iri}: ${error.message}\n`)
        },
      }),
    )

    if (failed) process.exitCode = 1
  },
})
