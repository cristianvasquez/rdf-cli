import { readLines } from '../utils.js'

function csvEscape (value) {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function formatCSVRow (row, headers) {
  return `${headers.map((h) => csvEscape(String(row[h] ?? ''))).join(',')}\n`
}

function formatTSVRow (row, headers) {
  return `${headers.map((h) => String(row[h] ?? '').replace(/\t/g, ' ')).join('\t')}\n`
}

export async function writeTable (stream, { format = 'csv', out = process.stdout } = {}) {
  let headers = null

  for await (const line of readLines(stream)) {
    const row = JSON.parse(line)

    if (format === 'jsonl') {
      out.write(`${JSON.stringify(row)}\n`)
      continue
    }

    if (!headers) {
      headers = Object.keys(row)
      out.write(format === 'tsv' ? `${headers.join('\t')}\n` : `${headers.join(',')}\n`)
    }

    out.write(format === 'tsv' ? formatTSVRow(row, headers) : formatCSVRow(row, headers))
  }
}
