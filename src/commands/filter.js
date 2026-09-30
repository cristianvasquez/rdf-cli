import { defineCommand } from 'citty'
import { NQUADS } from '../formats.js'
import { readFromStdin } from '../sources/stdin.js'
import { toReadable, writeQuads } from '../sinks/quads.js'
import { filterQuads } from '../transforms/quadExpr.js'
import { fail } from './shared.js'

export default defineCommand({
  io: { stdin: 'NQuads', stdout: 'NQuads' },
  meta: {
    name: 'filter',
    description:
      'Read an N-Quads dataset stream from stdin and keep the quads where a SPARQL expression is true. ' +
      'The expression sees one quad: ?s ?p ?o ?g (?g is unbound in the default graph). ' +
      'An expression error counts as false.',
  },
  args: {
    expression: { type: 'positional', description: 'SPARQL expression, e.g. \'?p != <http://ex/p>\'', required: false },
  },
  async run ({ args }) {
    if (!args.expression) fail('provide a SPARQL expression')
    let transform
    try {
      transform = filterQuads(args.expression)
    } catch (error) {
      fail(`filter: ${error.message}`)
    }
    await writeQuads(toReadable(await readFromStdin(NQUADS)).pipe(transform))
  },
})
