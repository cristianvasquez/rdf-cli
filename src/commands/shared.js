import formats from '@rdfjs/formats'
import { readFile } from 'node:fs/promises'
import { resolveFormat } from '../formats.js'

// Argument definitions and checks shared by several commands.

export const graphFromArg = {
  type: 'string',
  description: 'Assign graph identity to graphless input: path',
}

export const formatArg = {
  type: 'string',
  alias: 'f',
  description: 'Force the input format (trig, turtle, nquads, ntriples, jsonld, rdfxml, n3). Default: file extension, or content detection on stdin.',
}

export const queryArgs = (form) => ({
  query: {
    type: 'positional',
    description: `SPARQL ${form} query string`,
    required: false,
  },
  'query-file': {
    type: 'string',
    description: 'Read SPARQL query from file instead',
  },
})

export function fail (message) {
  process.stderr.write(`error: ${message}\n`)
  process.exit(1)
}

// --format token → a MIME type with a parser, or exit 1.
export function inputFormat (token) {
  if (!token) return undefined
  const mimeType = resolveFormat(token)
  if (!formats.parsers.has(mimeType)) fail(`unsupported input format: ${token}`)
  return mimeType
}

export async function readQuery (args) {
  const query = args['query-file']
    ? await readFile(args['query-file'], 'utf8')
    : args.query
  if (!query) fail('provide a SPARQL query as argument or via --query-file')
  return query
}
