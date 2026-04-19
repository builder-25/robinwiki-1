import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import Handlebars from 'handlebars'
import { load as loadYaml } from 'js-yaml'
import { PromptSpecSchema } from './schema.js'
import type { PromptSpec } from './schema.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SPECS_DIR = resolve(__dirname, 'specs')

const specCache = new Map<string, PromptSpec>()

/**
 * Load and validate a YAML prompt spec file.
 * Results are cached by key (filename + optional subdir).
 */
export function loadSpec(filename: string, subdir?: string): PromptSpec {
  const key = subdir ? `${subdir}/${filename}` : filename
  const cached = specCache.get(key)
  if (cached) return cached

  const dir = subdir ? resolve(SPECS_DIR, subdir) : SPECS_DIR
  const filePath = resolve(dir, filename)
  const raw = readFileSync(filePath, 'utf-8')
  const parsed = loadYaml(raw)
  const spec = PromptSpecSchema.parse(parsed)

  specCache.set(key, spec)
  return spec
}

/**
 * Render a Handlebars template with the given variables.
 * Uses noEscape to avoid HTML entity escaping (these are LLM prompts, not HTML).
 */
export function renderTemplate(template: string, variables: Record<string, unknown>): string {
  const compiled = Handlebars.compile(template, { noEscape: true })
  return compiled(variables)
}

/**
 * Parse and validate a YAML blob (arbitrary string) through PromptSpecSchema.
 * Unlike loadSpec, this does NOT read from disk and does NOT cache results.
 * Throws YAMLException on syntax errors; throws ZodError on schema errors.
 * Used by:
 * - PUT /wiki-types/:slug validation pipeline (core)
 * - regen.ts YAML-blob override path (core)
 */
export function parseSpecFromBlob(yaml: string): PromptSpec {
  const parsed = loadYaml(yaml)
  return PromptSpecSchema.parse(parsed)
}
