import { createInterface } from 'node:readline'
import rdf from 'rdf-ext'

export async function collectDataset (source) {
  const dataset = rdf.dataset()
  for await (const quad of source) dataset.add(quad)
  return dataset
}

export async function * readLines (stream) {
  const rl = createInterface({ input: stream, crlfDelay: Infinity })
  for await (const line of rl) {
    const trimmed = line.trim()
    if (trimmed) yield trimmed
  }
}
