import construct from './construct.js'
import fromPaths from './from-paths.js'
import graphAssign from './graph-assign.js'
import graphDrop from './graph-drop.js'
import pretty from './pretty.js'
import read from './read.js'
import select from './select.js'
import skolem from './skolem.js'
import table from './table.js'
import validate from './validate.js'

export const commands = {
  read,
  'from-paths': fromPaths,
  select,
  skolem,
  table,
  construct,
  validate,
  'graph-assign': graphAssign,
  'graph-drop': graphDrop,
  pretty,
}
