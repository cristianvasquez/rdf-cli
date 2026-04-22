import { defineCommand } from 'citty'
import { readFile } from 'node:fs/promises'
import { readStdin, resolveFormat } from '../io.js'
import { datasetToStore, storeSelect } from '../store.js'

function termValue(term) {
  if (!term) return ''
  if (term.termType === 'BlankNode') return `_:${term.value}`
  return term.value
}

function toJSONL(rows) {
  for (const row of rows) {
    process.stdout.write(`${JSON.stringify(Object.fromEntries(Object.entries(row).map(([key, value]) => [key, termValue(value)])))}\n`)
  }
}

export default defineCommand({
  meta: { name: 'select', description: 'SPARQL SELECT on dataset stream stdin → bindings stream (JSON Lines)' },
  args: {
    query: { type: 'positional', description: 'SPARQL SELECT query string' },
    'query-file': { type: 'string', description: 'Read SPARQL query from file instead' },
    format: { type: 'string', alias: 'f', description: 'Input format (default: n-quads)' },
  },
  async run({ args }) {
    const query = args['query-file'] ? await readFile(args['query-file'], 'utf8') : args.query
    if (!query) {
      process.stderr.write('error: provide a SPARQL query as argument or via --query-file\n')
      process.exit(1)
    }

    toJSONL(storeSelect(
      datasetToStore(await readStdin(resolveFormat(args.format) || 'application/n-quads')),
      query,
    ))
  },
})
