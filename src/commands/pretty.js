import { defineCommand } from 'citty'
import { NQUADS, NTRIPLES, TRIG, TURTLE, resolveFormat } from '../formats.js'
import { readFromStdin } from '../sources/stdin.js'
import { loadPrefixes, writePretty } from '../sinks/pretty.js'
import { fail } from './shared.js'

export default defineCommand({
  io: { stdin: 'NQuads', stdout: 'RDF' },
  meta: {
    name: 'pretty',
    description: 'Read an N-Quads dataset stream from stdin and render TriG, Turtle, N-Quads, or N-Triples.',
  },
  args: {
    format: {
      type: 'string',
      alias: 'f',
      description: 'Output format: trig (default), turtle, nquads, or ntriples. Triple-only formats drop graph assignments.',
      default: 'trig',
    },
    prefixes: {
      type: 'string',
      alias: 'p',
      description: 'Path to prefixes JSON file (auto-discovered: .prefixes.json)',
    },
  },
  async run ({ args }) {
    const source = await readFromStdin(NQUADS)
    const format = resolveFormat(args.format)
    if (![TRIG, TURTLE, NQUADS, NTRIPLES].includes(format)) fail(`unsupported output format: ${args.format}`)
    const prefixes = await loadPrefixes(args.prefixes)
    await writePretty(source, { format, prefixes })
  },
})
