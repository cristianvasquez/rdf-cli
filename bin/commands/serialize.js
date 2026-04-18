import { defineCommand } from 'citty'
import { readStdin, resolveFormat, writeDatasetAsNQ, termToNQ } from '../lib/io.js'

// Compact line-based serialization: N-Quads (default, preserves graphs) or N-Triples (drops graphs)
export default defineCommand({
  meta: { name: 'serialize', description: 'N-Quads stdin → compact N-Quads or N-Triples' },
  args: {
    format: { type: 'string', alias: 'f', description: 'Output format: nquads (default) or ntriples', default: 'nquads' },
    'input-format': { type: 'string', description: 'Input format (default: n-quads)' },
  },
  async run({ args }) {
    const inputFormat = resolveFormat(args['input-format']) || 'application/n-quads'
    const outputFormat = resolveFormat(args.format) || 'application/n-quads'
    const dataset = await readStdin(inputFormat)

    if (outputFormat === 'application/n-triples') {
      for (const quad of dataset) {
        process.stdout.write(`${termToNQ(quad.subject)} ${termToNQ(quad.predicate)} ${termToNQ(quad.object)} .\n`)
      }
    } else {
      writeDatasetAsNQ(dataset)
    }
  },
})
