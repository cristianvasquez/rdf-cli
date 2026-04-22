import { defineCommand } from 'citty'
import { readStdin, writeDatasetAsNQ } from '../io.js'
import { summarizeReport, formatMarkdownReport } from '../report.js'
import { loadShapesDataset, reportToNamedGraph, resolveBuiltinShapes, runValidation } from '../validate.js'

const DEFAULT_GRAPH = 'urn:validation-report'

export default defineCommand({
  meta: { name: 'validate', description: 'Validate a dataset stream against SHACL shapes' },
  args: {
    shapes: {
      type: 'string',
      description: 'Comma-separated glob patterns for SHACL shapes file(s)',
    },
    builtin: {
      type: 'string',
      description: 'Built-in shapes set: shacl or skos',
    },
    'report-graph': {
      type: 'string',
      description: `Named graph URI for the validation report (default: <${DEFAULT_GRAPH}>)`,
    },
    'markdown-report': {
      type: 'boolean',
      description: 'Print a Markdown validation summary to stderr',
    },
  },
  async run({ args }) {
    const shapeSources = []

    if (args.shapes) {
      for (const pattern of String(args.shapes).split(',').map(s => s.trim()).filter(Boolean)) {
        shapeSources.push(pattern)
      }
    }

    if (args.builtin) {
      const builtinName = String(args.builtin).toLowerCase()
      const builtinPath = resolveBuiltinShapes(builtinName)
      if (!builtinPath) {
        process.stderr.write('error: --builtin must be one of: shacl, skos\n')
        process.exit(1)
      }
      shapeSources.push(builtinPath)
    }

    if (shapeSources.length === 0) {
      process.stderr.write('error: provide --shapes or --builtin\n')
      process.exit(1)
    }

    const graphURI = args['report-graph'] ?? DEFAULT_GRAPH
    const [dataDataset, shapesDataset] = await Promise.all([
      readStdin('application/n-quads'),
      loadShapesDataset(shapeSources),
    ])

    const report = await runValidation(dataDataset, shapesDataset)
    writeDatasetAsNQ(dataDataset)
    writeDatasetAsNQ(reportToNamedGraph(report, graphURI))

    if (args['markdown-report']) {
      const label = args.builtin ? `SHACL Validation (${String(args.builtin).toUpperCase()})` : 'SHACL Validation'
      process.stderr.write(`${formatMarkdownReport(summarizeReport(report), { label })}\n`)
    }

    if (!report.conforms) process.exit(1)
  },
})
