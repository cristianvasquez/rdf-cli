import { readLines } from '../utils.js'

function csvEscape (value) {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function formatCSVRow (row, headers) {
  return `${headers.map((h) => csvEscape(String(row[h] ?? ''))).join(',')}\n`
}

function formatTSVRow (row, headers) {
  return `${headers.map((h) => String(row[h] ?? '').replace(/\t/g, ' ')).join('\t')}\n`
}

// The JSON Lines stream does not carry the SELECT projection, and select omits
// unbound variables. The header is therefore the union of the keys of all rows,
// so all rows are buffered. Each row lists its keys in projection order; the
// header is a topological order of those per-row sequences, ties broken by the
// order of first appearance.
function unionHeaders (rows) {
  const seen = new Map()        // key -> first-appearance index
  const after = new Map()       // key -> Set of keys that must come after it
  const indegree = new Map()
  for (const row of rows) {
    const keys = Object.keys(row)
    for (const k of keys) {
      if (!seen.has(k)) {
        seen.set(k, seen.size)
        after.set(k, new Set())
        indegree.set(k, 0)
      }
    }
    for (let i = 1; i < keys.length; i++) {
      const edges = after.get(keys[i - 1])
      if (!edges.has(keys[i])) {
        edges.add(keys[i])
        indegree.set(keys[i], indegree.get(keys[i]) + 1)
      }
    }
  }
  const byFirstSeen = (a, b) => seen.get(a) - seen.get(b)
  const ready = [...seen.keys()].filter((k) => indegree.get(k) === 0)
  const headers = []
  while (ready.length) {
    ready.sort(byFirstSeen)
    const k = ready.shift()
    headers.push(k)
    for (const next of after.get(k)) {
      indegree.set(next, indegree.get(next) - 1)
      if (indegree.get(next) === 0) ready.push(next)
    }
  }
  // Inconsistent orders (a cycle) cannot come from one projection; keep the rest
  // in first-appearance order instead of dropping them.
  for (const k of [...seen.keys()].sort(byFirstSeen)) if (!headers.includes(k)) headers.push(k)
  return headers
}

// csv | tsv. No jsonl: select already emits JSON Lines.
export async function writeTable (stream, { format = 'csv', out = process.stdout } = {}) {
  if (format !== 'csv' && format !== 'tsv') throw new Error(`unsupported table format: ${format}`)
  const rows = []
  for await (const line of readLines(stream)) rows.push(JSON.parse(line))
  if (rows.length === 0) return

  const headers = unionHeaders(rows)
  out.write(format === 'tsv' ? `${headers.join('\t')}\n` : `${headers.join(',')}\n`)
  for (const row of rows) {
    out.write(format === 'tsv' ? formatTSVRow(row, headers) : formatCSVRow(row, headers))
  }
}
