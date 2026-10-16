import assert from 'node:assert/strict'
import { Readable, Writable } from 'node:stream'
import test from 'node:test'
import { Store } from 'oxigraph'
import { readResults, writeTable } from '../src/sinks/table.js'
import { writeBindings } from '../src/sinks/bindings.js'
import { select } from '../src/transforms/sparql.js'

function capture () {
  let text = ''
  const out = new Writable({ write (chunk, enc, cb) { text += chunk; cb() } })
  out.get = () => text
  return out
}

const scenarios = [
  ['all unbound', 'SELECT ?s ?missing ?o WHERE { ?s ?p ?o OPTIONAL { ?s <urn:none> ?missing } }', ['s', 'missing', 'o'], 's,missing,o\nurn:a,,urn:x\n', '?s\t?missing\t?o\n<urn:a>\t\t<urn:x>\n'],
  ['some unbound', 'SELECT ?s ?missing WHERE { VALUES ?s { <urn:a> <urn:b> } OPTIONAL { VALUES (?s ?missing) { (<urn:b> "bound") } } } ORDER BY ?s', ['s', 'missing'], 's,missing\nurn:a,\nurn:b,bound\n', '?s\t?missing\n<urn:a>\t\n<urn:b>\t"bound"\n'],
  ['zero rows', 'SELECT ?s WHERE { ?s <urn:none> ?o }', ['s'], 's\n', '?s\n'],
  ['SELECT *', 'SELECT * WHERE { ?s ?p ?o }', ['o', 'p', 's'], 'o,p,s\nurn:x,urn:p,urn:a\n', '?o\t?p\t?s\n<urn:x>\t<urn:p>\t<urn:a>\n'],
  ['typed and language literals', 'SELECT ?lang ?typed ?lit ?iri WHERE { VALUES (?lang ?typed ?lit ?iri) { ("hello"@en 1 "urn:a" <urn:a>) } }', ['lang', 'typed', 'lit', 'iri'], 'lang,typed,lit,iri\nhello,1,urn:a,urn:a\n', '?lang\t?typed\t?lit\t?iri\n"hello"@en\t"1"^^<http://www.w3.org/2001/XMLSchema#integer>\t"urn:a"\t<urn:a>\n'],
  ['blank nodes', 'SELECT ?b WHERE { BIND(BNODE("b") AS ?b) }', ['b']],
  ['prototype names', 'SELECT ?constructor ?toString ?__proto__ WHERE { VALUES ?x { 1 } }', ['constructor', 'toString', '__proto__'], 'constructor,toString,__proto__\n,,\n', '?constructor\t?toString\t?__proto__\n\t\t\n'],
]
for (const format of ['csv', 'tsv', 'json']) {
  for (const [name, query, vars, csv, tsv] of scenarios) {
    test(`select wire -> table ${format}: ${name}`, async () => {
      const store = new Store()
      store.load('<urn:a> <urn:p> <urn:x> .', { format: 'nt' })
      const wire = capture()
      await writeBindings(select(store, query), { out: wire })
      const [head, ...bindings] = wire.get().trim().split('\n').map(JSON.parse)
      assert.deepEqual(head, { head: { vars } })
      if (name === 'all unbound') assert.ok(!Object.hasOwn(bindings[0], 'missing'))
      if (name === 'some unbound') assert.ok(!Object.hasOwn(bindings[0], 'missing'))
      if (name === 'typed and language literals') {
        assert.equal(bindings[0].lang['xml:lang'], 'en')
        assert.equal(bindings[0].typed.datatype, 'http://www.w3.org/2001/XMLSchema#integer')
        assert.equal(bindings[0].lit.type, 'literal')
        assert.equal(bindings[0].iri.type, 'uri')
      }
      const out = capture()
      await writeTable(await readResults(Readable.from([wire.get()])), { format, out })
      if (format === 'json') assert.deepEqual(JSON.parse(out.get()), { head: { vars }, results: { bindings } })
      else if (name === 'blank nodes') {
        assert.equal(bindings[0].b.type, 'bnode')
        assert.equal(out.get(), `${format === 'csv' ? 'b' : '?b'}\n_:${bindings[0].b.value}\n`)
      } else assert.equal(out.get(), format === 'csv' ? csv : tsv)
    })
  }
}

test('wire decoder requires a head', async () => {
  for (const input of ['', '{"x":"1"}\n']) {
    await assert.rejects(readResults(Readable.from([input])), /expected a head record/)
  }
})
test('table rejects jsonl', async () => {
  await assert.rejects(writeTable({ vars: [], rows: [] }, { format: 'jsonl' }), /unsupported table format/)
})
test('table streams header before rows and escapes CSV and TSV', async () => {
  const store = new Store()
  const query = 'SELECT ?x WHERE { VALUES ?x { "a,b" "say \\"hi\\"" "a\\tb\\nc" } }'
  for (const format of ['csv', 'tsv']) {
    const out = capture()
    const result = select(store, query)
    const rows = result.rows
    result.rows = (async function * () {
      assert.equal(out.get(), format === 'csv' ? 'x\n' : '?x\n')
      yield * rows
    })()
    await writeTable(result, { format, out })
    assert.equal(out.get(), format === 'csv' ? 'x\n"a,b"\n"say ""hi"""\n"a\tb\nc"\n' : '?x\n"a,b"\n"say \\"hi\\""\n"a\\tb\\nc"\n')
  }
})
