import { defineCommand } from 'citty'
import { NQUADS } from '../formats.js'
import { readFromStdin } from '../sources/stdin.js'
import { toReadable, writeQuads } from '../sinks/quads.js'
import { DEFAULT_SKOLEM_BASE_IRI, skolemize } from '../transforms/skolem.js'

export default defineCommand({
  io: { stdin: 'NQuads', stdout: 'NQuads' },
  meta: {
    name: 'skolem',
    description: 'Read an N-Quads dataset stream from stdin and replace blank nodes with generated IRIs.',
  },
  args: {
    'base-iri': {
      type: 'string',
      description: `Base IRI used for generated identifiers (default: ${DEFAULT_SKOLEM_BASE_IRI})`,
      default: DEFAULT_SKOLEM_BASE_IRI,
    },
  },
  async run ({ args }) {
    const source = await readFromStdin(NQUADS)
    await writeQuads(toReadable(source).pipe(skolemize(args['base-iri'])))
  },
})
