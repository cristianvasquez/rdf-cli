export function termToJSON (term) {
  if (term.termType === 'NamedNode') return { type: 'uri', value: term.value }
  if (term.termType === 'BlankNode') return { type: 'bnode', value: term.value }
  if (term.termType === 'Literal') {
    const result = { type: 'literal', value: term.value }
    if (term.language) result['xml:lang'] = term.language
    else if (term.datatype) result.datatype = term.datatype.value
    return result
  }
  throw new Error(`unsupported SPARQL result term: ${term.termType}`)
}

export function bindingToJSONL (row) {
  return `${JSON.stringify(Object.fromEntries(Object.entries(row).filter(([, value]) => value != null).
    map(([key, value]) => [key, termToJSON(value)])))}\n`
}

export async function writeBindings ({ vars, rows }, { out = process.stdout } = {}) {
  out.write(`${JSON.stringify({ head: { vars } })}\n`)
  for await (const row of rows) {
    out.write(bindingToJSONL(row))
  }
}
