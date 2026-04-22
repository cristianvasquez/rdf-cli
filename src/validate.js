import { glob } from 'glob'
import rdf from 'rdf-ext'
import { fileURLToPath } from 'node:url'
import Validator from 'shacl-engine/Validator.js'
import { parseFile } from './inputs.js'

const BUILTIN_SHAPES = {
  shacl: fileURLToPath(new URL('../resources/shacl-shacl.ttl', import.meta.url)),
  skos: fileURLToPath(new URL('../resources/skos-shacl.ttl', import.meta.url)),
}

export function resolveBuiltinShapes(name) {
  return BUILTIN_SHAPES[name] ?? null
}

export async function loadShapesDataset(patterns) {
  const files = (await Promise.all(patterns.map(pattern => glob(pattern, { nodir: true })))).flat()
  if (files.length === 0) throw new Error(`no shapes files matched: ${patterns.join(', ')}`)

  const shapes = rdf.dataset()
  for (const file of files) {
    const { dataset, error } = await parseFile(file)
    if (error) throw new Error(`cannot load shapes ${file}: ${error}`)
    for (const quad of dataset) shapes.add(rdf.quad(quad.subject, quad.predicate, quad.object))
  }
  return shapes
}

export async function runValidation(dataDataset, shapesDataset) {
  const validator = new Validator(shapesDataset, { factory: rdf })
  return validator.validate({ dataset: dataDataset })
}

export function reportToNamedGraph(report, graphURI) {
  const graph = rdf.namedNode(graphURI)
  const named = rdf.dataset()
  for (const quad of report.dataset) {
    named.add(rdf.quad(quad.subject, quad.predicate, quad.object, graph))
  }
  return named
}
