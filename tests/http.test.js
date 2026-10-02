import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import test, { after, before } from 'node:test'
import { Store } from 'oxigraph'
import { endpointConstruct, endpointSelect, fetchIri, fetchIris } from '../src/sources/http.js'

const CLI = fileURLToPath(new URL('../bin/rdf.js', import.meta.url))

const DOC = `@prefix ex: <http://example.org/> .
<#me> ex:knows [ ex:name "Bob" ] .
`

const store = new Store()
store.load(`
<http://example.org/alice> <http://example.org/name> "Alice" .
<http://example.org/bob> <http://example.org/name> "Bob" .
`, { format: 'nt' })

let server
let base

async function sparql (request, response) {
  let query = new URL(request.url, base).searchParams.get('query')
  if (!query) {
    let body = ''
    for await (const chunk of request) body += chunk
    query = new URLSearchParams(body).get('query')
  }
  if (/^\s*SELECT/i.test(query)) {
    response.writeHead(200, { 'content-type': 'application/sparql-results+json' })
    response.end(store.query(query, { results_format: 'json' }))
  } else if (request.headers.accept?.startsWith('application/n-quads')) {
    response.writeHead(200, { 'content-type': 'application/n-quads' })
    response.end(store.query(query, { results_format: 'nq' }))
  } else {
    response.writeHead(200, { 'content-type': 'text/turtle' })
    response.end(store.query(query, { results_format: 'nt' }))
  }
}

before(async () => {
  server = createServer((request, response) => {
    const path = new URL(request.url, base).pathname
    if (path === '/doc') {
      response.writeHead(200, { 'content-type': 'text/turtle; charset=utf-8' })
      response.end(DOC)
    } else if (path === '/moved') {
      response.writeHead(302, { location: '/doc' })
      response.end()
    } else if (path === '/graphs') {
      response.writeHead(200, { 'content-type': 'application/n-quads' })
      response.end('<http://example.org/a> <http://example.org/p> "x" <http://example.org/g> .\n')
    } else if (path === '/plain') {
      response.writeHead(200, { 'content-type': 'text/plain' })
      response.end('hello')
    } else if (path === '/auth') {
      response.writeHead(request.headers.authorization === 'Bearer t' ? 200 : 401, { 'content-type': 'text/turtle' })
      response.end(DOC)
    } else if (path === '/sparql-quads') {
      response.writeHead(200, { 'content-type': 'application/n-quads' })
      response.end('<http://example.org/a> <http://example.org/p> "x" <http://example.org/g> .\n')
    } else if (path === '/sparql') {
      sparql(request, response)
    } else {
      response.writeHead(404)
      response.end()
    }
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${server.address().port}`
})

after(() => server.close())

async function collect (source) {
  const items = []
  for await (const item of source) items.push(item)
  return items
}

// --- fetchIri ---

test('fetchIri parses by Content-Type and resolves relative IRIs against the URL', async () => {
  const quads = await collect(await fetchIri(`${base}/doc`))
  assert.equal(quads.length, 2)
  assert.ok(quads.some((q) => q.subject.value === `${base}/doc#me`))
  assert.ok(quads.every((q) => q.graph.termType === 'DefaultGraph'))
})

test('fetchIri follows redirects: base is the final URL, graph is the requested IRI', async () => {
  const quads = await collect(await fetchIri(`${base}/moved`, {}, 'iri'))
  assert.ok(quads.some((q) => q.subject.value === `${base}/doc#me`))
  assert.ok(quads.every((q) => q.graph.value === `${base}/moved`))
})

test('fetchIri keeps named graphs of the response with graphFrom iri', async () => {
  const quads = await collect(await fetchIri(`${base}/graphs`, {}, 'iri'))
  assert.equal(quads[0].graph.value, 'http://example.org/g')
})

test('fetchIri throws on an HTTP error', async () => {
  await assert.rejects(fetchIri(`${base}/missing`), /HTTP 404/)
})

test('fetchIri throws on a media type without a parser', async () => {
  await assert.rejects(fetchIri(`${base}/plain`), /no parser for media type text\/plain/)
})

test('fetchIri sends the given headers', async () => {
  await assert.rejects(fetchIri(`${base}/auth`), /HTTP 401/)
  const quads = await collect(await fetchIri(`${base}/auth`, { headers: { authorization: 'Bearer t' } }))
  assert.equal(quads.length, 2)
})

// --- fetchIris ---

test('fetchIris gives each response its own blank-node scope', async () => {
  const quads = await collect(fetchIris([`${base}/doc`, `${base}/doc`]))
  const blanks = new Set(quads.filter((q) => q.object.termType === 'BlankNode').map((q) => q.object.value))
  assert.equal(blanks.size, 2)
})

test('fetchIris reports a failed IRI and continues', async () => {
  const errors = []
  const quads = await collect(fetchIris([`${base}/missing`, `${base}/doc`], {
    onError: (iri, error) => errors.push([iri, error.message]),
  }))
  assert.equal(quads.length, 2)
  assert.deepEqual(errors, [[`${base}/missing`, 'HTTP 404 Not Found']])
})

// --- endpointSelect / endpointConstruct ---

test('endpointSelect streams rows of terms', async () => {
  const rows = await collect(await endpointSelect(`${base}/sparql`,
    'SELECT ?name WHERE { ?s <http://example.org/name> ?name } ORDER BY ?name'))
  assert.deepEqual(rows.map((r) => r.name.value), ['Alice', 'Bob'])
  assert.equal(rows[0].name.termType, 'Literal')
})

test('endpointSelect rejects a non-SELECT query before any request', async () => {
  await assert.rejects(endpointSelect('http://127.0.0.1:1/never', 'ASK { ?s ?p ?o }'), /expected a SELECT query, got ASK/)
})

test('endpointConstruct yields graphless triples', async () => {
  const quads = await collect(endpointConstruct(`${base}/sparql`,
    'CONSTRUCT { ?s <http://example.org/label> ?n } WHERE { ?s <http://example.org/name> ?n }'))
  assert.equal(quads.length, 2)
  assert.ok(quads.every((q) => q.graph.termType === 'DefaultGraph'))
})

test('endpointConstruct asks for N-Quads first', async () => {
  let accept
  const probe = createServer((request, response) => {
    accept = request.headers.accept
    response.writeHead(200, { 'content-type': 'application/n-quads' })
    response.end('<http://example.org/a> <http://example.org/p> "x" .\n')
  })
  await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve))
  const quads = await collect(endpointConstruct(`http://127.0.0.1:${probe.address().port}/`, 'CONSTRUCT WHERE { ?s ?p ?o }'))
  probe.close()
  assert.equal(quads.length, 1)
  assert.match(accept, /^application\/n-quads, application\/trig, /)
})

