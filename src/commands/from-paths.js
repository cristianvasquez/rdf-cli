import { defineCommand } from "citty";
import rdf from "rdf-ext";
import { pathToFileGraph, streamFileQuads } from "../inputs.js";
import { readLines, resolveFormat, writeQuadStreamAsNQ } from "../io.js";

function assignDefaultGraph(graph) {
  return (quad) =>
    rdf.quad(
      quad.subject,
      quad.predicate,
      quad.object,
      quad.graph.termType === "DefaultGraph" ? graph : quad.graph,
    );
}

export default defineCommand({
  meta: {
    name: "from-paths",
    description:
      "Read paths from stdin (one per line), parse RDF files → N-Quads stream on stdout. " +
      "Multiple files are merged into a single stream. Graphless triples remain in the default graph unless --graph-from path is set, which uses the file path as the named graph IRI for each file's default-graph triples.",
  },
  args: {
    format: {
      type: "string",
      alias: "f",
      description:
        "Input format for all paths (auto-detected by extension by default)",
    },
    "graph-from": {
      type: "string",
      description: "Assign graph identity to graphless input: path",
    },
  },
  async run({ args }) {
    let sawPath = false;
    const graphFrom = args["graph-from"];
    if (graphFrom && graphFrom !== "path") {
      process.stderr.write('error: --graph-from only supports "path"\n');
      process.exit(1);
    }

    const forcedFormat = resolveFormat(args.format);
    for await (const file of readLines(process.stdin)) {
      sawPath = true;
      try {
        const stream = streamFileQuads(file, forcedFormat);
        if (graphFrom === "path") {
          await writeQuadStreamAsNQ(
            stream,
            assignDefaultGraph(pathToFileGraph(file)),
          );
        } else {
          await writeQuadStreamAsNQ(stream);
        }
      } catch (error) {
        process.stderr.write(`error: ${file}: ${error}\n`);
      }
    }

    if (!sawPath) {
      process.stderr.write("error: expected one path per line on stdin\n");
      process.exit(1);
    }
  },
});
