import assert from "node:assert/strict";
import test from "node:test";
import rdf from "rdf-ext";
import { datasetToString, TRIG, TURTLE } from "../src/sinks/pretty.js";

const XSD_INTEGER = "http://www.w3.org/2001/XMLSchema#integer";

function namedNode(value) {
  return rdf.namedNode(value);
}

function literal(value) {
  return rdf.literal(value);
}

function typedLiteral(value, datatype) {
  return rdf.literal(value, namedNode(datatype));
}

test("pretty trig groups quads from the same named graph", async () => {
  const dataset = rdf.dataset([
    rdf.quad(
      namedNode("http://example.org/Bob"),
      namedNode("http://xmlns.com/foaf/0.1/name"),
      literal("Bob"),
      namedNode("urn:batch"),
    ),
    rdf.quad(
      namedNode("http://example.org/Bob"),
      namedNode("http://example.org/likes"),
      namedNode("http://example.org/Alice"),
      namedNode("urn:batch"),
    ),
    rdf.quad(
      namedNode("http://example.org/Bob"),
      namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
      namedNode("http://xmlns.com/foaf/0.1/Person"),
      namedNode("urn:batch"),
    ),
  ]);

  const output = await datasetToString(dataset, { format: TRIG, prefixes: {} });

  assert.equal((output.match(/<urn:batch> \{/g) || []).length, 1);
  assert.match(output, /<http:\/\/xmlns\.com\/foaf\/0\.1\/name> "Bob"/);
  assert.match(
    output,
    /<http:\/\/example\.org\/likes> <http:\/\/example\.org\/Alice>/,
  );
  assert.match(output, /a <http:\/\/xmlns\.com\/foaf\/0\.1\/Person>/);
});

test("pretty trig keeps graphless input as plain triples", async () => {
  const dataset = rdf.dataset([
    rdf.quad(
      namedNode("http://example.org/Bob"),
      namedNode("http://xmlns.com/foaf/0.1/name"),
      literal("Bob"),
    ),
    rdf.quad(
      namedNode("http://example.org/Bob"),
      namedNode("http://example.org/likes"),
      namedNode("http://example.org/Alice"),
    ),
  ]);

  const output = await datasetToString(dataset, { format: TRIG, prefixes: {} });

  assert.doesNotMatch(output, /^\s*\{/m);
  assert.match(output, /<http:\/\/example\.org\/Bob>/);
  assert.match(output, /<http:\/\/xmlns\.com\/foaf\/0\.1\/name> "Bob"/);
});

test("pretty turtle renders rdf:type predicates as a", async () => {
  const dataset = rdf.dataset([
    rdf.quad(
      namedNode("http://entanglement.lab/ns#w3"),
      namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
      namedNode("http://entanglement.lab/ns#Window"),
    ),
  ]);

  const output = await datasetToString(dataset, {
    format: TURTLE,
    prefixes: {
      ent: "http://entanglement.lab/ns#",
      rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    },
  });

  assert.match(output, /ent:w3 a ent:Window;/);
});

test("pretty turtle keeps rdf prefix when another rdf term is rendered", async () => {
  const dataset = rdf.dataset([
    rdf.quad(
      namedNode("http://entanglement.lab/ns#list"),
      namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#first"),
      namedNode("http://entanglement.lab/ns#item"),
    ),
  ]);

  const output = await datasetToString(dataset, {
    format: TURTLE,
    prefixes: {
      ent: "http://entanglement.lab/ns#",
      rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    },
  });

  assert.match(output, /@prefix rdf:/);
  assert.match(output, /ent:list\s+rdf:first ent:item/);
});

test("pretty turtle renders xsd:integer literals as numeric shorthand", async () => {
  const dataset = rdf.dataset([
    rdf.quad(
      namedNode("http://entanglement.lab/ns#panel"),
      namedNode("http://entanglement.lab/ns#width"),
      typedLiteral("320", XSD_INTEGER),
    ),
  ]);

  const output = await datasetToString(dataset, {
    format: TURTLE,
    prefixes: {},
  });

  assert.match(output, /<http:\/\/entanglement\.lab\/ns#width> 320\./);
  assert.doesNotMatch(
    output,
    /"320"\^\^<http:\/\/www\.w3\.org\/2001\/XMLSchema#integer>/,
  );
});

test("pretty turtle keeps invalid xsd:integer literals explicit", async () => {
  const dataset = rdf.dataset([
    rdf.quad(
      namedNode("http://entanglement.lab/ns#panel"),
      namedNode("http://entanglement.lab/ns#width"),
      typedLiteral("not-a-number", XSD_INTEGER),
    ),
  ]);

  const output = await datasetToString(dataset, {
    format: TURTLE,
    prefixes: {},
  });

  assert.match(
    output,
    /<http:\/\/entanglement\.lab\/ns#width> "not-a-number"\^\^<http:\/\/www\.w3\.org\/2001\/XMLSchema#integer>\./,
  );
});

test("pretty turtle preserves properly language-tagged literals", async () => {
  const dataset = rdf.dataset([
    rdf.quad(
      namedNode("http://example.org/x"),
      namedNode("http://purl.org/dc/terms/title"),
      rdf.literal("Hello", "en"),
    ),
  ]);

  const output = await datasetToString(dataset, {
    format: TURTLE,
    prefixes: { dct: "http://purl.org/dc/terms/" },
  });

  assert.match(output, /dct:title "Hello"@en\./);
});

test("pretty turtle nests single-use blank nodes", async () => {
  const page = rdf.blankNode("page");
  const dataset = rdf.dataset([
    rdf.quad(
      namedNode("http://entanglement.lab/ns#firefox-instance"),
      namedNode("http://entanglement.lab/ns#active"),
      page,
    ),
    rdf.quad(
      page,
      namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
      namedNode("http://entanglement.lab/ns#Page"),
    ),
    rdf.quad(
      page,
      namedNode("http://entanglement.lab/ns#title"),
      literal("entanglement-lab"),
    ),
  ]);

  const output = await datasetToString(dataset, {
    format: TURTLE,
    prefixes: { ent: "http://entanglement.lab/ns#" },
  });

  assert.match(output, /ent:active \[ a ent:Page;/);
  assert.match(output, /ent:title "entanglement-lab"/);
  assert.doesNotMatch(output, /^_:page/m);
});

test("pretty turtle groups predicates for the same subject", async () => {
  const dataset = rdf.dataset([
    rdf.quad(
      namedNode("http://example.org/Bob"),
      namedNode("http://xmlns.com/foaf/0.1/name"),
      literal("Bob"),
    ),
    rdf.quad(
      namedNode("http://example.org/Bob"),
      namedNode("http://example.org/likes"),
      namedNode("http://example.org/Alice"),
    ),
  ]);

  const output = await datasetToString(dataset, {
    format: TURTLE,
    prefixes: {},
  });

  assert.match(output, /<http:\/\/example\.org\/Bob>/);
  assert.match(output, /<http:\/\/xmlns\.com\/foaf\/0\.1\/name> "Bob"/);
  assert.match(
    output,
    /<http:\/\/example\.org\/likes> <http:\/\/example\.org\/Alice>/,
  );
});
