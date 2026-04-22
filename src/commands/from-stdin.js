import { defineCommand } from 'citty'
import { readQuadStreamFromStdin, readStdin, resolveFormat, writeDatasetAsNQ, writeQuadStreamAsNQ } from '../io.js'

export default defineCommand({
  meta: { name: 'from-stdin', description: 'Parse RDF from stdin bytes → dataset stream on stdout' },
  args: {
    format: { type: 'string', alias: 'f', description: 'Input format for stdin (auto-detected by default)' },
  },
  async run({ args }) {
    const format = resolveFormat(args.format)
    if (format) {
      await writeQuadStreamAsNQ(readQuadStreamFromStdin(format))
      return
    }

    writeDatasetAsNQ(await readStdin(format))
  },
})
