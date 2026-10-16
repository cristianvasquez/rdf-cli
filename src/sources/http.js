import formats from '@rdfjs/formats'
import { SparqlEndpointFetcher } from 'fetch-sparql-endpoint'
import { Readable } from 'node:stream'
import rdf from 'rdf-ext'
import { parseQuads } from './parse.js'
import { assignDefaultGraph, scopeBlankNodes } from './paths.js'

// Remote sources. HTTP is a transport, not a format: fetchIri parses with the
// same parsers as read; the endpoint sources use the SPARQL 1.1 Protocol.
// httpOpts = { headers: { name: value }, timeoutMs }

const ACCEPT = [...formats.parsers.keys()].join(', ')

const QUAD_TYPES = ['application/n-quads', 'application/trig']
const CONSTRUCT_ACCEPT = [
  ...QUAD_TYPES,
  ...[...formats.parsers.keys()].filter((type) => !QUAD_TYPES.includes(type)).map((type) => `${type};q=0.8`),
].join(', ')

const mediaType = (contentType) => contentType?.split(';')[0].trim().toLowerCase() || null

// Dereference one IRI. Throws on an HTTP error or a media type without a parser.
// The base IRI is the final URL after redirects; the graph (graphFrom 'iri') is
// the requested IRI.
export async function fetchIri (iri, { headers = {}, timeoutMs } = {}, graphFrom) {
  const response = await fetch(iri, {
    headers: { accept: ACCEPT, ...headers },
    signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined,
  })
  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`)
  const type = mediaType(response.headers.get('content-type'))
  if (!type || !formats.parsers.has(type)) {
    await response.body?.cancel()
    throw new Error(`no parser for media type ${type ?? '(none)'}`)
  }
  const quads = parseQuads(type, Readable.fromWeb(response.body), { baseIRI: response.url })
  if (graphFrom !== 'iri') return quads
  return mapQuads(quads, assignDefaultGraph(rdf.namedNode(iri)))
}

async function * mapQuads (quads, fn) {
  for await (const quad of quads) yield fn(quad)
}

// fetchIri per IRI, in input order. One blank-node scope per response.
// Per-IRI failures go to onError; the rest continue.
export async function * fetchIris (iris, { graphFrom, http, onError } = {}) {
  let index = 0
  for await (const iri of iris) {
    const scope = scopeBlankNodes(index++)
    try {
      for await (const quad of await fetchIri(iri, http, graphFrom)) yield scope(quad)
    } catch (error) {
      onError?.(iri, error)
    }
  }
}

function fetcher ({ headers = {}, timeoutMs } = {}) {
  return new SparqlEndpointFetcher({ defaultHeaders: new Headers(headers), timeout: timeoutMs })
}

// Throws before any request when the query form differs.
function checkForm (sparql, query, forms) {
  const form = sparql.getQueryType(query)
  if (!forms.includes(form)) throw new Error(`expected a ${forms.join(' or ')} query, got ${form}`)
}

// SELECT on a remote endpoint: projection plus a stream of rows { var: term }.
export async function endpointSelect (endpoint, query, http) {
  const sparql = fetcher(http)
  checkForm(sparql, query, ['SELECT'])
  const stream = await sparql.fetchBindings(endpoint, query)
  // head.vars can come after the results (JSON key order is free). Read and
  // buffer rows until the variables event, or the parser stalls on full buffers.
  // With no head, the parsers emit [] at the end, after all rows are buffered.
  const buffered = []
  const variables = await new Promise((resolve, reject) => {
    const onData = (row) => buffered.push(row)
    const onError = (error) => done(() => reject(error))
    const onVariables = (vars) => done(() => resolve(vars))
    function done (settle) {
      stream.pause()
      stream.off('data', onData).off('error', onError).off('variables', onVariables)
      settle()
    }
    stream.on('data', onData).once('error', onError).once('variables', onVariables)
  })
  const vars = variables.map((variable) => variable.value)
  // Until the caller reads rows, nothing else listens for 'error': record it
  // here, so it does not stop the process, and throw it from replay.
  const failure = {}
  stream.on('error', (error) => { failure.error ??= error })
  return { vars, rows: replay(vars, buffered, stream, failure) }
}

// Buffered rows first, then the rest. Every row may bind only head.vars.
async function * replay (vars, buffered, stream, failure) {
  try {
    for (const rows of [buffered, stream]) {
      if (failure.error) throw failure.error
      for await (const row of rows) {
        const extra = Object.keys(row).find((key) => !vars.includes(key))
        if (extra !== undefined) throw new Error(`endpoint response binds ?${extra}, which is not in head.vars`)
        yield row
      }
    }
  } finally {
    stream.destroy()
  }
}

// CONSTRUCT or DESCRIBE on a remote endpoint: graphless triples. Asks for
// quad formats first, then any other format with a parser; parses with
// parseQuads, as read does.
export async function * endpointConstruct (endpoint, query, http) {
  const sparql = fetcher(http)
  checkForm(sparql, query, ['CONSTRUCT'])
  const [contentType, , body] = await sparql.fetchRawStream(endpoint, query, CONSTRUCT_ACCEPT)
  const type = mediaType(contentType)
  if (!type || !formats.parsers.has(type)) throw new Error(`no parser for media type ${type ?? '(none)'}`)
  for await (const quad of parseQuads(type, body)) {
    if (quad.graph.termType !== 'DefaultGraph') throw new Error(`endpoint returned a quad in graph ${quad.graph.value}`)
    yield quad
  }
}
