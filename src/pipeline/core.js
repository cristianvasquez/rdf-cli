// The envelope pipeline: every component collapses to one shape,
//   Operation = Envelope -> Promise<Envelope>
// where Envelope = { value, history }. `value` is the current payload (a tagged
// Value), `history` is the append-only, readable operations-results array. Composing
// operations threads the envelope; the final envelope is the deliverable.
//
// Provenance is library-only: nothing here is serialized across a Unix pipe.

// --- Value: the heterogeneous payload flowing between operations ---
export const Value = {
  empty: () => ({ type: 'empty' }),
  quads: (stream) => ({ type: 'quads', stream }),
  store: (store) => ({ type: 'store', store }),
  bindings: (rows) => ({ type: 'bindings', rows }),
  text: (text) => ({ type: 'text', text }),
}

export function expectValue (value, type, op) {
  if (!value || value.type !== type) {
    throw new TypeError(`${op}: expected a '${type}' value, got '${value?.type ?? 'none'}'`)
  }
  return value
}

export const emptyEnvelope = () => ({ value: Value.empty(), history: [] })

// --- Abort: a guard stops the pipeline by throwing this ---
export class Abort extends Error {
  constructor (opId, reason) {
    super(reason)
    this.name = 'Abort'
    this.opId = opId
    this.reason = reason
  }
}

// Lift a value-producing function into an Operation. `fn(env) -> { value, meta? }`
// runs over the incoming envelope; the lift measures timing, mints an id, records
// lineage (the previous result), and appends one OpResult to history.
export function operation (kind, fn) {
  return async (env = emptyEnvelope()) => {
    const startedAt = new Date().toISOString()
    const t0 = performance.now()
    const { value, meta = {} } = await fn(env)
    const durationMs = Math.round(performance.now() - t0)

    const opId = `op${env.history.length + 1}`
    const inputs = env.history.length ? [env.history.at(-1).opId] : []
    const result = { opId, kind, inputs, meta: { startedAt, durationMs, ...meta } }

    return { value, history: [...env.history, result] }
  }
}

// Left-to-right composition. One combinator composes every component.
export const pipe = (...ops) => (env = emptyEnvelope()) =>
  ops.reduce((p, op) => p.then(op), Promise.resolve(env))
