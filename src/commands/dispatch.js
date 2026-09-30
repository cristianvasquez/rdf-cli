import { defineCommand } from 'citty'
import { NQUADS } from '../formats.js'
import { readFromStdin } from '../sources/stdin.js'
import { loadPrefixes } from '../sinks/pretty.js'
import { writeQuads } from '../sinks/quads.js'
import { dispatch } from '../transforms/dispatch.js'
import { fail } from './shared.js'

export default defineCommand({
  io: { stdin: 'NQuads', stdout: 'NQuads' },
  meta: {
    name: 'dispatch',
    description:
      'Read an N-Quads dataset stream from stdin and write each named graph whose IRI starts with ROOT ' +
      'to a file: the path is the IRI relative to ROOT, the format comes from the extension, ' +
      'and graph terms are dropped in the file. Written quads leave the stream; all other quads pass on. ' +
      'A graph that cannot be written stays in the stream, the error goes to stderr, and the exit code is 1.',
  },
  args: {
    root: { type: 'positional', description: 'Root IRI, e.g. file://./out/', required: false },
    destination: { type: 'string', alias: 'd', description: 'Destination directory (default: .)', default: '.' },
    overwrite: { type: 'boolean', description: 'Replace existing files' },
    prefixes: { type: 'string', alias: 'p', description: 'Prefixes JSON file for Turtle/TriG output (auto-discovered: .prefixes.json)' },
  },
  async run ({ args }) {
    if (!args.root) fail('provide a root IRI')
    let failed = false
    const rest = await dispatch(await readFromStdin(NQUADS), args.root, {
      destination: args.destination,
      overwrite: Boolean(args.overwrite),
      prefixes: await loadPrefixes(args.prefixes),
      onWrite: (file) => process.stderr.write(`wrote ${file}\n`),
      onError: (graph, error) => {
        failed = true
        process.stderr.write(`error: dispatch: <${graph.value}>: ${error.message}\n`)
      },
    })
    await writeQuads(rest)
    if (failed) process.exitCode = 1
  },
})
