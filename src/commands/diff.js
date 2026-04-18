import { defineCommand } from 'citty'
import { createReadStream } from 'node:fs'
import { readDatasetFromStream, resolveFormat, termToNQ } from '../io.js'

function toTriples(dataset) {
  return [...dataset].map(quad => `${termToNQ(quad.subject)} ${termToNQ(quad.predicate)} ${termToNQ(quad.object)} .`)
}

async function readFileAsDataset(filePath, hintFormat) {
  return readDatasetFromStream(
    createReadStream(filePath),
    hintFormat,
    `error: cannot detect format for ${filePath} — use --format`,
  )
}

export default defineCommand({
  meta: { name: 'diff', description: 'Diff two N-Quads files → N-Quads with <urn:added> / <urn:removed> graphs' },
  args: {
    old: { type: 'positional', description: 'Old N-Quads file (or process substitution)' },
    new: { type: 'positional', description: 'New N-Quads file (or process substitution)' },
    format: { type: 'string', alias: 'f', description: 'Input format for both files (default: n-quads)' },
  },
  async run({ args }) {
    const format = resolveFormat(args.format) || 'application/n-quads'
    const [oldDataset, newDataset] = await Promise.all([
      readFileAsDataset(args.old, format),
      readFileAsDataset(args.new, format),
    ])

    const oldTriples = new Set(toTriples(oldDataset))
    const newTriples = new Set(toTriples(newDataset))

    for (const triple of newTriples) {
      if (!oldTriples.has(triple)) process.stdout.write(`${triple.slice(0, -2)} <urn:added> .\n`)
    }

    for (const triple of oldTriples) {
      if (!newTriples.has(triple)) process.stdout.write(`${triple.slice(0, -2)} <urn:removed> .\n`)
    }
  },
})
