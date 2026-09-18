import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineCommand, runMain } from 'citty'
import { commands } from './commands/index.js'

const pkg = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf8'))

const main = defineCommand({
  meta: {
    name: 'rdf',
    version: pkg.version,
    description:
      'RDF CLI with `read` as the default source, N-Quads between transforms, and sink-selected output formats.',
  },
  subCommands: commands,
})

export const command = main

export function run () {
  runMain(main)
}
