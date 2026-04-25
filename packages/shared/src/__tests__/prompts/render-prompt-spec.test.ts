import { describe, expect, it } from 'vitest'
import {
  parseSpecFromBlob,
  renderPromptSpec,
  renderTemplate,
} from '../../prompts/index'

function buildYaml(params: {
  template: string
  inputVariables: Array<{ name: string; required: boolean }>
}): string {
  const vars = params.inputVariables
    .map(
      (v) =>
        `  - name: ${v.name}\n    description: ${v.name} var\n    required: ${v.required}`
    )
    .join('\n')
  return `
name: TestSpec
version: 1
category: generation
task: test
description: test spec
temperature: 0.3
system_message: hello
template: ${JSON.stringify(params.template)}
input_variables:
${vars}
`
}

describe('renderPromptSpec', () => {
  it('happy path — no warnings when every reference is declared', () => {
    const spec = parseSpecFromBlob(
      buildYaml({
        template: 'hi {{name}}',
        inputVariables: [{ name: 'name', required: true }],
      })
    )
    const result = renderPromptSpec(spec, { name: 'World' })
    expect(result.rendered).toBe('hi World')
    expect(result.warnings).toEqual([])
  })

  it('emits one UNKNOWN_VARIABLE warning for an undeclared reference', () => {
    const spec = parseSpecFromBlob(
      buildYaml({
        template: '{{declared}} {{unknown}}',
        inputVariables: [{ name: 'declared', required: true }],
      })
    )
    const result = renderPromptSpec(spec, { declared: 'x', unknown: 'y' })
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]?.code).toBe('UNKNOWN_VARIABLE')
    expect(result.warnings[0]?.detail?.name).toBe('unknown')
    expect(result.warnings[0]?.message).toContain('unknown')
  })

  it('de-duplicates multiple references to the same undeclared variable', () => {
    const spec = parseSpecFromBlob(
      buildYaml({
        template: '{{a}} {{a}} {{b}}',
        inputVariables: [{ name: 'a', required: true }],
      })
    )
    const result = renderPromptSpec(spec, { a: 'x', b: 'y' })
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]?.detail?.name).toBe('b')
  })

  it('counts a declared block-helper variable as a valid reference (no warning)', () => {
    const spec = parseSpecFromBlob(
      buildYaml({
        template: '{{#if flag}}hi{{/if}}',
        inputVariables: [{ name: 'flag', required: true }],
      })
    )
    const result = renderPromptSpec(spec, { flag: true })
    expect(result.warnings).toEqual([])
  })

  it('emits an UNKNOWN_VARIABLE warning for an undeclared block-helper target', () => {
    const spec = parseSpecFromBlob(
      buildYaml({
        template: '{{#if flag}}hi{{/if}}',
        inputVariables: [{ name: 'other', required: true }],
      })
    )
    const result = renderPromptSpec(spec, { flag: true })
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]?.code).toBe('UNKNOWN_VARIABLE')
    expect(result.warnings[0]?.detail?.name).toBe('flag')
  })

  it('each-helper reference counts — undeclared target becomes UNKNOWN_VARIABLE', () => {
    const spec = parseSpecFromBlob(
      buildYaml({
        template: '{{#each items}}x{{/each}}',
        inputVariables: [{ name: 'other', required: true }],
      })
    )
    const result = renderPromptSpec(spec, { items: [1, 2] })
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]?.detail?.name).toBe('items')
  })

  it('rendered output matches renderTemplate byte-for-byte', () => {
    const template = 'hi {{name}}, count={{count}}'
    const spec = parseSpecFromBlob(
      buildYaml({
        template,
        inputVariables: [
          { name: 'name', required: true },
          { name: 'count', required: true },
        ],
      })
    )
    const vars = { name: 'World', count: 2 }
    const result = renderPromptSpec(spec, vars)
    expect(result.rendered).toBe(renderTemplate(template, vars))
  })

  it('integer variables render correctly (Handlebars stringifies numbers)', () => {
    const spec = parseSpecFromBlob(
      buildYaml({
        template: '{{count}}',
        inputVariables: [{ name: 'count', required: true }],
      })
    )
    const result = renderPromptSpec(spec, { count: 2 })
    expect(result.rendered).toBe('2')
    expect(result.warnings).toEqual([])
  })
})
