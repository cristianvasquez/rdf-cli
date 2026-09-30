import { defineCommand } from 'citty'
import { NQUADS } from '../formats.js'
import { readFromStdin } from '../sources/stdin.js'
import { ask, materialize } from '../transforms/sparql.js'
import { fail, queryArgs, readQuery } from './shared.js'

export default defineCommand({
  io: { stdin: 'NQuads', stdout: 'Text' },
  meta: {
    name: 'ask',
    description:
      'Read an N-Quads dataset stream from stdin, run SPARQL ASK, and print true or false. ' +
      'Exit code 1 on false.',
  },
  args: queryArgs('ASK'),
  async run ({ args }) {
    const query = await readQuery(args)
    const store = await materialize(await readFromStdin(NQUADS))
    let result
    try {
      result = ask(store, query)
    } catch (error) {
      fail(`ask: ${error.message}`)
    }
    process.stdout.write(`${result}\n`)
    if (!result) process.exitCode = 1
  },
})
