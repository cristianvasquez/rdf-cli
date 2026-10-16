import { defineCommand } from 'citty'
import { NQUADS } from '../formats.js'
import { readFromStdin } from '../sources/stdin.js'
import { writeBindings } from '../sinks/bindings.js'
import { queryArgs, readQuery } from './shared.js'
import { materialize, select } from '../transforms/sparql.js'

export default defineCommand({
  io: { stdin: 'NQuads', stdout: 'JSONLinesBindings' },
  meta: {
    name: 'select',
    description:
      'Run a SPARQL SELECT and emit SPARQL JSON results as a head line followed by binding lines.',
  },
  args: queryArgs('SELECT'),
  async run ({ args }) {
    const query = await readQuery(args)
    const store = await materialize(await readFromStdin(NQUADS))
    await writeBindings(select(store, query))
  },
})
