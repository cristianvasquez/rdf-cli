import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import {
  Abort,
  emptyEnvelope,
  materialize,
  pipe,
  readPaths,
  requireConformance,
  select,
  validate,
} from '../src/pipeline/index.js'

const fixtures = fileURLToPath(new URL('./fixtures', import.meta.url))
const shapes = `${fixtures}/person-shape.ttl`

async function collect (iterable) {
  const out = []
  for await (const item of iterable) out.push(item)
  return out
}

test('emptyEnvelope starts with a tagged empty value', () => {
  assert.deepEqual(emptyEnvelope(), { value: { type: 'empty' }, history: [] })
})

test('pipe threads value through materialization boundaries and records history', async () => {
  const env = await pipe(
    readPaths([`${fixtures}/person-valid.ttl`]),
    materialize,
    select('SELECT ?s WHERE { ?s ?p ?o }'),
  )()

  // value ends as bindings; the payload type changed read → store → bindings.
  assert.equal(env.value.type, 'bindings')
  const rows = await collect(env.value.rows)
  assert.ok(rows.length > 0)

  // history has one result per op, in order, with linear lineage.
  assert.deepEqual(env.history.map((r) => r.kind), ['read', 'materialize', 'select'])
  assert.deepEqual(env.history.map((r) => r.opId), ['op1', 'op2', 'op3'])
  assert.deepEqual(env.history[0].inputs, [])
  assert.deepEqual(env.history[1].inputs, ['op1'])
  assert.deepEqual(env.history[2].inputs, ['op2'])

  // materialize recorded data-dependent facts; every op carries timing.
  assert.ok(env.history[1].meta.quadsIn > 0)
  assert.ok(env.history[1].meta.quadsOut > 0)
  assert.equal(env.history[1].meta.droppedIn, 0)
  assert.ok(env.history.every((r) => typeof r.meta.durationMs === 'number'))
})

test('validate records its verdict in history as provenance', async () => {
  const env = await pipe(
    readPaths([`${fixtures}/person-valid.ttl`]),
    materialize,
    validate([shapes]),
  )()

  const v = env.history.at(-1)
  assert.equal(v.kind, 'validate')
  assert.equal(v.meta.validation.conforms, true)
  assert.ok(Array.isArray(v.meta.validation.violations))
  assert.ok(v.meta.quadsIn > 0)
  assert.ok(v.meta.quadsOut > v.meta.quadsIn)
})

test('requireConformance passes when the upstream validation conformed', async () => {
  const env = await pipe(
    readPaths([`${fixtures}/person-valid.ttl`]),
    materialize,
    validate([shapes]),
    requireConformance,
  )()

  assert.equal(env.history.at(-1).kind, 'require-conformance')
  assert.equal(env.history.at(-1).meta.passed, true)
})

test('requireConformance aborts when the upstream validation did not conform', async () => {
  await assert.rejects(
    pipe(
      readPaths([`${fixtures}/person-invalid.ttl`]),
      materialize,
      validate([shapes]),
      requireConformance,
      select('SELECT ?s WHERE { ?s ?p ?o }'), // must never run
    )(),
    (err) => {
      assert.ok(err instanceof Abort)
      assert.equal(err.opId, 'require-conformance')
      assert.match(err.reason, /did not conform/)
      return true
    },
  )
})

test('an operation rejects when handed the wrong value type', async () => {
  // select expects a store, but read produced quads (no materialize between).
  await assert.rejects(
    pipe(readPaths([`${fixtures}/person-valid.ttl`]), select('SELECT ?s WHERE { ?s ?p ?o }'))(),
    /select: expected a 'store' value/,
  )
})
