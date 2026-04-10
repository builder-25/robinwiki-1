/**
 * Person body synthesis: LLM call for rich profiles, sparse template for new people.
 */

import { loadPersonSummarySpec } from '@robin/shared'

export interface SynthesizePersonBodyInput {
  canonicalName: string
  aliases: string[]
  existingBody: string
  fragmentContents: string[]
  llm: (system: string, user: string) => Promise<string>
}

/**
 * Synthesize a person body from fragment contents.
 * Uses LLM for people with >= 3 fragments, sparse template for fewer.
 */
export async function synthesizePersonBody(input: SynthesizePersonBodyInput): Promise<string> {
  const { canonicalName, aliases, existingBody, fragmentContents, llm } = input

  // Sparse template for people with fewer than 3 fragments
  if (fragmentContents.length < 3) {
    return `Mentioned in ${fragmentContents.length} fragment(s). Not enough context for a summary yet.`
  }

  // Build fragments block
  const fragmentsBlock = fragmentContents.map((f, i) => `### Fragment ${i + 1}\n${f}`).join('\n\n')

  const spec = loadPersonSummarySpec({
    canonicalName,
    aliases: aliases.join(', '),
    existingBody,
    fragments: fragmentsBlock,
  })

  return llm(spec.system ?? '', spec.user)
}
