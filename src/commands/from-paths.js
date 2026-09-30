import { defineCommand } from 'citty'
import { readFromPaths } from '../sources/paths.js'
import { writeQuads } from '../sinks/quads.js'
import { readLines } from '../utils.js'
import { formatArg, graphFromArg, inputFormat } from './shared.js'

export default defineCommand({
  io: { stdin: 'PathLines', stdout: 'NQuads' },
  meta: {
    name: 'from-paths',
    description:
      'Read one file path per line from stdin and emit an N-Quads dataset stream. ' +
      'Each file is its own blank-node scope.',
  },
  args: {
    'graph-from': graphFromArg,
    format: formatArg,
  },
  async run ({ args }) {
    const graphFrom = args['graph-from']
    const format = inputFormat(args.format)
    if (graphFrom && graphFrom !== 'path') {
      process.stderr.write('error: --graph-from only supports "path"\n')
      process.exit(1)
    }

    let failed = false
    await writeQuads(
      readFromPaths(readLines(process.stdin), {
        graphFrom,
        format,
        onError: (file, error) => {
          failed = true
          process.stderr.write(`error: ${file}: ${error}\n`)
        },
      }),
    )

    if (failed) process.exitCode = 1
  },
})
