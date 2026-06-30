import formats from '@rdfjs/formats'
import { getStreamAsBuffer } from 'get-stream'
import { Readable } from 'node:stream'
import { detectFormat } from '../formats.js'

// Read stdin bytes → Readable of quads. Streams directly when format is known;
// buffers to auto-detect otherwise.
export async function readFromStdin (hintFormat) {
  if (hintFormat) {
    return formats.parsers.import(hintFormat, process.stdin)
  }
  const buffer = await getStreamAsBuffer(process.stdin)
  const fmt = detectFormat(buffer.toString('utf8', 0, 500))
  if (!fmt) {
    process.stderr.write('error: cannot detect stdin format\n')
    process.exit(1)
  }
  return formats.parsers.import(fmt, Readable.from([buffer]))
}
