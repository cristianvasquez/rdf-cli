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

export const httpArgs = {
  header: {
    type: 'string',
    alias: 'H',
    description: 'Add an HTTP request header, "Name: value". Repeatable.',
  },
  timeout: {
    type: 'string',
    description: 'Abort the request when the server does not answer in this many milliseconds',
  },
}

// --header and --timeout → { headers, timeoutMs }, or exit 1.
export function httpOpts (args) {
  const headers = {}
  for (const header of [args.header ?? []].flat()) {
    const at = header.indexOf(':')
    if (at < 1) fail(`--header expects "Name: value", got: ${header}`)
    headers[header.slice(0, at).trim()] = header.slice(at + 1).trim()
  }
  let timeoutMs
  if (args.timeout !== undefined) {
    timeoutMs = Number(args.timeout)
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) fail(`--timeout expects a positive integer, got: ${args.timeout}`)
  }
  return { headers, timeoutMs }
}
