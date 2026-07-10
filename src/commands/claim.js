import { defineCommand } from 'citty'
import { NQUADS } from '../formats.js'
import { readFromStdin } from '../sources/stdin.js'
import { streamFileQuads } from '../sources/paths.js'
import { writeQuads } from '../sinks/quads.js'
import { loadClaimer, applyClaimer, emitClaimer } from '../transforms/claimer.js'

export default defineCommand({
  io: { stdin: 'NQuads', stdout: 'NQuads' },
  meta: {
    name: 'claim',
    description:
      'Apply one claimer document to the N-Quads stream on stdin. ' +
      'The working set is the graphless subset of the input; quads already in a named ' +
      'graph were claimed upstream and pass through untouched. Claimed quads land in ' +
      'the claimer\'s :source graph, each view lands in its own graph, and the rest ' +
      'stays graphless. Cascade claimers by piping several claim commands; precedence ' +
      'is pipe order. Use graph-drop to make named data claimable.',
  },
  args: {
    claimer: {
      type: 'positional',
      description:
        'claimer document (e.g. TriG): exactly one named graph holding SHACL shapes ' +
        'plus views — subjects with a urn:rdf-cli:cascade#query value, the subject ' +
        'IRI naming the view\'s output graph',
    },
  },
  async run ({ args }) {
    if (!args.claimer) {
      process.stderr.write('error: provide a claimer document path\n')
      process.exit(1)
    }
    const documentQuads = []
    for await (const quad of streamFileQuads(args.claimer)) documentQuads.push(quad)

    let claimer
    try {
      claimer = loadClaimer(documentQuads)
    } catch (err) {
      process.stderr.write(`error: ${args.claimer}: ${err.message}\n`)
      process.exit(1)
    }

    const inputQuads = await readFromStdin(NQUADS)
    const result = await applyClaimer({ inputQuads, claimer })
    await writeQuads(emitClaimer(result))
  },
})
