import { defineCommand } from 'citty'
import { readStdin, resolveFormat, termToNQ } from '../lib/io.js'

export default defineCommand({
  meta: { name: 'to-triples', description: 'N-Quads → N-Triples (drop named graphs)' },
  args: {
    format: { type: 'string', alias: 'f', description: 'Input format (default: n-quads)' },
  },
  async run({ args }) {
    const dataset = await readStdin(resolveFormat(args.format) || 'application/n-quads')
    for (const quad of dataset) {
      const s = termToNQ(quad.subject)
      const p = termToNQ(quad.predicate)
      const o = termToNQ(quad.object)
      process.stdout.write(`${s} ${p} ${o} .\n`)
    }
  },
})
