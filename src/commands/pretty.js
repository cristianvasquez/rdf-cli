import { defineCommand } from 'citty'
import { readStdin, resolveFormat, loadPrefixes } from '../io.js'
import { datasetToString, TRIG, TURTLE } from '../outputs.js'

export default defineCommand({
  meta: { name: 'pretty', description: 'N-Quads stdin → pretty-printed Turtle or TriG' },
  args: {
    format: { type: 'string', alias: 'f', description: 'Output format: turtle (default) or trig', default: 'turtle' },
    prefixes: { type: 'string', alias: 'p', description: 'Path to prefixes JSON file (auto-discovered: .prefixes.json)' },
    'input-format': { type: 'string', description: 'Input format (default: n-quads)' },
  },
  async run({ args }) {
    const dataset = await readStdin(resolveFormat(args['input-format']) || 'application/n-quads')
    const format = args.format.toLowerCase() === 'trig' ? TRIG : TURTLE
    const prefixes = await loadPrefixes(args.prefixes)
    process.stdout.write(await datasetToString(dataset, { format, prefixes }))
  },
})
