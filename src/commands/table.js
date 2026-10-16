import { defineCommand } from 'citty'
import { readResults, writeTable } from '../sinks/table.js'
import { fail } from './shared.js'

export default defineCommand({
  io: { stdin: 'JSONLinesBindings', stdout: 'ResultsDocument' },
  meta: {
    name: 'table',
    description: 'Serialize SPARQL results as CSV, TSV, or JSON.',
  },
  args: {
    format: {
      type: 'string',
      alias: 'f',
      description: 'Output format: csv (default), tsv, or json (SPARQL 1.1 results)',
      default: 'csv',
    },
  },
  async run ({ args }) {
    const format = (args.format || 'csv').toLowerCase()
    if (!['csv', 'tsv', 'json'].includes(format)) fail(`unsupported table format: ${args.format}`)
    await writeTable(await readResults(process.stdin), { format })
  },
})
