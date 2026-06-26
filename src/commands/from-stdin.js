import { defineCommand } from 'citty'
import {
  readQuadStreamFromStdin,
  readStdin,
  resolveFormat,
  writeQuads,
} from '../io.js'

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
        'Input format for stdin (auto-detected by default). Accepted: turtle | ttl | trig | nquads | nq | ntriples | nt | jsonld | json | rdfxml | xml | n3',
    },
  },
  async run ({ args }) {
    const format = resolveFormat(args.format)
    // With an explicit format we transcode quad-by-quad; without one we must
    // buffer to sniff the format before parsing.
    const source = format
      ? readQuadStreamFromStdin(format)
      : await readStdin(format)
    await writeQuads(source)
  },
})
