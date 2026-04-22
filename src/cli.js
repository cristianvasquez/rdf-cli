import { defineCommand, runMain } from 'citty'
import glob from './commands/glob.js'
import fromPaths from './commands/from-paths.js'
import fromStdin from './commands/from-stdin.js'
import select from './commands/select.js'
import table from './commands/table.js'
import construct from './commands/construct.js'
import validate from './commands/validate.js'
import serialize from './commands/serialize.js'
import pretty from './commands/pretty.js'
import graphAssign from './commands/graph-assign.js'
import graphDrop from './commands/graph-drop.js'

const main = defineCommand({
  meta: {
    name: 'rdf',
    version: '0.2.2',
    description: 'RDF stream algebra CLI',
  },
  subCommands: {
    glob,
    'from-paths': fromPaths,
    'from-stdin': fromStdin,
    select,
    table,
    construct,
    validate,
    'graph-assign': graphAssign,
    'graph-drop': graphDrop,
    serialize,
    pretty,
  },
})

export function run() {
  runMain(main)
}
