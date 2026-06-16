import { defineCommand } from "citty";
import { quadsFromPaths } from "../inputs.js";
import { readLines, resolveFormat, writeQuads } from "../io.js";

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
    const graphFrom = args["graph-from"];
    if (graphFrom && graphFrom !== "path") {
      process.stderr.write('error: --graph-from only supports "path"\n');
      process.exit(1);
    }

    let sawPath = false;
    async function* paths() {
      for await (const file of readLines(process.stdin)) {
        sawPath = true;
        yield file;
      }
    }

    await writeQuads(
      quadsFromPaths(paths(), {
        format: resolveFormat(args.format),
        graphFrom,
        onError: (file, error) =>
          process.stderr.write(`error: ${file}: ${error}\n`),
      }),
    );

    if (!sawPath) {
      process.stderr.write("error: expected one path per line on stdin\n");
      process.exit(1);
    }
  },
});
