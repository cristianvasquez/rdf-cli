import { defineCommand } from "citty";
import { quadsFromPaths } from "../inputs.js";
import { resolveFormat, writeQuads } from "../io.js";

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

    let failed = false;
    await writeQuads(
      quadsFromPaths(files, {
        format: resolveFormat(args.format),
        graphFrom,
        onError: (file, error) => {
          failed = true;
          process.stderr.write(`error: ${file}: ${error}\n`);
        },
      }),
    );

    if (failed) process.exitCode = 1;
  },
});
