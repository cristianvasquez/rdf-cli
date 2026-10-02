import ask from './ask.js'
import canonicalize from './canonicalize.js'
import claim from './claim.js'
import construct from './construct.js'
import dispatch from './dispatch.js'
import endpointConstruct from './endpoint-construct.js'
import endpointSelect from './endpoint-select.js'
import fetch from './fetch.js'
import filter from './filter.js'
import fromPaths from './from-paths.js'
import map from './map.js'
import pretty from './pretty.js'
import read from './read.js'
import select from './select.js'
import skolem from './skolem.js'
import table from './table.js'
import validate from './validate.js'

export const commands = {
  read,
  'from-paths': fromPaths,
  fetch,
  'endpoint-select': endpointSelect,
  'endpoint-construct': endpointConstruct,
  filter,
  map,
  select,
  construct,
  ask,
  claim,
  validate,
  skolem,
  canonicalize,
  dispatch,
  pretty,
  table,
}
