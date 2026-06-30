import { defineCommand, runMain } from 'citty'
import construct from './commands/construct.js'
import fromPaths from './commands/from-paths.js'
import graphAssign from './commands/graph-assign.js'
import graphDrop from './commands/graph-drop.js'
import pretty from './commands/pretty.js'
import read from './commands/read.js'
import select from './commands/select.js'
import table from './commands/table.js'
import validate from './commands/validate.js'

const main = defineCommand({
  meta: {
    name: 'rdf',
    version: '0.2.2',
    description:
      'RDF CLI with `read` as the default source, N-Quads between transforms, and sink-selected output formats.',
  },
  subCommands: {
    read,
    'from-paths': fromPaths,
    select,
    table,
    construct,
    validate,
    'graph-assign': graphAssign,
    'graph-drop': graphDrop,
    pretty,
  },
})

export const command = main

export function run () {
  runMain(main)
}
