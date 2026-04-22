import { defineCommand, runMain } from 'citty'
import toQuads from './commands/to-quads.js'
import toTriples from './commands/to-triples.js'
import select from './commands/select.js'
import construct from './commands/construct.js'
import serialize from './commands/serialize.js'
import pretty from './commands/pretty.js'
import diff from './commands/diff.js'

const main = defineCommand({
  meta: {
    name: 'rdf',
    version: '0.2.1',
    description: 'RDF stream processing CLI',
  },
  subCommands: {
    'to-quads': toQuads,
    'to-triples': toTriples,
    select,
    construct,
    serialize,
    pretty,
    diff,
  },
})

export function run() {
  runMain(main)
}