test('endpointConstruct rejects a quad in a named graph', async () => {
  await assert.rejects(collect(endpointConstruct(`${base}/sparql-quads`, 'CONSTRUCT WHERE { ?s ?p ?o }')),
    /endpoint returned a quad in graph http:\/\/example.org\/g/)
})

test('endpointConstruct accepts DESCRIBE', async () => {
  const quads = await collect(endpointConstruct(`${base}/sparql`, 'DESCRIBE <http://example.org/alice>'))
  assert.equal(quads.length, 1)
})

test('endpointConstruct rejects a SELECT query', async () => {
  await assert.rejects(collect(endpointConstruct(`${base}/sparql`, 'SELECT * { ?s ?p ?o }')),
    /expected a CONSTRUCT query, got SELECT/)
})

// --- CLI ---

const run = (args, input) => new Promise((resolve) => {
  const child = execFile('node', [CLI, ...args], (error, stdout, stderr) =>
    resolve({ code: error ? error.code : 0, stdout, stderr }))
  child.stdin.end(input ?? '')
})

test('rdf fetch reads IRIs from stdin and exits 1 when one fails', async () => {
  const { code, stdout, stderr } = await run(['fetch', '--graph-from', 'iri'], `${base}/doc\n${base}/missing\n`)
  assert.equal(code, 1)
  assert.equal(stdout.trim().split('\n').length, 2)
  assert.ok(stdout.includes(`<${base}/doc>`))
  assert.match(stderr, /missing: HTTP 404/)
})

test('rdf fetch sends --header', async () => {
  const { code } = await run(['fetch', '-H', 'Authorization: Bearer t'], `${base}/auth\n`)
  assert.equal(code, 0)
})

test('rdf endpoint-select emits JSON Lines', async () => {
  const { code, stdout } = await run(['endpoint-select', `${base}/sparql`,
    'SELECT ?name WHERE { ?s <http://example.org/name> ?name } ORDER BY ?name'])
  assert.equal(code, 0)
  assert.deepEqual(stdout.trim().split('\n').map((l) => JSON.parse(l)), [{ name: 'Alice' }, { name: 'Bob' }])
})

test('rdf endpoint-construct emits N-Quads; a wrong query form exits 1', async () => {
  const ok = await run(['endpoint-construct', `${base}/sparql`, 'CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }'])
  assert.equal(ok.code, 0)
  assert.equal(ok.stdout.trim().split('\n').length, 2)
  const bad = await run(['endpoint-construct', `${base}/sparql`, 'SELECT * { ?s ?p ?o }'])
  assert.equal(bad.code, 1)
  assert.match(bad.stderr, /expected a CONSTRUCT query/)
})
