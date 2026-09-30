import { defineCommand } from 'citty'
import { NQUADS } from '../formats.js'
import { readFromStdin } from '../sources/stdin.js'
import { writeQuads } from '../sinks/quads.js'
import { queryArgs, readQuery } from './shared.js'
import { materialize, construct } from '../transforms/sparql.js'

export default defineCommand({
  io: { stdin: 'NQuads', stdout: 'NQuads' },
  meta: {
    name: 'construct',
    description:
      'Read an N-Quads dataset stream from stdin, run SPARQL CONSTRUCT, and emit N-Quads. ' +
      'Output is always graphless (all triples go into the default graph). ' +
      'GRAPH clauses in the CONSTRUCT template are not supported by the SPARQL engine — ' +
      'they cause a cryptic parse error ("expected one of \'.\', \':\'"). ' +
      'To assign a named graph to the output, pipe through map -g.',
  },
  args: queryArgs('CONSTRUCT'),
  async run ({ args }) {
    const query = await readQuery(args)
    const store = await materialize(await readFromStdin(NQUADS))
    await writeQuads(construct(store, query))
  },
})
