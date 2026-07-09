import { Readable } from 'node:stream'
import {
  materialize as toStore,
  select as sparqlSelect,
  construct as sparqlConstruct,
  validate as shaclValidate,
  assignGraph as assignGraphTransform,
  dropGraph as dropGraphTransform,
  skolemize,
} from '../transforms/index.js'
import { getMaterializeStats } from '../transforms/sparql.js'
import { readFromGlob, readFromStdin } from '../sources/index.js'
import { toReadable } from '../sinks/index.js'
import { Value, expectValue, operation, Abort } from './core.js'

const asReadable = (value, op) => toReadable(expectValue(value, 'quads', op).stream)
const asStore = (value, op) => expectValue(value, 'store', op).store

// --- Sources ---
export const readPaths = (patterns, opts = {}) =>
  operation('read', () => ({
    value: Value.quads(Readable.from(readFromGlob(patterns, opts), { objectMode: true })),
  }))

export const readStdin = operation('read', async () => ({
  value: Value.quads(await readFromStdin()),
}))

// --- Materialization + SPARQL ---
export const materialize = operation('materialize', async (env) => {
  const store = await toStore(asReadable(env.value, 'materialize'))
  return { value: Value.store(store), meta: getMaterializeStats(store) }
})

export const select = (query) =>
  operation('select', (env) => ({
    value: Value.bindings(sparqlSelect(asStore(env.value, 'select'), query)),
  }))

export const construct = (query) =>
  operation('construct', (env) => ({
    value: Value.quads(sparqlConstruct(asStore(env.value, 'construct'), query)),
  }))

// --- SHACL: the verdict travels as provenance (meta.validation) ---
export const validate = (shapeSources, opts = {}) =>
  operation('validate', async (env) => {
    const { stream, summary, stats = {} } = await shaclValidate(asStore(env.value, 'validate'), shapeSources, opts)
    return { value: Value.quads(stream), meta: { ...stats, validation: summary } }
  })

// --- Streaming graph/skolem transforms ---
export const assignGraph = (iri) =>
  operation('graph-assign', (env) => ({
    value: Value.quads(asReadable(env.value, 'graph-assign').pipe(assignGraphTransform(iri))),
  }))

export const dropGraph = operation('graph-drop', (env) => ({
  value: Value.quads(asReadable(env.value, 'graph-drop').pipe(dropGraphTransform())),
}))

export const skolem = (baseIri) =>
  operation('skolem', (env) => ({
    value: Value.quads(asReadable(env.value, 'skolem').pipe(skolemize(baseIri))),
  }))

// --- Guard: read prior provenance, abort on non-conformance ---
export const requireConformance = operation('require-conformance', (env) => {
  const last = [...env.history].reverse().find((r) => r.kind === 'validate')
  const v = last?.meta.validation
  if (v && v.conforms === false) {
    throw new Abort('require-conformance', `validation did not conform: ${v.violationCount} violations`)
  }
  return { value: env.value, meta: { passed: true } }
})
