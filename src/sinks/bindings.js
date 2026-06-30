function termValue (term) {
  if (!term) return ''
  if (term.termType === 'BlankNode') return `_:${term.value}`
  return term.value
}

export function bindingToJSONL (row) {
  return `${JSON.stringify(Object.fromEntries(Object.entries(row).
    map(([key, value]) => [key, termValue(value)])))}\n`
}

export async function writeBindings (rows, { out = process.stdout } = {}) {
  for (const row of rows) {
    out.write(bindingToJSONL(row))
  }
}
