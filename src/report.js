function termValue(term) {
  if (!term) return ''
  if (Array.isArray(term)) return term.map(termValue).join('; ')
  if (term.termType === 'BlankNode') return '[blank node]'
  return term.value ?? String(term)
}

function pathToString(path) {
  if (!path || path.length === 0) return ''
  return path.map(step => {
    const pred = step.predicates?.[0]?.value ?? ''
    if (step.start === 'object') return `^<${pred}>`
    if (step.quantifier === 'oneOrMore') return `<${pred}>+`
    if (step.quantifier === 'zeroOrMore') return `<${pred}>*`
    if (step.quantifier === 'zeroOrOne') return `<${pred}>?`
    return `<${pred}>`
  }).join(' / ')
}

export function summarizeReport(report) {
  return {
    conforms: report.conforms,
    violationCount: report.results.length,
    results: report.results.map(r => ({
      focusNode: r.focusNode?.terms?.[0]?.value ?? '',
      path: pathToString(r.path),
      severity: termValue(r.severity),
      sourceConstraint: termValue(r.constraintComponent),
      message: r.message.map(m => m.value).join('; '),
      value: r.value?.terms?.[0] ? termValue(r.value.terms[0]) : '',
    })),
  }
}

export function formatMarkdownReport(summary, { label = 'SHACL Validation' } = {}) {
  const lines = [
    `## ${label}`,
    '',
    `- **Conforms**: ${summary.conforms ? 'yes' : 'no'}`,
    `- **Violations**: ${summary.violationCount}`,
  ]

  if (summary.results.length > 0) {
    lines.push('', '### Results', '')
    for (const [i, r] of summary.results.entries()) {
      lines.push(`**${i + 1}.** Focus node: \`${r.focusNode}\``)
      if (r.path) lines.push(`   Path: \`${r.path}\``)
      lines.push(`   Severity: \`${r.severity}\``)
      lines.push(`   Constraint: \`${r.sourceConstraint}\``)
      if (r.message) lines.push(`   Message: ${r.message}`)
      if (r.value) lines.push(`   Value: \`${r.value}\``)
      lines.push('')
    }
  }

  return lines.join('\n')
}
