import { defineCommand } from 'citty'
import rdf from 'rdf-ext'
import {
  NQUADS,
  readQuadStreamFromStdin,
  resolveFormat,
  writeQuads,
} from '../io.js'

export default defineCommand({
  meta: {
    name: 'graph-drop',
    description: 'Drop graph terms while staying in dataset space',
  },
  args: {
    format: {
      type: 'string',
      alias: 'f',
      description: 'Input format (default: n-quads)',
    },
  },
  async run ({ args }) {
    await writeQuads(
      readQuadStreamFromStdin(resolveFormat(args.format) || NQUADS),
      {
        map: (quad) =>
          rdf.quad(
            quad.subject,
            quad.predicate,
            quad.object,
            rdf.defaultGraph(),
          ),
      },
    )
  },
})
