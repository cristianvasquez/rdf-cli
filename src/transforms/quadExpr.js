import { Store } from 'oxigraph'
import { Transform } from 'node:stream'
import rdf from 'rdf-ext'
import { termInstance } from './sparql.js'

// Per-quad SPARQL expressions (spec/manifest.hs: filterQuads, mapQuad,
// mapQuads). An expression sees ONE quad: ?s ?p ?o ?g, ?g unbound for the
// default graph. Quads are evaluated in batches: each batch is loaded into a
// fresh store and one query evaluates the expressions for every quad in it.
// No expression joins quads, so the batch size never changes a result.

const BATCH_SIZE = 512
const PATTERN = '{ ?s ?p ?o } UNION { GRAPH ?g { ?s ?p ?o } }'
const POSITIONS = ['subject', 'predicate', 'object', 'graph']
const VAR = { match: 'rdfcli_match', subject: 'rdfcli_s', predicate: 'rdfcli_p', object: 'rdfcli_o', graph: 'rdfcli_g' }

// The graph rewrite that sets the default graph (GraphRewrite ToDefault).
export const TO_DEFAULT = 'default'

// Check the query once, so a syntax error fails before any quad is read.
function compile (query) {
  try {
    new Store().query(query)
  } catch (error) {
    throw new Error(`invalid expression: ${error.message}`)
  }
  return query
}

function batchStore (quads) {
  const store = new Store()
  for (const quad of quads) store.add(quad)
  return store
}

function rowQuad (row) {
  return rdf.quad(
    termInstance(row.get('s')),
    termInstance(row.get('p')),
    termInstance(row.get('o')),
    row.get('g') ? termInstance(row.get('g')) : rdf.defaultGraph(),
  )
}

function batched (evaluate) {
  let batch = []
  const run = (stream) => {
    for (const quad of evaluate(batch)) stream.push(quad)
    batch = []
  }
  return new Transform({
    objectMode: true,
    transform (quad, _encoding, callback) {
      batch.push(quad)
      if (batch.length >= BATCH_SIZE) {
        try { run(this) } catch (error) { return callback(error) }
      }
      callback()
    },
    flush (callback) {
      try { run(this) } catch (error) { return callback(error) }
      callback()
    },
  })
}

// --- filter ---

// Keep the quads where the expression is true. An expression error counts as false.
export function filterQuads (expr) {
  const query = compile(`SELECT ?s ?p ?o ?g WHERE { ${PATTERN} FILTER(${expr}) }`)
  return batched(function * (quads) {
    for (const row of batchStore(quads).query(query)) yield rowQuad(row)
  })
}

// --- map ---

const VALID = {
  subject: ['NamedNode', 'BlankNode'],
  predicate: ['NamedNode'],
  object: ['NamedNode', 'BlankNode', 'Literal'],
  graph: ['NamedNode', 'BlankNode'],
}

function mapQuery (where, rewrite) {
  const positions = POSITIONS.filter((p) => rewrite[p] !== undefined && rewrite[p] !== TO_DEFAULT)
  if (!POSITIONS.some((p) => rewrite[p] !== undefined)) throw new Error('map: provide at least one rewrite (-s, -p, -o, -g)')
  const projections = positions.map((p) => `((${rewrite[p]}) AS ?${VAR[p]})`).join(' ')
  const match = `(COALESCE(IF((${where}), true, false), false) AS ?${VAR.match})`
  return {
    positions,
    query: compile(`SELECT ?s ?p ?o ?g ${match} ${projections} WHERE { ${PATTERN} }`),
  }
}

// One row → { quad } or { error }. The match expression errs as false; a
// rewrite that yields no value, or a term invalid for its position, is an error.
function mapRow (row, positions, rewrite) {
  const input = rowQuad(row)
  if (row.get(VAR.match)?.value !== 'true') return { quad: input }
  const terms = {
    subject: input.subject,
    predicate: input.predicate,
    object: input.object,
    graph: rewrite.graph === TO_DEFAULT ? rdf.defaultGraph() : input.graph,
  }
  for (const position of positions) {
    const value = row.get(VAR[position])
    if (!value) return { error: { quad: input, message: `${position} expression gave no value` } }
    if (!VALID[position].includes(value.termType)) {
      return { error: { quad: input, message: `${position} expression gave a ${value.termType}, not valid as ${position}` } }
    }
    terms[position] = termInstance(value)
  }
  return { quad: rdf.quad(terms.subject, terms.predicate, terms.object, terms.graph) }
}

// Rewrite one quad: Either MapError Quad as { quad } | { error: { quad, message } }.
export function mapQuad (where, rewrite, quad) {
  const { positions, query } = mapQuery(where, rewrite)
  const [row] = batchStore([quad]).query(query)
  return mapRow(row, positions, rewrite)
}

// Rewrite the matching quads of a stream. On error the INPUT quad passes
// unchanged and the error goes to onMapError. Without onMapError the first
// error fails the stream: a failure is never silent.
const failOnMapError = ({ message }) => { throw new Error(`map: ${message}`) }

export function mapQuads (where, rewrite, onMapError = failOnMapError) {
  const { positions, query } = mapQuery(where, rewrite)
  return batched(function * (quads) {
    for (const row of batchStore(quads).query(query)) {
      const result = mapRow(row, positions, rewrite)
      if (result.error) {
        onMapError(result.error)
        yield result.error.quad
      } else {
        yield result.quad
      }
    }
  })
}
