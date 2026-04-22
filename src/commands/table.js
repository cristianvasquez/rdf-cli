import { defineCommand } from 'citty'

function csvEscape(value) {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function toCSV(rows) {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  return [
    headers.join(','),
    ...rows.map(row => headers.map(header => csvEscape(String(row[header] ?? ''))).join(',')),
  ].join('\n') + '\n'
}

function toTSV(rows) {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  return [
    headers.join('\t'),
    ...rows.map(row => headers.map(header => String(row[header] ?? '').replace(/\t/g, ' ')).join('\t')),
  ].join('\n') + '\n'
}

function toJSONL(rows) {
  return rows.map(row => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : '')
}

async function readRows() {
  const input = await new Promise((resolve, reject) => {
    let text = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', chunk => { text += chunk })
    process.stdin.on('end', () => resolve(text))
    process.stdin.on('error', reject)
  })

  return input
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => JSON.parse(line))
}

export default defineCommand({
  meta: { name: 'table', description: 'Render bindings stream as CSV, TSV, or JSON Lines' },
  args: {
    format: { type: 'string', alias: 'f', description: 'Output format: csv (default), tsv, jsonl', default: 'csv' },
  },
  async run({ args }) {
    const rows = await readRows()
    const format = (args.format || 'csv').toLowerCase()

    if (format === 'tsv') process.stdout.write(toTSV(rows))
    else if (format === 'jsonl') process.stdout.write(toJSONL(rows))
    else process.stdout.write(toCSV(rows))
  },
})
