import { describe, expect, it } from 'vitest'
import { YAMLException } from 'js-yaml'
import { ZodError } from 'zod'
import { parseSpecFromBlob } from '../../prompts/index'

// Minimal valid spec YAML. Every required field of PromptSpecSchema is present.
const validYaml = `
name: TestSpec
version: 1
category: generation
task: test
description: test spec
temperature: 0.3
system_message: hello
template: hi {{name}}
input_variables:
  - name: name
    description: test var
    required: true
`

describe('parseSpecFromBlob', () => {
  it('returns a valid PromptSpec for a well-formed YAML string', () => {
    const spec = parseSpecFromBlob(validYaml)
    expect(spec.name).toBe('TestSpec')
    expect(spec.version).toBe(1)
    expect(spec.category).toBe('generation')
    expect(spec.task).toBe('test')
    expect(spec.temperature).toBe(0.3)
    expect(spec.system_message).toBe('hello')
    expect(spec.template).toBe('hi {{name}}')
    expect(spec.input_variables).toHaveLength(1)
    expect(spec.input_variables[0]).toEqual({
      name: 'name',
      description: 'test var',
      required: true,
    })
  })

  it('throws YAMLException on malformed YAML syntax', () => {
    // Unclosed flow-sequence bracket → YAMLException
    const malformed = 'name: TestSpec\nversion: [unclosed'
    expect(() => parseSpecFromBlob(malformed)).toThrow(YAMLException)
  })

  it('throws ZodError when YAML parses but fails schema validation', () => {
    // Omit required system_message field
    const invalidSchema = `
name: TestSpec
version: 1
category: generation
task: test
description: test spec
temperature: 0.3
template: hi {{name}}
input_variables:
  - name: name
    description: test var
    required: true
`
    expect(() => parseSpecFromBlob(invalidSchema)).toThrow(ZodError)
  })

  it('does not cache — two calls with different YAML return different specs', () => {
    const otherYaml = validYaml.replace('name: TestSpec', 'name: OtherSpec')
    const specA = parseSpecFromBlob(validYaml)
    const specB = parseSpecFromBlob(otherYaml)
    expect(specA.name).toBe('TestSpec')
    expect(specB.name).toBe('OtherSpec')
  })

  it('does not cache — two calls with identical YAML both succeed independently', () => {
    const specA = parseSpecFromBlob(validYaml)
    const specB = parseSpecFromBlob(validYaml)
    // No identity assumption — just that both parse cleanly.
    expect(specA.name).toBe('TestSpec')
    expect(specB.name).toBe('TestSpec')
  })

  it('defaults system_only to false when the YAML does not include it', () => {
    const spec = parseSpecFromBlob(validYaml)
    expect(spec.system_only).toBe(false)
  })
})
