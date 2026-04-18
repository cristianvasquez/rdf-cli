import { defineCommand } from 'citty'
import { readFile } from 'fs/promises'
import { datasetToStore, storeConstruct } from '../lib/store.js'
import { readStdin, resolveFormat, writeDatasetAsNQ } from '../lib/io.js'

export default defineCommand({
  meta: { name: 'construct', description: 'SPARQL CONSTRUCT on N-Quads stdin → N-Quads stdout' },
  args: {
    query: { type: 'positional', description: 'SPARQL CONSTRUCT query string' },
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
    writeDatasetAsNQ(storeConstruct(store, queryStr))
  },
})
