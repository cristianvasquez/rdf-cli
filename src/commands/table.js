import { defineCommand } from 'citty'
import { writeTable } from '../sinks/table.js'

export default defineCommand({
  io: { stdin: 'JSONLinesBindings', stdout: 'Text' },
  meta: {
    name: 'table',
    description: 'Read JSON Lines bindings from stdin and render CSV, TSV, or JSON Lines.',
  },
  args: {
    format: {
      type: 'string',
      alias: 'f',
      description: 'Output format: csv (default), tsv, jsonl',
      default: 'csv',
    },
  },
  async run ({ args }) {
    await writeTable(process.stdin, { format: (args.format || 'csv').toLowerCase() })
  },
})
