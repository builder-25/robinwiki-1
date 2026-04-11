/**
 * Thread wiki regeneration.
 * Builds a structured wiki from accumulated fragments using YAML-based type-specific prompts.
 */

import { loadWikiGenerationSpec, type WikiType } from '@robin/shared'

// Re-export the type for consumers
export type { WikiType }

// Valid thread types for external validation
export const THREAD_WIKI_TYPES: readonly WikiType[] = [
  'log',
  'collection',
  'belief',
  'decision',
  'project',
  'objective',
  'skill',
  'agent',
  'voice',
  'principles',
] as const

/**
 * Regenerates a thread wiki from its fragments using a YAML-based type-specific template.
 * Returns full wiki markdown including YAML frontmatter.
 */
export async function regenerateWiki(
  threadId: string,
  threadType: string,
  fragments: string[],
  model: string,
  llm: (system: string, user: string) => Promise<string>,
  threadPrompt?: string
): Promise<string> {
  const safeType: WikiType = THREAD_WIKI_TYPES.includes(threadType as WikiType)
    ? (threadType as WikiType)
    : 'log'

  const fragmentsBlock = fragments.map((f, i) => `### Fragment ${i + 1}\n${f}`).join('\n\n')
  const today = new Date().toISOString().split('T')[0]

  const spec = loadWikiGenerationSpec(safeType, {
    fragments: fragmentsBlock,
    title: threadId, // Will be replaced by LLM
    date: today,
    count: fragments.length,
  })

  let user = spec.user
  if (threadPrompt) {
    user += `\n\nUSER INSTRUCTIONS FOR THIS THREAD:\n${threadPrompt}\n`
  }

  const result = await llm(spec.system ?? '', user)

  // Strip any LLM-generated frontmatter — return body only.
  // Frontmatter is now assembled mechanically by the caller.
  return stripFrontmatter(result)
}

/**
 * Strip YAML frontmatter (--- ... ---) from markdown text, returning body only.
 * If no frontmatter is present, returns the text as-is.
 */
export function stripFrontmatter(text: string): string {
  const trimmed = text.trimStart()
  if (!trimmed.startsWith('---')) return text.trim()

  // Find the closing --- after the opening one
  const afterOpening = trimmed.indexOf('\n')
  if (afterOpening === -1) return text.trim()

  const closingIdx = trimmed.indexOf('\n---', afterOpening)
  if (closingIdx === -1) return text.trim()

  // Everything after the closing --- delimiter
  const body = trimmed.slice(closingIdx + 4).trim()
  return body
}
