#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import rdf from 'rdf-ext'
import { writeQuads } from '../src/sinks/quads.js'
import { command } from '../src/cli.js'
import { NQUADS, NTRIPLES, TRIG, TURTLE } from '../src/formats.js'

const pkg = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf8'))
const packageName = pkg.name ?? 'unknown'

const cli = rdf.namespace('urn:rdf-cli:cli#')
const mt = rdf.namespace('urn:rdf-cli:media-type#')
const npm = rdf.namespace('https://www.npmjs.com/package/')
const inst = rdf.namespace(`https://www.npmjs.com/package/${packageName}#`)
const xsd = rdf.namespace('http://www.w3.org/2001/XMLSchema#')
const rdfs = rdf.namespace('http://www.w3.org/2000/01/rdf-schema#')
const rdfType = rdf.namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#').type

const lit = (v) => rdf.literal(String(v))
const boolLit = (v) => rdf.literal(String(v), xsd.boolean)

const iri = (path) => inst[path.join('/')]
const mediaTypeIri = (value) => mt[encodeURIComponent(value)]

const MEDIA_TYPES = {
  rdf: [
    'application/ld+json',
    'application/rdf+xml',
    NQUADS,
    NTRIPLES,
    TRIG,
    TURTLE,
    'text/n3',
  ],
  nquads: [NQUADS],
  text: ['text/plain'],
  pathLines: ['text/plain'],
  jsonLinesBindings: ['application/x-ndjson'],
}

async function* mediaTypeQuads () {
  for (const value of new Set(Object.values(MEDIA_TYPES).flat())) {
    const iri = mediaTypeIri(value)
    yield rdf.quad(iri, rdfType, cli.MediaType)
    yield rdf.quad(iri, rdfs.label, lit(value))
  }
}

async function* streamTypeQuads () {
  yield rdf.quad(cli.RDF, rdfType, cli.StreamType)
  yield rdf.quad(cli.RDF, rdfs.label, lit('RDF'))
  yield rdf.quad(
    cli.RDF,
    rdfs.comment,
    lit('Serialized RDF on a byte stream. Individual commands support subsets of the listed media types.'),
  )
  for (const value of MEDIA_TYPES.rdf) {
    yield rdf.quad(cli.RDF, cli.supportsMediaType, mediaTypeIri(value))
  }

  yield rdf.quad(cli.NQuads, rdfType, cli.StreamType)
  yield rdf.quad(cli.NQuads, rdfs.label, lit('NQuads'))
  yield rdf.quad(cli.NQuads, rdfs.comment, lit('Normalized internal RDF dataset stream encoded as N-Quads.'))
  yield rdf.quad(cli.NQuads, cli.supportsMediaType, mediaTypeIri(MEDIA_TYPES.nquads[0]))

  yield rdf.quad(cli.Text, rdfType, cli.StreamType)
  yield rdf.quad(cli.Text, rdfs.label, lit('Text'))
  yield rdf.quad(cli.Text, rdfs.comment, lit('Plain text stream.'))
  yield rdf.quad(cli.Text, cli.supportsMediaType, mediaTypeIri(MEDIA_TYPES.text[0]))

  yield rdf.quad(cli.PathLines, rdfType, cli.StreamType)
  yield rdf.quad(cli.PathLines, rdfs.label, lit('PathLines'))
  yield rdf.quad(cli.PathLines, rdfs.comment, lit('One file path per line.'))
  yield rdf.quad(cli.PathLines, cli.supportsMediaType, mediaTypeIri(MEDIA_TYPES.pathLines[0]))

  yield rdf.quad(cli.JSONLinesBindings, rdfType, cli.StreamType)
  yield rdf.quad(cli.JSONLinesBindings, rdfs.label, lit('JSONLinesBindings'))
  yield rdf.quad(
    cli.JSONLinesBindings,
    rdfs.comment,
    lit('SPARQL SELECT bindings encoded as one JSON object per line.'),
  )
  yield rdf.quad(
    cli.JSONLinesBindings,
    cli.supportsMediaType,
    mediaTypeIri(MEDIA_TYPES.jsonLinesBindings[0]),
  )
}

async function* packageQuads () {
  const pkgIri = npm(packageName)
  yield rdf.quad(pkgIri, rdfType, cli.Package)
  yield rdf.quad(pkgIri, rdfs.label, lit(packageName))
  if (pkg.version) yield rdf.quad(pkgIri, cli.version, lit(pkg.version))
  if (pkg.description) yield rdf.quad(pkgIri, rdfs.comment, lit(pkg.description))
}

async function* commandQuads (cmd, path) {
  const resolved = typeof cmd === 'function' ? await cmd() : cmd
  const meta = resolved.meta ?? {}
  const io = resolved.io ?? {}
  const cmdIri = iri(path)

  yield rdf.quad(cmdIri, rdfType, cli.Command)
  yield rdf.quad(cmdIri, rdfs.label, lit(path.at(-1) ?? meta.name ?? 'unknown'))
  if (meta.description) yield rdf.quad(cmdIri, rdfs.comment, lit(meta.description))
  if (meta.hidden) yield rdf.quad(cmdIri, cli.hidden, boolLit(true))
  if (io.stdin) yield rdf.quad(cmdIri, cli.stdin, cli[io.stdin])
  if (io.stdout) yield rdf.quad(cmdIri, cli.stdout, cli[io.stdout])

  for (const [argName, argDef] of Object.entries(resolved.args ?? {})) {
    const aIri = iri([...path, argName])
    const isPositional = argDef.type === 'positional'

    yield rdf.quad(cmdIri, cli.hasArg, aIri)
    yield rdf.quad(aIri, rdfType, isPositional ? cli.Positional : cli.Option)
    yield rdf.quad(aIri, rdfs.label, lit(argName))
    if (argDef.description) yield rdf.quad(aIri, rdfs.comment, lit(argDef.description))
    if (!isPositional && argDef.type) yield rdf.quad(aIri, cli.valueType, lit(argDef.type))
    if (argDef.required) yield rdf.quad(aIri, cli.required, boolLit(true))
    if (argDef.default != null) yield rdf.quad(aIri, cli.default, lit(argDef.default))
    const aliases = Array.isArray(argDef.alias) ? argDef.alias : argDef.alias ? [argDef.alias] : []
    for (const alias of aliases) yield rdf.quad(aIri, cli.alias, lit(alias))
  }

  const subCommandsRaw = resolved.subCommands
  const subCommands = typeof subCommandsRaw === 'function'
    ? await subCommandsRaw()
    : (subCommandsRaw ?? {})

  for (const [key, sub] of Object.entries(subCommands)) {
    const subPath = [...path, key]
    yield rdf.quad(cmdIri, cli.subCommand, iri(subPath))
    yield* commandQuads(sub, subPath)
  }
}

async function* manifest () {
  yield* packageQuads()
  yield* mediaTypeQuads()
  yield* streamTypeQuads()
  const rootName = command.meta?.name ?? packageName
  const pkgIri = npm(packageName)
  const rootIri = iri([rootName])
  yield rdf.quad(pkgIri, cli.hasCommand, rootIri)
  yield* commandQuads(command, [rootName])
}

await writeQuads(manifest())
