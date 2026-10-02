#!/usr/bin/env node
// Generate the readme's command diagram and command table from the Cmd algebra in
// spec/manifest.hs and the command metadata in src/commands. The generated text sits
// between `<!-- generated:NAME -->` and `<!-- /generated:NAME -->` markers.
//
//   node scripts/docs.js           rewrite readme.md
//   node scripts/docs.js --check   exit 1 when readme.md is out of date (used by lint)
//   node scripts/docs.js --print diagram|table
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { commands } from '../src/commands/index.js'
import { parseCmdAlgebra } from './cmd-algebra.js'

const readmePath = join(import.meta.dirname, '..', 'readme.md')

const KINDS = {
  RDF: 'RDF bytes',
  NQuads: 'N-Quads',
  JSONLinesBindings: 'JSONL bindings',
  PathLines: 'path lines',
  IriLines: 'IRI lines',
  Nil: 'nothing',
  Text: 'text',
}
const NODE_IDS = { RDF: 'RDF', NQuads: 'NQ', JSONLinesBindings: 'B', PathLines: 'PL', Text: 'T', IriLines: 'IL', Nil: 'NIL' }
const PER_LINE = 3

const cmds = parseCmdAlgebra()

// Commands with the same (in, out) share one edge, in manifest order.
function diagram () {
  const edges = new Map()
  for (const { name, stdin, stdout } of cmds) {
    const key = `${stdin} ${stdout}`
    if (!edges.has(key)) edges.set(key, { stdin, stdout, names: [] })
    edges.get(key).names.push(name)
  }
  const declared = new Set()
  const node = (kind) => {
    const id = NODE_IDS[kind]
    if (declared.has(kind)) return id
    declared.add(kind)
    return `${id}([${KINDS[kind]}])`
  }
  const lines = ['```mermaid', 'flowchart TD']
  for (const { stdin, stdout, names } of edges.values()) {
    const rows = []
    for (let i = 0; i < names.length; i += PER_LINE) rows.push(names.slice(i, i + PER_LINE).join(' · '))
    const label = rows.length > 1 ? `"${rows.join('<br/>')}"` : rows[0]
    lines.push(`  ${node(stdin)} -- ${label} --> ${node(stdout)}`)
  }
  lines.push('```')
  return lines.join('\n')
}

const purpose = (description) => description.split(/(?<=\.)\s/)[0].replace(/\|/g, '\\|')

function table () {
  const lines = ['| command | in → out | purpose |', '| --- | --- | --- |']
  for (const { name, stdin, stdout } of cmds) {
    lines.push(`| \`${name}\` | ${KINDS[stdin]} → ${KINDS[stdout]} | ${purpose(commands[name].meta.description)} |`)
  }
  return lines.join('\n')
}

const SECTIONS = { diagram, table }

function render (readme) {
  let out = readme
  for (const [name, generate] of Object.entries(SECTIONS)) {
    const pattern = new RegExp(`(<!-- generated:${name} -->)[\\s\\S]*?(<!-- /generated:${name} -->)`)
    if (!pattern.test(out)) throw new Error(`readme.md: missing <!-- generated:${name} --> markers`)
    out = out.replace(pattern, (_, open, close) => `${open}\n${generate()}\n${close}`)
  }
  return out
}

const [flag, arg] = process.argv.slice(2)
if (flag === '--print') {
  if (!SECTIONS[arg]) throw new Error(`--print expects one of: ${Object.keys(SECTIONS).join(', ')}`)
  console.log(SECTIONS[arg]())
} else {
  const readme = readFileSync(readmePath, 'utf8')
  const rendered = render(readme)
  if (flag === '--check') {
    if (rendered !== readme) {
      console.error('readme.md is out of date with spec/manifest.hs or src/commands; run: node scripts/docs.js')
      process.exit(1)
    }
    console.log('readme.md generated sections are in sync')
  } else {
    writeFileSync(readmePath, rendered)
  }
}
