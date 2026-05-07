import { readFile } from "node:fs/promises";
import { defineCommand } from "citty";
import { readStdin, resolveFormat, writeDatasetAsNQ } from "../io.js";
import { datasetToStore, storeConstruct } from "../store.js";

export default defineCommand({
  meta: {
    name: "construct",
    description:
      "SPARQL CONSTRUCT on dataset stream stdin → dataset stream stdout. " +
      "Output is always graphless (all triples go into the default graph). " +
      "GRAPH clauses in the CONSTRUCT template are not supported by the SPARQL engine — " +
      'they cause a cryptic parse error ("expected one of \'.\', \':\'"). ' +
      "To assign a named graph to the output, pipe through graph-assign.",
  },
  args: {
    query: { type: "positional", description: "SPARQL CONSTRUCT query string" },
    "query-file": {
      type: "string",
      description: "Read SPARQL query from file instead",
    },
    format: {
      type: "string",
      alias: "f",
      description:
        "Input format (default: n-quads). Accepted: turtle | ttl | trig | nquads | nq | ntriples | nt | jsonld | json | rdfxml | xml | n3",
    },
  },
  async run({ args }) {
    const query = args["query-file"]
      ? await readFile(args["query-file"], "utf8")
      : args.query;
    if (!query) {
      process.stderr.write(
        "error: provide a SPARQL query as argument or via --query-file\n",
      );
      process.exit(1);
    }

    writeDatasetAsNQ(
      storeConstruct(
        datasetToStore(
          await readStdin(resolveFormat(args.format) || "application/n-quads"),
        ),
        query,
      ),
    );
  },
});
