import { defineCommand } from "citty";
import rdf from "rdf-ext";
import { pathToFileGraph, streamFileQuads } from "../inputs.js";
import { resolveFormat, writeQuadStreamAsNQ } from "../io.js";

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
    name: "read",
    description:
      "Convenience: parse RDF files given as path arguments → N-Quads stream on stdout. " +
      "Shortcut for `glob | from-paths` when you already know the paths and want explicit files (no glob expansion — let the shell expand wildcards, or use `glob | from-paths` for recursive ** patterns). " +
      "Multiple files are merged into a single stream. Graphless triples remain in the default graph unless --graph-from path is set, which uses the file path as the named graph IRI for each file's default-graph triples.",
  },
  args: {
    format: {
      type: "string",
      alias: "f",
      description:
        "Input format for all files (auto-detected by extension by default)",
    },
    "graph-from": {
      type: "string",
      description: "Assign graph identity to graphless input: path",
    },
  },
  async run({ args }) {
    const files = args._ || [];
    if (files.length === 0) {
      process.stderr.write("error: provide one or more file paths\n");
      process.exit(1);
    }

    const graphFrom = args["graph-from"];
    if (graphFrom && graphFrom !== "path") {
      process.stderr.write('error: --graph-from only supports "path"\n');
      process.exit(1);
    }

    const forcedFormat = resolveFormat(args.format);
    let failed = false;
    for (const file of files) {
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
        failed = true;
        process.stderr.write(`error: ${file}: ${error}\n`);
      }
    }

    if (failed) process.exit(1);
  },
});
