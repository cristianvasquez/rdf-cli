import { defineCommand } from 'citty'
import { getStreamAsBuffer } from 'get-stream'
import { Readable } from 'stream'
import formats from '@rdfjs/formats'
import rdf from 'rdf-ext'
import { resolveFormat, termToNQ, detectFormat } from '../lib/io.js'

async function readFileAsDataset(filePath, hintFormat) {
  const { createReadStream } = await import('fs')
  const buffer = await getStreamAsBuffer(createReadStream(filePath))
  const format = hintFormat || detectFormat(buffer.toString('utf8', 0, 500))
  if (!format) {
    process.stderr.write(`error: cannot detect format for ${filePath} — use --format\n`)
    process.exit(1)
  }
  const stream = Readable.from([buffer])
  const dataset = rdf.dataset()
  await dataset.import(formats.parsers.import(format, stream))
  return dataset
}

function toTriples(dataset) {
  const result = rdf.dataset()
  for (const quad of dataset) {
    result.add(rdf.quad(quad.subject, quad.predicate, quad.object, rdf.defaultGraph()))
  }
  return result
}

const ADDED = rdf.namedNode('urn:added')
const REMOVED = rdf.namedNode('urn:removed')

export default defineCommand({
  meta: { name: 'diff', description: 'Diff two N-Quads files → N-Quads with <urn:added> / <urn:removed> graphs' },
  args: {
    old: { type: 'positional', description: 'Old N-Quads file (or process substitution)' },
    new: { type: 'positional', description: 'New N-Quads file (or process substitution)' },
    format: { type: 'string', alias: 'f', description: 'Input format for both files (default: n-quads)' },
  },
  async run({ args }) {
    const fmt = resolveFormat(args.format) || 'application/n-quads'
    const [oldDataset, newDataset] = await Promise.all([
      readFileAsDataset(args.old, fmt),
      readFileAsDataset(args.new, fmt),
    ])

    const oldTriples = toTriples(oldDataset)
    const newTriples = toTriples(newDataset)

    for (const quad of newTriples.difference(oldTriples)) {
      process.stdout.write(`${termToNQ(quad.subject)} ${termToNQ(quad.predicate)} ${termToNQ(quad.object)} <urn:added> .\n`)
    }
    for (const quad of oldTriples.difference(newTriples)) {
      process.stdout.write(`${termToNQ(quad.subject)} ${termToNQ(quad.predicate)} ${termToNQ(quad.object)} <urn:removed> .\n`)
    }
  },
})
