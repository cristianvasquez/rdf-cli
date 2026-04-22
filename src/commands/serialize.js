import { defineCommand } from 'citty'
import rdf from 'rdf-ext'
import { readQuadStreamFromStdin, readStdin, resolveFormat, termToNQ, writeDatasetAsNQ, writeQuadStreamAsNQ } from '../io.js'

export default defineCommand({
  meta: { name: 'serialize', description: 'Serialize dataset stream as N-Quads or N-Triples' },
  args: {
    format: { type: 'string', alias: 'f', description: 'Output format: nquads (default) or ntriples', default: 'nquads' },
    'input-format': { type: 'string', description: 'Input format (default: n-quads)' },
  },
  async run({ args }) {
    const inputFormat = resolveFormat(args['input-format']) || 'application/n-quads'
    const outputFormat = resolveFormat(args.format) || 'application/n-quads'

    if (inputFormat === 'application/n-quads') {
      if (outputFormat === 'application/n-triples') {
        await writeQuadStreamAsNQ(
          readQuadStreamFromStdin(inputFormat),
          quad => rdf.quad(quad.subject, quad.predicate, quad.object, rdf.defaultGraph()),
        )
        return
      }

      await writeQuadStreamAsNQ(readQuadStreamFromStdin(inputFormat))
      return
    }

    const dataset = await readStdin(inputFormat)
    if (outputFormat === 'application/n-triples') {
      for (const quad of dataset) {
        process.stdout.write(`${termToNQ(quad.subject)} ${termToNQ(quad.predicate)} ${termToNQ(quad.object)} .\n`)
      }
      return
    }

    writeDatasetAsNQ(dataset)
  },
})
