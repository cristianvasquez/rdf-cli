import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import formats from "@rdfjs/formats";
import { getStreamAsBuffer } from "get-stream";
import rdf from "rdf-ext";

export const NQUADS = "application/n-quads";
export const NTRIPLES = "application/n-triples";

export const FORMAT_ALIASES = {
  turtle: "text/turtle",
  ttl: "text/turtle",
  trig: "application/trig",
  ntriples: "application/n-triples",
  nt: "application/n-triples",
  nquads: "application/n-quads",
  nq: "application/n-quads",
  jsonld: "application/ld+json",
  json: "application/ld+json",
  rdfxml: "application/rdf+xml",
  xml: "application/rdf+xml",
  n3: "text/n3",
};

export function resolveFormat(fmt) {
  if (!fmt) return null;
  return FORMAT_ALIASES[fmt.toLowerCase()] || fmt;
}

export function detectFormat(sample) {
  const text = sample.trimStart();
  if (/^(@prefix|@base|\bPREFIX\b|\bBASE\b)/i.test(text)) return "text/turtle";
  if (text.startsWith("{") || text.startsWith("["))
    return "application/ld+json";
  if (/^<\?xml|^<rdf:/i.test(text)) return "application/rdf+xml";
  if (/^\s*(?:GRAPH\s+<|<[^>]+>\s*\{)/m.test(text)) return "application/trig";

  const firstLine =
    text
      .split("\n")
      .find((line) => line.trim() && !line.trim().startsWith("#")) || "";
  const terms =
    firstLine.match(
      /(<[^>]+>|_:\S+|"(?:[^"\\]|\\.)*"(?:[@^][^\s.]+)?|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    ) || [];
  if (terms.length >= 4) return "application/n-quads";
  if (terms.length === 3) return "application/n-triples";
  return null;
}

export async function readDatasetFromStream(stream, hintFormat, errorMessage) {
  const buffer = await getStreamAsBuffer(stream);
  const format = hintFormat || detectFormat(buffer.toString("utf8", 0, 500));
  if (!format) {
    process.stderr.write(`${errorMessage}\n`);
    process.exit(1);
  }

  const dataset = rdf.dataset();
  await dataset.import(formats.parsers.import(format, Readable.from([buffer])));
  return dataset;
}

export async function readStdin(hintFormat) {
  return readDatasetFromStream(
    process.stdin,
    hintFormat,
    "error: cannot detect stdin format — use --format",
  );
}

export function readQuadStream(stream, format) {
  return formats.parsers.import(format, stream);
}

export function readQuadStreamFromStdin(format) {
  return readQuadStream(process.stdin, format);
}

export async function* readLines(stream) {
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    const trimmed = line.trim();
    if (trimmed) yield trimmed;
  }
}

export async function loadPrefixes(prefixFile) {
  const candidates = [
    prefixFile,
    join(process.cwd(), ".prefixes.json"),
    join(process.cwd(), "prefixes.json"),
  ].filter(Boolean);

  for (const file of candidates) {
    if (existsSync(file)) {
      return JSON.parse(await readFile(file, "utf8"));
    }
  }

  return {};
}

function quadMapper(map) {
  return new Transform({
    objectMode: true,
    transform(quad, _encoding, callback) {
      callback(null, map(quad));
    },
  });
}

// Serialize a quad source to stdout. `source` may be a quad stream, an
// rdf-ext dataset, or any (async) iterable of quads; `map` optionally
// rewrites each quad. Backpressure is handled by piping; stdout is left
// open so a command can emit several quad sources in sequence.
export async function writeQuads(source, { format = NQUADS, map } = {}) {
  const input =
    source instanceof Readable
      ? source
      : Readable.from(source, { objectMode: true });
  const quads = map ? input.pipe(quadMapper(map)) : input;
  const bytes = formats.serializers.import(format, quads);
  for (const upstream of new Set([input, quads])) {
    upstream.on("error", (error) => bytes.destroy(error));
  }
  await pipeline(bytes, process.stdout, { end: false });
}
