import { defineCommand } from 'citty'
import { toString, TURTLE, TRIG } from '../../lib/outputs.js'
import { readStdin, resolveFormat, loadPrefixes } from '../lib/io.js'

export default defineCommand({
  meta: { name: 'pretty', description: 'N-Quads stdin → pretty-printed Turtle or TriG' },
  args: {
    format: { type: 'string', alias: 'f', description: 'Output format: turtle (default) or trig', default: 'turtle' },
    prefixes: { type: 'string', alias: 'p', description: 'Path to prefixes JSON file (auto-discovered: .prefixes.json)' },
    'input-format': { type: 'string', description: 'Input format (default: n-quads)' },
  },
  async run({ args }) {
    const inputFormat = resolveFormat(args['input-format']) || 'application/n-quads'
    const outputFormat = args.format.toLowerCase() === 'trig' ? TRIG : TURTLE
    const dataset = await readStdin(inputFormat)
    const prefixes = await loadPrefixes(args.prefixes)
    process.stdout.write(await toString([{ dataset }], { format: outputFormat, prefixes }))
  },
})
