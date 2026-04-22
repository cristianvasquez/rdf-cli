import { defineCommand } from 'citty'
import { readStdin, resolveFormat, writeDatasetAsNQ } from '../io.js'

export default defineCommand({
  meta: { name: 'from-stdin', description: 'Parse RDF from stdin bytes → dataset stream on stdout' },
  args: {
    format: { type: 'string', alias: 'f', description: 'Input format for stdin (auto-detected by default)' },
  },
  async run({ args }) {
    writeDatasetAsNQ(await readStdin(resolveFormat(args.format)))
  },
})
