import { defineCommand } from 'citty'
import { NQUADS, TRIG, TURTLE, resolveFormat } from '../formats.js'
import { readFromStdin } from '../sources/stdin.js'
import { loadPrefixes, writePretty } from '../sinks/pretty.js'

export default defineCommand({
  io: { stdin: 'NQuads', stdout: 'RDFBytes' },
  meta: {
    name: 'pretty',
    description: 'Render dataset stream as Turtle or TriG (default: trig)',
  },
  args: {
    format: {
      type: 'string',
      alias: 'f',
      description: 'Output format: trig (default) or turtle. Turtle output drops graph assignments.',
      default: 'trig',
    },
    prefixes: {
      type: 'string',
      alias: 'p',
      description: 'Path to prefixes JSON file (auto-discovered: .prefixes.json)',
    },
    'input-format': {
      type: 'string',
      description: 'Input format (default: n-quads)',
    },
  },
  async run ({ args }) {
    const source = await readFromStdin(resolveFormat(args['input-format']) || NQUADS)
    const format = resolveFormat(args.format) === TURTLE ? TURTLE : TRIG
    const prefixes = await loadPrefixes(args.prefixes)
    await writePretty(source, { format, prefixes })
  },
})
