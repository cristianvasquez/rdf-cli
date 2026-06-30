import { defineCommand } from 'citty'
import { readFromGlob } from '../sources/glob.js'
import { writeQuads } from '../sinks/quads.js'
import { readFromStdin } from '../sources/stdin.js'

export default defineCommand({
  io: { stdin: 'RDFBytes', stdout: 'NQuads' },
  meta: {
    name: 'read',
    description:
      'Parse RDF from file paths or stdin into an N-Quads dataset stream. ' +
      'With one or more path arguments, each path or glob is expanded and parsed. ' +
      'With no arguments, RDF bytes are read from stdin and auto-detected. ' +
      'Graphless triples remain in the default graph unless --graph-from path is set for file inputs.',
  },
  args: {
    'graph-from': {
      type: 'string',
      description: 'Assign graph identity to graphless input: path',
    },
  },
  async run ({ args }) {
    const patterns = args._ || []
    const graphFrom = args['graph-from']
    if (graphFrom && graphFrom !== 'path') {
      process.stderr.write('error: --graph-from only supports "path"\n')
      process.exit(1)
    }

    if (patterns.length === 0) {
      if (graphFrom) {
        process.stderr.write('error: --graph-from path is only supported for file inputs\n')
        process.exit(1)
      }
      await writeQuads(await readFromStdin())
      return
    }

    let failed = false
    await writeQuads(
      readFromGlob(patterns, {
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
