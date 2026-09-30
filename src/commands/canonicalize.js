import { defineCommand } from 'citty'
import { NQUADS } from '../formats.js'
import { readFromStdin } from '../sources/stdin.js'
import { writeQuads } from '../sinks/quads.js'
import { canonicalize } from '../transforms/canonicalize.js'
import { fail } from './shared.js'

export default defineCommand({
  io: { stdin: 'NQuads', stdout: 'NQuads' },
  meta: {
    name: 'canonicalize',
    description:
      'Emit the RDFC-1.0 canonical form. ' +
      'Blank-node labels are canonical and quads are sorted, so isomorphic inputs give equal outputs.',
  },
  async run () {
    let output
    try {
      output = await canonicalize(await readFromStdin(NQUADS))
    } catch (error) {
      fail(`canonicalize: ${error.message}`)
    }
    await writeQuads(output)
  },
})
