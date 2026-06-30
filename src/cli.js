import { defineCommand, runMain } from 'citty'
import { commands } from './commands/index.js'

const main = defineCommand({
  meta: {
    name: 'rdf',
    version: '0.2.2',
    description:
      'RDF CLI with `read` as the default source, N-Quads between transforms, and sink-selected output formats.',
  },
  subCommands: commands,
})

export const command = main

export function run () {
  runMain(main)
}
