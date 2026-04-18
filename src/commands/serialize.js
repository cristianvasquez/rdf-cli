import { defineCommand } from 'citty'
import { readStdin, resolveFormat, termToNQ, writeDatasetAsNQ } from '../io.js'

export default defineCommand({
  meta: { name: 'serialize', description: 'N-Quads stdin → compact N-Quads or N-Triples' },
  args: {
    format: { type: 'string', alias: 'f', description: 'Output format: nquads (default) or ntriples', default: 'nquads' },
    'input-format': { type: 'string', description: 'Input format (default: n-quads)' },
  },
  async run({ args }) {
    const dataset = await readStdin(resolveFormat(args['input-format']) || 'application/n-quads')
    const outputFormat = resolveFormat(args.format) || 'application/n-quads'

    if (outputFormat === 'application/n-triples') {
      for (const quad of dataset) {
        process.stdout.write(`${termToNQ(quad.subject)} ${termToNQ(quad.predicate)} ${termToNQ(quad.object)} .\n`)
      }
      return
    }

    writeDatasetAsNQ(dataset)
  },
})
