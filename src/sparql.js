import { Store } from 'oxigraph'
import { Readable } from 'node:stream'
import rdf from 'rdf-ext'

function termInstance (term) {
  if (term.termType === 'Literal')
    return rdf.literal(term.value, term.language || term.datatype)
  if (term.termType === 'NamedNode') return rdf.namedNode(term.value)
  if (term.termType === 'BlankNode') return rdf.blankNode(term.value)
  if (term.termType === 'DefaultGraph') return rdf.defaultGraph()
  return term
}

export async function collectToStore (source) {
  const store = new Store()
  let dropped = 0
  for await (const quad of source) {
    try {
      store.add(quad)
    } catch {
      dropped++
    }
  }
  if (dropped > 0) process.stderr.write(`warning: dropped ${dropped} quads\n`)
  return store
}

function * constructQuads (store, query) {
  for (const triple of store.query(query)) {
    yield rdf.quad(
      termInstance(triple.subject),
      termInstance(triple.predicate),
      termInstance(triple.object),
      rdf.defaultGraph(),
    )
  }
}

function * selectBindings (store, query) {
  for (const binding of store.query(query)) {
    const row = Object.fromEntries(binding)
    for (const [key, value] of Object.entries(row)) row[key] = termInstance(value)
    yield row
  }
}

export async function createConstructStream (source, query) {
  const store = await collectToStore(source)
  return Readable.from(constructQuads(store, query), { objectMode: true })
}

export async function createSelectStream (source, query) {
  const store = await collectToStore(source)
  return selectBindings(store, query)
}
