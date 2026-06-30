import { defineCommand } from 'citty'
import { resolveFormat } from '../formats.js'
import { readFromGlob } from '../sources/glob.js'
import { writeQuads } from '../sinks/quads.js'

export default defineCommand({
  io: { stdin: 'None', stdout: 'NQuads' },
  meta: {
    name: 'read',
    description:
      'Expand glob patterns, parse matched RDF files → N-Quads stream on stdout. ' +
      'Multiple patterns are merged into a single stream. Graphless triples remain ' +
      'in the default graph unless --graph-from path is set, which uses the file path ' +
      'as the named graph IRI for each file\'s default-graph triples.',
  },
  args: {
    format: {
      type: 'string',
      alias: 'f',
      description: 'Input format for all files (auto-detected by extension by default)',
    },
    'graph-from': {
      type: 'string',
      description: 'Assign graph identity to graphless input: path',
    },
  },
  async run ({ args }) {
    const patterns = args._ || []
    if (patterns.length === 0) {
      process.stderr.write('error: provide one or more glob patterns\n')
      process.exit(1)
    }

    const graphFrom = args['graph-from']
    if (graphFrom && graphFrom !== 'path') {
      process.stderr.write('error: --graph-from only supports "path"\n')
      process.exit(1)
    }

    let failed = false
    await writeQuads(
      readFromGlob(patterns, {
        format: resolveFormat(args.format),
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
