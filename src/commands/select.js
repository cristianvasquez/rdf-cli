import { defineCommand } from 'citty'
import { readFile } from 'node:fs/promises'
import { readStdin, resolveFormat } from '../io.js'
import { datasetToStore, storeSelect } from '../store.js'

function termValue(term) {
  if (!term) return ''
  if (term.termType === 'BlankNode') return `_:${term.value}`
  return term.value
}

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
    ...rows.map(row => headers.map(header => csvEscape(termValue(row[header]))).join(',')),
  ].join('\n') + '\n'
}

function toTSV(rows) {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  return [
    headers.join('\t'),
    ...rows.map(row => headers.map(header => termValue(row[header]).replace(/\t/g, ' ')).join('\t')),
  ].join('\n') + '\n'
}

function toJSONL(rows) {
  return rows
    .map(row => JSON.stringify(Object.fromEntries(Object.entries(row).map(([key, value]) => [key, termValue(value)]))))
    .join('\n') + (rows.length ? '\n' : '')
}

export default defineCommand({
  meta: { name: 'select', description: 'SPARQL SELECT on N-Quads stdin → CSV/TSV/JSON' },
  args: {
    query: { type: 'positional', description: 'SPARQL SELECT query string' },
    output: { type: 'string', alias: 'o', description: 'Output format: csv, tsv, json (default: csv)', default: 'csv' },
    'query-file': { type: 'string', description: 'Read SPARQL query from file instead' },
    format: { type: 'string', alias: 'f', description: 'Input format (default: n-quads)' },
  },
  async run({ args }) {
    const query = args['query-file'] ? await readFile(args['query-file'], 'utf8') : args.query
    if (!query) {
      process.stderr.write('error: provide a SPARQL query as argument or via --query-file\n')
      process.exit(1)
    }

    const rows = storeSelect(
      datasetToStore(await readStdin(resolveFormat(args.format) || 'application/n-quads')),
      query,
    )
    const output = (args.output || 'csv').toLowerCase()

    if (output === 'tsv') process.stdout.write(toTSV(rows))
    else if (output === 'json') process.stdout.write(toJSONL(rows))
    else process.stdout.write(toCSV(rows))
  },
})
