import { defineCommand } from 'citty'
import { glob } from 'glob'
import rdf from 'rdf-ext'
import { parseFile } from '../../lib/inputs.js'
import { readStdin, resolveFormat, writeDatasetAsNQ } from '../lib/io.js'

function pathAsGraph(path) {
  path = path.replace(/\\/g, '/')
  if (/^[a-zA-Z]:/.test(path)) path = `file:///${path}`
  else path = `file://${path.startsWith('/') ? '' : './'}${path}`
  return rdf.namedNode(path)
}

export default defineCommand({
  meta: { name: 'to-quads', description: 'Parse RDF files (or stdin) → N-Quads on stdout' },
  args: {
    format: { type: 'string', alias: 'f', description: 'Input format for stdin (auto-detected by default)' },
  },
  async run({ args }) {
    const globs = args._ || []
    if (globs.length === 0) {
      const dataset = await readStdin(resolveFormat(args.format))
      writeDatasetAsNQ(dataset)
      return
    }
    const files = (await Promise.all(globs.map(g => glob(g, { stat: true, nodir: true })))).flat()
    if (files.length === 0) {
      process.stderr.write('warning: no files matched\n')
      return
    }
    for (const file of files) {
      const { dataset, error } = await parseFile(file, pathAsGraph)
      if (error) process.stderr.write(`error: ${file}: ${error}\n`)
      else writeDatasetAsNQ(dataset)
    }
  },
})
