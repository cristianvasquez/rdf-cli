import { defineCommand } from 'citty'
import rdf from 'rdf-ext'
import { readStdin, resolveFormat, writeDatasetAsNQ } from '../io.js'

export default defineCommand({
  meta: { name: 'graph-drop', description: 'Drop graph terms while staying in dataset space' },
  args: {
    format: { type: 'string', alias: 'f', description: 'Input format (default: n-quads)' },
  },
  async run({ args }) {
    const input = await readStdin(resolveFormat(args.format) || 'application/n-quads')
    const dataset = rdf.dataset()

    for (const quad of input) {
      dataset.add(rdf.quad(quad.subject, quad.predicate, quad.object, rdf.defaultGraph()))
    }

    writeDatasetAsNQ(dataset)
  },
})
