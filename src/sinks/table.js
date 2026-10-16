import rdf from 'rdf-ext'
import { readLines } from '../utils.js'
import { bindingToJSONL } from './bindings.js'

function csvEscape (value) {
  return /[,"\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

function decodeTerm (term) {
  if (term.type === 'uri') return rdf.namedNode(term.value)
  if (term.type === 'bnode') return rdf.blankNode(term.value)
  if (term.type === 'literal') return rdf.literal(term.value, term['xml:lang'] || (term.datatype && rdf.namedNode(term.datatype)))
  throw new Error(`unsupported SPARQL result term type: ${term.type}`)
}

// Decode the wire at the command boundary; the sink consumes Results.
export async function readResults (stream) {
  const lines = readLines(stream)[Symbol.asyncIterator]()
  const first = await lines.next()
  const head = first.done ? null : JSON.parse(first.value).head
  if (!Array.isArray(head?.vars) || !head.vars.every((v) => typeof v === 'string')) {
    throw new Error('expected a head record with vars on the first line')
  }
  async function * rows () {
    for await (const line of { [Symbol.asyncIterator]: () => lines }) {
      yield Object.fromEntries(Object.entries(JSON.parse(line)).map(([key, term]) => [key, decodeTerm(term)]))
    }
  }
  return { vars: head.vars, rows: rows() }
}

function iri (value) {
  return `<${value.replace(/[<>"{}|^`\\\u0000-\u0020]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)}>`
}

function tsvTerm (term) {
  if (term.termType === 'NamedNode') return iri(term.value)
  if (term.termType === 'BlankNode') return `_:${term.value}`
  const lexical = JSON.stringify(term.value)
  if (term.language) return `${lexical}@${term.language}`
  if (term.datatype.value !== 'http://www.w3.org/2001/XMLSchema#string') return `${lexical}^^${iri(term.datatype.value)}`
  return lexical
}

export async function writeTable ({ vars, rows }, { format = 'csv', out = process.stdout } = {}) {
  if (!['csv', 'tsv', 'json'].includes(format)) throw new Error(`unsupported table format: ${format}`)
  if (format === 'json') {
    out.write(`${JSON.stringify({ head: { vars } }).slice(0, -1)},"results":{"bindings":[`)
    let separator = ''
    for await (const row of rows) {
      out.write(separator + bindingToJSONL(row).trimEnd())
      separator = ','
    }
    out.write(']}}\n')
    return
  }
  const delimiter = format === 'csv' ? ',' : '\t'
  out.write(`${vars.map((v) => format === 'csv' ? csvEscape(v) : `?${v}`).join(delimiter)}\n`)
  for await (const row of rows) {
    const cells = vars.map((v) => {
      const term = Object.hasOwn(row, v) ? row[v] : null
      if (!term) return ''
      if (format === 'tsv') return tsvTerm(term)
      return csvEscape(term.termType === 'BlankNode' ? `_:${term.value}` : term.value)
    })
    out.write(`${cells.join(delimiter)}\n`)
  }
}
