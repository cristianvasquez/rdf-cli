#!/usr/bin/env node
// Lint: the command io:{} annotations must match the Cmd algebra in spec/manifest.hs.
// The Haskell spec is the source of truth for command input/output stream kinds; the
// io:{} fields (which feed scripts/manifest.js) must stay in sync with it. This scans the
// regular `Name :: Cmd 'In 'Out` constructors — it does not parse arbitrary Haskell.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { commands } from '../src/commands/index.js'

const manifestPath = join(import.meta.dirname, '..', 'spec', 'manifest.hs')

const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()

// Parse the Cmd algebra into one entry per constructor: e.g. `Read :: Cmd 'RDF 'NQuads`
// or `Select :: Query -> Cmd 'NQuads 'JSONLinesBindings`. Pipeline lines (`Cmd i o`,
// unquoted) and comments are ignored.
function parseCmdAlgebra (source) {
  const entries = []
  for (const raw of source.split('\n')) {
    const line = raw.trim()
    if (line.startsWith('--')) continue
    const m = line.match(/^(\w+)\s*::.*\bCmd\s+'(\w+)\s+'(\w+)/)
    if (m) entries.push({ name: kebab(m[1]), stdin: m[2], stdout: m[3] })
  }
  return entries
}

const haskellEntries = parseCmdAlgebra(readFileSync(manifestPath, 'utf8'))
const haskell = Object.fromEntries(haskellEntries.map((e) => [e.name, { stdin: e.stdin, stdout: e.stdout }]))
const js = Object.fromEntries(Object.entries(commands).map(([name, cmd]) => [name, cmd.io ?? null]))

const warnings = []
if (haskellEntries.length !== Object.keys(js).length) {
  warnings.push(
    `command count differs: ${haskellEntries.length} in spec/manifest.hs, ` +
    `${Object.keys(js).length} in src/commands`,
  )
}

const names = [...new Set([...Object.keys(haskell), ...Object.keys(js)])].sort()
const problems = []

for (const name of names) {
  const h = haskell[name]
  const j = js[name]
  if (!h) { problems.push(`${name}: has io:{} but is absent from the Haskell Cmd algebra`); continue }
  if (!j) { problems.push(`${name}: in the Haskell Cmd algebra but has no command`); continue }
  if (!j.stdin || !j.stdout) { problems.push(`${name}: command is missing its io:{} annotation`); continue }
  const diffs = []
  if (h.stdin !== j.stdin) diffs.push(`stdin: haskell='${h.stdin}' io='${j.stdin}'`)
  if (h.stdout !== j.stdout) diffs.push(`stdout: haskell='${h.stdout}' io='${j.stdout}'`)
  if (diffs.length) problems.push(`${name}: ${diffs.join('; ')}`)
}

for (const w of warnings) console.error(`warn   ${w}`)

if (problems.length === 0) {
  for (const name of names) {
    console.log(`ok    ${name.padEnd(14)} ${haskell[name].stdin} -> ${haskell[name].stdout}`)
  }
  const suffix = warnings.length ? `, ${warnings.length} warning(s)` : ''
  console.log(`\nio:{} is in sync with spec/manifest.hs (${names.length} commands${suffix})`)
} else {
  for (const p of problems) console.error(`drift  ${p}`)
  console.error(`\n${problems.length} mismatch(es) between io:{} and the Cmd algebra in spec/manifest.hs`)
  process.exit(1)
}
