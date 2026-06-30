import { glob } from 'glob'
import { fileURLToPath } from 'node:url'
import { Readable } from 'node:stream'
import rdf from 'rdf-ext'
import Validator from 'shacl-engine/Validator.js'
import { streamFileQuads } from '../sources/glob.js'
import { collectDataset } from '../utils.js'

const BUILTIN_SHAPES = {
  shacl: fileURLToPath(new URL('../../resources/shacl-shacl.ttl', import.meta.url)),
  skos: fileURLToPath(new URL('../../resources/skos-shacl.ttl', import.meta.url)),
}

export function resolveBuiltinShapes (name) {
  return BUILTIN_SHAPES[name] ?? null
}

async function loadShapesDataset (patterns) {
  const files = (
    await Promise.all(patterns.map((pattern) => glob(pattern, { nodir: true })))
  ).flat()
  if (files.length === 0)
    throw new Error(`no shapes files matched: ${patterns.join(', ')}`)

  const shapes = rdf.dataset()
  for (const file of files) {
    try {
      for await (const quad of streamFileQuads(file)) {
        shapes.add(rdf.quad(quad.subject, quad.predicate, quad.object))
      }
    } catch (error) {
      throw new Error(`cannot load shapes ${file}: ${error}`)
    }
  }
  return shapes
}

function reportToNamedGraph (report, graphURI) {
  const graph = rdf.namedNode(graphURI)
  const named = rdf.dataset()
  for (const quad of report.dataset) {
    named.add(rdf.quad(quad.subject, quad.predicate, quad.object, graph))
  }
  return named
}

export async function createValidateStream (source, shapeSources, { reportGraph = 'urn:validation-report' } = {}) {
  const [dataDataset, shapesDataset] = await Promise.all([
    collectDataset(source),
    loadShapesDataset(shapeSources),
  ])

  const validator = new Validator(shapesDataset, { factory: rdf })
  const report = await validator.validate({ dataset: dataDataset })
  const quads = [...dataDataset, ...reportToNamedGraph(report, reportGraph)]

  return {
    stream: Readable.from(quads, { objectMode: true }),
    conforms: report.conforms,
    report,
  }
}

// --- Report formatting ---

function termValue (term) {
  if (!term) return ''
  if (Array.isArray(term)) return term.map(termValue).join('; ')
  if (term.termType === 'BlankNode') return '[blank node]'
  return term.value ?? String(term)
}

function pathToString (path) {
  if (!path || path.length === 0) return ''
  return path.map((step) => {
    const pred = step.predicates?.[0]?.value ?? ''
    if (step.start === 'object') return `^<${pred}>`
    if (step.quantifier === 'oneOrMore') return `<${pred}>+`
    if (step.quantifier === 'zeroOrMore') return `<${pred}>*`
    if (step.quantifier === 'zeroOrOne') return `<${pred}>?`
    return `<${pred}>`
  }).join(' / ')
}

export function summarizeReport (report) {
  return {
    conforms: report.conforms,
    violationCount: report.results.length,
    results: report.results.map((r) => ({
      focusNode: r.focusNode?.terms?.[0]?.value ?? '',
      path: pathToString(r.path),
      severity: termValue(r.severity),
      sourceConstraint: termValue(r.constraintComponent),
      message: r.message.map((m) => m.value).join('; '),
      value: r.value?.terms?.[0] ? termValue(r.value.terms[0]) : '',
    })),
  }
}

export function formatMarkdownReport (summary, { label = 'SHACL Validation' } = {}) {
  const lines = [
    `## ${label}`,
    '',
    `- **Conforms**: ${summary.conforms ? 'yes' : 'no'}`,
    `- **Violations**: ${summary.violationCount}`,
  ]

  if (summary.results.length > 0) {
    lines.push('', '### Results', '')
    for (const [i, r] of summary.results.entries()) {
      lines.push(`**${i + 1}.** Focus node: \`${r.focusNode}\``)
      if (r.path) lines.push(`   Path: \`${r.path}\``)
      lines.push(`   Severity: \`${r.severity}\``)
      lines.push(`   Constraint: \`${r.sourceConstraint}\``)
      if (r.message) lines.push(`   Message: ${r.message}`)
      if (r.value) lines.push(`   Value: \`${r.value}\``)
      lines.push('')
    }
  }

  return lines.join('\n')
}
