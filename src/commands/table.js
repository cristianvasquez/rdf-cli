import { defineCommand } from 'citty'
import { writeTable } from '../sinks/table.js'
import { fail } from './shared.js'

export default defineCommand({
  io: { stdin: 'JSONLinesBindings', stdout: 'Text' },
  meta: {
    name: 'table',
    description: 'Render bindings as CSV or TSV.',
  },
  args: {
    format: {
      type: 'string',
      alias: 'f',
      description: 'Output format: csv (default) or tsv',
      default: 'csv',
    },
  },
  async run ({ args }) {
    const format = (args.format || 'csv').toLowerCase()
    if (format !== 'csv' && format !== 'tsv') fail(`unsupported table format: ${args.format}`)
    await writeTable(process.stdin, { format })
  },
})
