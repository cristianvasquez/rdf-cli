import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import rdf from 'rdf-ext'
import { materialize, pipe, provenanceToDataset, readPaths, validate } from '../src/pipeline/index.js'

const fixtures = fileURLToPath(new URL('./fixtures', import.meta.url))
const shapes = `${fixtures}/person-shape.ttl`

const prov = rdf.namespace('http://www.w3.org/ns/prov#')
const cli = rdf.namespace('urn:rdf-cli:prov#')
const rdfType = rdf.namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#').type
const iri = (s) => rdf.namedNode(s)

test('provenanceToDataset renders one prov:Activity per op with lineage and verdict', async () => {
  const env = await pipe(
    readPaths([`${fixtures}/person-valid.ttl`]),
    materialize,
    validate([shapes]),
  )()
  const ds = provenanceToDataset(env.history)

  // one activity + one generated entity per op
  assert.equal([...ds.match(null, rdfType, prov.Activity)].length, 3)
  assert.equal([...ds.match(null, prov.wasGeneratedBy, null)].length, 3)

  // materialize (op2) used read's (op1) entity, and derived from it
  const used = [...ds.match(iri('urn:rdf-cli:activity:op2'), prov.used, null)]
  assert.deepEqual(used.map((q) => q.object.value), ['urn:rdf-cli:entity:op1'])
  const derived = [...ds.match(iri('urn:rdf-cli:entity:op2'), prov.wasDerivedFrom, null)]
  assert.deepEqual(derived.map((q) => q.object.value), ['urn:rdf-cli:entity:op1'])

  // materialize recorded quadsIn; validate recorded the verdict
  assert.ok([...ds.match(iri('urn:rdf-cli:activity:op2'), cli.quadsIn, null)].length === 1)
  const conforms = [...ds.match(iri('urn:rdf-cli:activity:op3'), cli.conforms, null)]
  assert.equal(conforms[0].object.value, 'true')
})

test('provenanceToDataset renders an empty dataset for empty history', () => {
  assert.equal(provenanceToDataset([]).size, 0)
})
