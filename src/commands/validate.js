import { defineCommand } from 'citty'
import { NQUADS } from '../formats.js'
import { readFromStdin } from '../sources/stdin.js'
import { writeQuads } from '../sinks/quads.js'
import { createValidateStream, formatMarkdownReport, resolveBuiltinShapes, summarizeReport } from '../transforms/shacl.js'

const DEFAULT_GRAPH = 'urn:validation-report'

export default defineCommand({
  io: { stdin: 'NQuads', stdout: 'NQuads' },
  meta: {
    name: 'validate',
    description: 'Validate a dataset stream against SHACL shapes',
  },
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
  async run ({ args }) {
    const shapeSources = []

    if (args.shapes) {
      for (const pattern of String(args.shapes).split(',').map((s) => s.trim()).filter(Boolean)) {
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

    const source = await readFromStdin(NQUADS)
    const { stream, conforms, report } = await createValidateStream(source, shapeSources, {
      reportGraph: args['report-graph'] ?? DEFAULT_GRAPH,
    })

    await writeQuads(stream)

    if (args['markdown-report']) {
      const label = args.builtin
        ? `SHACL Validation (${String(args.builtin).toUpperCase()})`
        : 'SHACL Validation'
      process.stderr.write(`${formatMarkdownReport(summarizeReport(report), { label })}\n`)
    }

    if (!conforms) process.exitCode = 1
  },
})
