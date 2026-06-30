import { defineCommand } from 'citty'
import { readFromPaths } from '../sources/paths.js'
import { writeQuads } from '../sinks/quads.js'
import { readLines } from '../utils.js'

export default defineCommand({
  io: { stdin: 'Text', stdout: 'NQuads' },
  meta: {
    name: 'from-paths',
    description:
      'Read one file path per line from stdin and emit an N-Quads dataset stream.',
  },
  args: {
    'graph-from': {
      type: 'string',
      description: 'Assign graph identity to graphless input: path',
    },
  },
  async run ({ args }) {
    const graphFrom = args['graph-from']
    if (graphFrom && graphFrom !== 'path') {
      process.stderr.write('error: --graph-from only supports "path"\n')
      process.exit(1)
    }

    let failed = false
    await writeQuads(
      readFromPaths(readLines(process.stdin), {
        graphFrom,
        onError: (file, error) => {
          failed = true
          process.stderr.write(`error: ${file}: ${error}\n`)
        },
      }),
    )

    if (failed) process.exitCode = 1
  },
})
