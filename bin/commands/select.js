import { defineCommand } from 'citty'
import { readFile } from 'fs/promises'
import { datasetToStore, storeSelect } from '../lib/store.js'
import { readStdin, resolveFormat } from '../lib/io.js'

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
    ...rows.map(row => headers.map(h => csvEscape(termValue(row[h]))).join(',')),
  ].join('\n') + '\n'
}

function toTSV(rows) {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  return [
    headers.join('\t'),
    ...rows.map(row => headers.map(h => termValue(row[h]).replace(/\t/g, ' ')).join('\t')),
  ].join('\n') + '\n'
}

function toJSONL(rows) {
  return rows.map(row => {
    const obj = Object.fromEntries(Object.entries(row).map(([k, v]) => [k, termValue(v)]))
    return JSON.stringify(obj)
  }).join('\n') + (rows.length ? '\n' : '')
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
    const queryStr = args['query-file']
      ? await readFile(args['query-file'], 'utf8')
      : args.query
    if (!queryStr) {
      process.stderr.write('error: provide a SPARQL query as argument or via --query-file\n')
      process.exit(1)
    }
    const dataset = await readStdin(resolveFormat(args.format) || 'application/n-quads')
    const store = datasetToStore(dataset)
    const rows = storeSelect(store, queryStr)
    const out = (args.output || 'csv').toLowerCase()
    if (out === 'tsv') process.stdout.write(toTSV(rows))
    else if (out === 'json') process.stdout.write(toJSONL(rows))
    else process.stdout.write(toCSV(rows))
  },
})
