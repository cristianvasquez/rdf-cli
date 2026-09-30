// Fixes for two shacl-engine 1.1.2 bugs, from rdf-ext/shacl-engine PR #90.
// shacl-engine lets a caller replace the compile function of a constraint
// (Validator option `validations`); this module does that for sh:not and
// sh:qualifiedValueShape. Everything else is upstream code.
//
// Remove this file when PR #90 is in a shacl-engine release: tests in
// tests/shacl.test.js ("sh:not with several values", "sh:qualifiedValueShape
// ... via sh:node") must still pass without it.
//
// The functions below are upstream lib/validations/{logical,shape}.js with
// the fix applied. They import upstream internals, so package.json pins
// shacl-engine to ~1.1.2.
import { fromRdf } from 'rdf-literal'
import { Validator } from 'shacl-engine'
import { every, filter, map } from 'shacl-engine/lib/async.js'
import * as ns from 'shacl-engine/lib/namespaces.js'

// --- sh:not: upstream compiled only one shape; a shape with several sh:not values crashed.

function compileNot (shape) {
  const not = [...shape.ptr.out([ns.sh.not])].map(ptr => shape.validator.shape(ptr))

  return {
    generic: validateNot(not)
  }
}

function validateNot (not) {
  return async context => {
    for (const shape of not) {
      const notReport = (await shape.validate(context.create({ child: true, focusNode: context.valueOrNode }))).report

      const result = !notReport.conforms

      context.test(result, ns.sh.NotConstraintComponent, {
        args: { not: shape.ptr.term },
        message: [context.factory.literal('Value does have shape {$not}')],
        results: notReport.results,
        value: context.valueOrNode
      })
    }
  }
}

// --- sh:qualifiedValueShape: the child context now carries `value` (the fix), so a
// qualified shape evaluates correctly inside a shape reached via sh:node.

function compileQualifiedShape (shape) {
  const valueShape = shape.validator.shape(shape.ptr.out([ns.sh.qualifiedValueShape]))

  const valueShapesDisjointTerm = shape.ptr.out([ns.sh.qualifiedValueShapesDisjoint]).term
  const valueShapesDisjoint = valueShapesDisjointTerm ? fromRdf(valueShapesDisjointTerm) : false

  const maxCountTerm = shape.ptr.out([ns.sh.qualifiedMaxCount]).term
  const maxCount = maxCountTerm ? parseInt(maxCountTerm.value) : null

  const minCountTerm = shape.ptr.out([ns.sh.qualifiedMinCount]).term
  const minCount = minCountTerm ? parseInt(minCountTerm.value) : null

  return {
    property: validateQualifiedShapeProperty(valueShape, valueShapesDisjoint, maxCount, minCount)
  }
}

function validateQualifiedShapeProperty (valueShape, valueShapesDisjoint, maxCount, minCount) {
  return async context => {
    const resultsDeep = []
    let siblingShapes = []

    if (valueShapesDisjoint) {
      siblingShapes = new Set(
        context.shape.ptr
          .in([ns.sh.property])
          .out([ns.sh.property])
          .out([ns.sh.qualifiedValueShape])
          .filter(ptr => !ptr.term.equals(valueShape.ptr.term))
          .map(ptr => context.shape.validator.shape(ptr))
      )
    }

    const count = (await filter(context.values, async value => {
      const valueShapeReport = (await valueShape.validate(context.create({ child: true, focusNode: value, value }))).report

      resultsDeep.push(valueShapeReport.results)

      if (!valueShapeReport.conforms) {
        return false
      }

      if (siblingShapes.length === 0) {
        return true
      }

      if (context.options.debug || context.options.details) {
        // all shapes are processed if debug info or details are requested
        const siblingReports = await map([...siblingShapes], async siblingShape => {
          return (await siblingShape.validate(context.create({ child: true, focusNode: value, value }))).report
        })

        resultsDeep.push(siblingReports.flatMap(report => report.results))

        return !siblingReports.every(report => report.conforms)
      } else {
        // otherwise, we stop after the first shape does not conform
        return !await every([...siblingShapes], async siblingShape => {
          return (await siblingShape.validate(context.create({ child: true, focusNode: value, value }))).report.conforms
        })
      }
    })).length

    if (maxCount !== null) {
      context.test(count <= maxCount, ns.sh.QualifiedMaxCountConstraintComponent, {
        args: {
          qualifiedMaxCount: maxCount,
          qualifiedValueShape: valueShape.ptr.term,
          qualifiedValueShapesDisjoint: valueShapesDisjoint
        },
        message: [context.factory.literal('More than {$qualifiedMaxCount} values have shape {$qualifiedValueShape}')],
        results: resultsDeep.flat()
      })
    }

    if (minCount !== null) {
      context.test(count >= minCount, ns.sh.QualifiedMinCountConstraintComponent, {
        args: {
          qualifiedMinCount: minCount,
          qualifiedValueShape: valueShape.ptr.term,
          qualifiedValueShapesDisjoint: valueShapesDisjoint
        },
        message: [context.factory.literal('Less than {$qualifiedMinCount} values have shape {$qualifiedValueShape}')],
        results: resultsDeep.flat()
      })
    }
  }
}

const FIXES = [
  [ns.sh.not, compileNot],
  [ns.sh.qualifiedValueShape, compileQualifiedShape],
]

// The one way rdf-cli builds a shacl-engine Validator: upstream plus the fixes.
export function createValidator (shapes, options = {}) {
  return new Validator(shapes, { ...options, validations: [...FIXES, ...(options.validations ?? [])] })
}
