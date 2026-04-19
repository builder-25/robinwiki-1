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

// Minimal Handlebars AST typings — duplicated narrowly from
// core/src/lib/prompt-validation.ts because @robin/shared cannot depend on
// @robin/core. Private to this module; not re-exported. See RESEARCH.md §Risks
// #6 for the rationale against extracting a shared walker.
interface HbsPathExpression {
  type: 'PathExpression'
  original: string
}

interface HbsStatement {
  type: string
}

interface HbsMustacheStatement extends HbsStatement {
  type: 'MustacheStatement'
  path: HbsPathExpression
}

interface HbsProgram {
  body: HbsStatement[]
  blockParams?: string[]
}

interface HbsBlockStatement extends HbsStatement {
  type: 'BlockStatement'
  path: HbsPathExpression
  params: Array<HbsPathExpression | { type: string }>
  program: HbsProgram
  inverse?: HbsProgram
}

/**
 * Structured render-time warning. Kept open-typed in `code` so future phases
 * can add codes (e.g. `EMPTY_CONDITIONAL_BRANCH`) without churn across callers.
 */
export interface RenderWarning {
  code: 'UNKNOWN_VARIABLE'
  message: string
  detail?: { name?: string }
}

export interface RenderResult {
  rendered: string
  warnings: RenderWarning[]
}

/**
 * Render a PromptSpec's template against a variable map, returning the
 * rendered string and any structured warnings collected during a narrow AST
 * walk. Warnings currently cover only `UNKNOWN_VARIABLE` — a template
 * reference to a name that is not declared in `spec.input_variables`.
 *
 * Does NOT re-validate the template — the pre-save `validatePromptYaml`
 * pipeline in @robin/core owns helper-whitelist + block-param rejection.
 * Safe to call on any spec that has survived that validator; tolerates
 * malformed templates by silently returning zero warnings.
 */
export function renderPromptSpec(
  spec: PromptSpec,
  vars: Record<string, unknown>
): RenderResult {
  const rendered = renderTemplate(spec.template, vars)

  // Narrow reference-collection walk. Duplicates the subset of
  // validatePromptYaml's walk that gathers variable names — see RESEARCH.md
  // §Risks #6 for the intentional duplication.
  const referenced = new Set<string>()
  try {
    const ast = Handlebars.parse(spec.template) as unknown as HbsProgram
    collectReferences(ast.body, referenced)
  } catch {
    // Malformed templates should have been rejected upstream. Returning zero
    // warnings here is safe — the render output will contain literal mustaches
    // the consumer can see.
  }

  const declared = new Set(spec.input_variables.map((v) => v.name))
  const warnings: RenderWarning[] = []
  for (const ref of referenced) {
    if (!declared.has(ref)) {
      warnings.push({
        code: 'UNKNOWN_VARIABLE',
        message: `Template references {{${ref}}} but it is not declared in input_variables.`,
        detail: { name: ref },
      })
    }
  }

  return { rendered, warnings }
}

function collectReferences(body: HbsStatement[], out: Set<string>): void {
  for (const node of body) {
    if (node.type === 'MustacheStatement') {
      out.add((node as HbsMustacheStatement).path.original)
      continue
    }
    if (node.type === 'BlockStatement') {
      const block = node as HbsBlockStatement
      for (const param of block.params) {
        if (param.type === 'PathExpression') {
          out.add((param as HbsPathExpression).original)
        }
      }
      if (block.program) collectReferences(block.program.body, out)
      if (block.inverse) collectReferences(block.inverse.body, out)
    }
    // PartialStatement, CommentStatement, ContentStatement: skip (no refs).
  }
}
