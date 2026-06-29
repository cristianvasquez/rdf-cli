import { defineCommand } from 'citty'
import { resolveFormat } from '../formats.js'
import { readFromStdin } from '../parse.js'
import { writeQuads } from '../sinks/quads.js'

export default defineCommand({
  meta: {
    name: 'from-stdin',
    description: 'Parse RDF from stdin bytes → N-Quads stream on stdout',
  },
  args: {
    format: {
      type: 'string',
      alias: 'f',
      description:
        'Input format (auto-detected by default). Accepted: turtle | ttl | trig | nquads | nq | ntriples | nt | jsonld | json | rdfxml | xml | n3',
    },
  },
  async run ({ args }) {
    const source = await readFromStdin(resolveFormat(args.format))
    await writeQuads(source)
  },
})
