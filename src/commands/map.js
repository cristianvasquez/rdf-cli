import { defineCommand } from 'citty'
import { NQUADS } from '../formats.js'
import { readFromStdin } from '../sources/stdin.js'
import { toReadable, writeQuads } from '../sinks/quads.js'
import { mapQuads } from '../transforms/quadExpr.js'
import { fail } from './shared.js'

const MAX_REPORTED = 10

export default defineCommand({
  io: { stdin: 'NQuads', stdout: 'NQuads' },
  meta: {
    name: 'map',
    description:
      'Rewrite the quads that match --where with SPARQL expressions. ' +
      'Each rewrite is a SPARQL expression over one quad: ?s ?p ?o ?g (?g is unbound in the default graph). ' +
      'Non-matching quads pass unchanged. If a rewrite fails or gives a term invalid for its position, ' +
      'the quad passes unchanged, the error goes to stderr, and the exit code is 1. ' +
      'Examples: -g \'<urn:batch>\' --where \'!bound(?g)\' assigns a graph to graphless quads; -g default removes graphs.',
  },
  args: {
    where: { type: 'string', alias: 'w', description: 'Match expression (default: true). An error counts as false.', default: 'true' },
    subject: { type: 'string', alias: 's', description: 'Subject rewrite expression' },
    predicate: { type: 'string', alias: 'p', description: 'Predicate rewrite expression' },
    object: { type: 'string', alias: 'o', description: 'Object rewrite expression' },
    graph: { type: 'string', alias: 'g', description: 'Graph rewrite expression, or "default" for the default graph' },
  },
  async run ({ args }) {
    const rewrite = { subject: args.subject, predicate: args.predicate, object: args.object, graph: args.graph }
    let errors = 0
    const onMapError = ({ quad, message }) => {
      errors++
      if (errors <= MAX_REPORTED) {
        process.stderr.write(`error: map: ${message}: ${quad.subject.value} ${quad.predicate.value} ${quad.object.value}\n`)
      }
    }
    let transform
    try {
      transform = mapQuads(args.where, rewrite, onMapError)
    } catch (error) {
      fail(error.message.startsWith('map:') ? error.message : `map: ${error.message}`)
    }
    await writeQuads(toReadable(await readFromStdin(NQUADS)).pipe(transform))
    if (errors > 0) {
      process.stderr.write(`error: map: ${errors} quad(s) failed; they passed unchanged\n`)
      process.exitCode = 1
    }
  },
})
