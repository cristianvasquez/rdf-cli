import { getStreamAsBuffer } from 'get-stream'
import { Readable } from 'node:stream'
import { detectFormat } from '../formats.js'
import { parseQuads } from './parse.js'

// Read stdin bytes → Readable of quads. Streams directly when format is known;
// buffers to auto-detect otherwise. Stdin is one blank-node scope: labels pass
// through unchanged, so the N-Quads wire keeps them stable across stages.
export async function readFromStdin (hintFormat) {
  if (hintFormat) {
    return parseQuads(hintFormat, process.stdin)
  }
  const buffer = await getStreamAsBuffer(process.stdin)
  const fmt = detectFormat(buffer.toString('utf8', 0, 500))
  if (!fmt) {
    process.stderr.write('error: cannot detect stdin format; use --format\n')
    process.exit(1)
  }
  return parseQuads(fmt, Readable.from([buffer]))
}
