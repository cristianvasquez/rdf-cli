// Parse the Cmd algebra in spec/manifest.hs: one entry per `Name :: ... Cmd 'In 'Out`
// constructor, in manifest order. Pipeline lines (`Cmd i o`, unquoted) and comments
// are ignored. This scans the regular constructor lines; it does not parse Haskell.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export const manifestPath = join(import.meta.dirname, '..', 'spec', 'manifest.hs')

const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()

export function parseCmdAlgebra (source = readFileSync(manifestPath, 'utf8')) {
  const entries = []
  for (const raw of source.split('\n')) {
    const line = raw.trim()
    if (line.startsWith('--')) continue
    const m = line.match(/^(\w+)\s*::.*\bCmd\s+'(\w+)\s+'(\w+)/)
    if (m) entries.push({ name: kebab(m[1]), stdin: m[2], stdout: m[3] })
  }
  return entries
}
