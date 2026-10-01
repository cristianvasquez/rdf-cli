import assert from 'node:assert/strict'
import test from 'node:test'
import { Readable } from 'node:stream'
import rdf from 'rdf-ext'
import { canonicalNQuads } from '../src/serializers/canonical.js'
import { triplify } from '../src/serializers/triplify.js'
import { parseQuads } from '../src/sources/parse.js'

// Blank nodes in triplify: parse(triplify(quads)) is isomorphic to quads.
const HEAD = '@prefix ex: <http://ex/> .\n@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .\n'
const PREFIXES = { ex: 'http://ex/' }

async function parse (mimeType, text) {
  const quads = []
  for await (const quad of parseQuads(mimeType, Readable.from([text]))) quads.push(quad)
  return quads
}

async function roundTrip (body) {
  const quads = await parse('application/trig', HEAD + body)
  const text = await triplify(rdf.dataset(quads), PREFIXES)
  assert.equal(canonicalNQuads(await parse('application/trig', text)), canonicalNQuads(quads), text)
  return text
}

test('triplify: labeled blank nodes of different graphs stay different', async () => {
  await roundTrip(`
    ex:g1 { _:x ex:p ex:o1 . ex:s ex:p _:x . ex:t ex:p _:x . }
    ex:g2 { _:y ex:p ex:o2 . ex:s ex:p _:y . ex:t ex:p _:y . }`)
})

test('triplify: a blank node used in two graphs keeps its identity', async () => {
  await roundTrip('ex:g1 { ex:s ex:p _:x . } ex:g2 { ex:t ex:p _:x . }')
  await roundTrip('ex:s ex:p _:x . ex:g2 { _:x ex:q 1 . }')
  await roundTrip('_:g { _:g ex:p 1 . ex:s ex:p [ ex:q 2 ] . }')
})

test('triplify: a blank-node cycle is written', async () => {
  await roundTrip('_:z ex:p _:z .')
  await roundTrip('ex:g { _:z ex:p _:z . }')
  await roundTrip('_:a ex:p _:b . _:b ex:p _:a . _:c ex:p _:c .')
  await roundTrip('ex:g { _:a ex:p [ ex:p [ ex:p _:a ] ] . ex:s ex:p ex:o . }')
})

test('triplify: a blank node that is the value of a list item is written once', async () => {
  await roundTrip('_:h rdf:first _:v ; rdf:rest rdf:nil . _:v ex:q 1 .')
  await roundTrip('ex:s ex:p ex:c1 . ex:c1 rdf:first _:v ; rdf:rest rdf:nil . _:v ex:q 1 .')
  await roundTrip('ex:g { ex:s ex:p ( _:v [ ex:q 2 ] ) . _:v ex:q 1 . }')
})

test('triplify: a blank node that is the object of rdf:type is written', async () => {
  await roundTrip('ex:s a [ ex:q 1 ] .')
})

test('triplify: output without shared blank nodes is unchanged', async () => {
  const text = await roundTrip('ex:g1 { ex:s ex:p [ ex:q 1 ] . } ex:g2 { ex:s ex:p [ ex:q 2 ] . ex:t ex:p ( 1 2 ) . }')
  assert.equal(text, `@prefix ex: <http://ex/>.

<http://ex/g1> {
  ex:s
    ex:p [
        ex:q 1
      ].
}

<http://ex/g2> {
  ex:s
    ex:p [
        ex:q 2
      ].

  ex:t
    ex:p (1 2).
}
`)
})
