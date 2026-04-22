import { defineCommand } from 'citty'
import { readLines } from '../io.js'

function csvEscape(value) {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function writeCSVHeader(headers) {
  process.stdout.write(`${headers.join(',')}\n`)
}

function writeCSVRow(row, headers) {
  process.stdout.write(`${headers.map(header => csvEscape(String(row[header] ?? ''))).join(',')}\n`)
}

function writeTSVHeader(headers) {
  process.stdout.write(`${headers.join('\t')}\n`)
}

function writeTSVRow(row, headers) {
  process.stdout.write(`${headers.map(header => String(row[header] ?? '').replace(/\t/g, ' ')).join('\t')}\n`)
}

function writeJSONLRow(row) {
  process.stdout.write(`${JSON.stringify(row)}\n`)
}

export default defineCommand({
  meta: { name: 'table', description: 'Render bindings stream as CSV, TSV, or JSON Lines' },
  args: {
    format: { type: 'string', alias: 'f', description: 'Output format: csv (default), tsv, jsonl', default: 'csv' },
  },
  async run({ args }) {
    const format = (args.format || 'csv').toLowerCase()
    let headers = null

    for await (const line of readLines(process.stdin)) {
      const row = JSON.parse(line)

      if (format === 'jsonl') {
        writeJSONLRow(row)
        continue
      }

      if (!headers) {
        headers = Object.keys(row)
        if (format === 'tsv') writeTSVHeader(headers)
        else writeCSVHeader(headers)
      }

      if (format === 'tsv') writeTSVRow(row, headers)
      else writeCSVRow(row, headers)
    }
  },
})
