import { defineCommand } from 'citty'
import { glob } from 'glob'
import rdf from 'rdf-ext'
import { parseFile } from '../inputs.js'
import { readStdin, resolveFormat, writeDatasetAsNQ } from '../io.js'

function pathAsGraph(path) {
  const normalized = path.replace(/\\/g, '/')
  if (/^[a-zA-Z]:/.test(normalized)) return rdf.namedNode(`file:///${normalized}`)
  return rdf.namedNode(`file://${normalized.startsWith('/') ? '' : './'}${normalized}`)
}

export default defineCommand({
  meta: { name: 'to-quads', description: 'Parse RDF files (or stdin) → N-Quads on stdout' },
  args: {
    format: { type: 'string', alias: 'f', description: 'Input format for stdin (auto-detected by default)' },
  },
  async run({ args }) {
    const globs = args._ || []

    if (globs.length === 0) {
      writeDatasetAsNQ(await readStdin(resolveFormat(args.format)))
      return
    }

    const files = (await Promise.all(globs.map(pattern => glob(pattern, { stat: true, nodir: true })))).flat()
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
