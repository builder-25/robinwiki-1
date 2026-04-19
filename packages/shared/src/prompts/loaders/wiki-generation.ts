import { z } from 'zod'
import { loadSpec, parseSpecFromBlob, renderTemplate } from '../loader.js'
import type { PromptResult } from '../types.js'
import type { PromptSpec } from '../schema.js'
import type { WikiType } from '../../types/wiki.js'
import { logWikiSchema } from '../specs/wiki-types/log.schema.js'
import { collectionWikiSchema } from '../specs/wiki-types/collection.schema.js'
import { beliefWikiSchema } from '../specs/wiki-types/belief.schema.js'
import { decisionWikiSchema } from '../specs/wiki-types/decision.schema.js'
import { projectWikiSchema } from '../specs/wiki-types/project.schema.js'
import { objectiveWikiSchema } from '../specs/wiki-types/objective.schema.js'
import { skillWikiSchema } from '../specs/wiki-types/skill.schema.js'
import { agentWikiSchema } from '../specs/wiki-types/agent.schema.js'
import { voiceWikiSchema } from '../specs/wiki-types/voice.schema.js'
import { principlesWikiSchema } from '../specs/wiki-types/principles.schema.js'

const inputSchema = z.object({
  fragments: z.string(),
  title: z.string(),
  date: z.string(),
  count: z.number(),
  timeline: z.string().optional(),
  people: z.string().optional(),
  existingWiki: z.string().optional(),
  edits: z.string().optional(),
  relatedWikis: z.string().optional(),
})

const schemaMap: Record<WikiType, z.ZodType> = {
  log: logWikiSchema,
  collection: collectionWikiSchema,
  belief: beliefWikiSchema,
  decision: decisionWikiSchema,
  project: projectWikiSchema,
  objective: objectiveWikiSchema,
  skill: skillWikiSchema,
  agent: agentWikiSchema,
  voice: voiceWikiSchema,
  principles: principlesWikiSchema,
}

/**
 * Override shape for loadWikiGenerationSpec.
 *
 * - `yaml`: full YAML blob (from wikiTypes.prompt). Parsed via parseSpecFromBlob;
 *   spec.system_message, spec.template, spec.temperature all come from the blob.
 * - `systemMessage`: plain text (from wikis.prompt). Disk spec is loaded; only
 *   spec.system_message is replaced — template/temperature/input_variables stay.
 *
 * In both cases, outputSchema is always code-sourced from schemaMap[type] —
 * user YAML can never change the LLM output contract.
 */
export type WikiGenerationOverride =
  | { kind: 'yaml'; blob: string }
  | { kind: 'systemMessage'; text: string }

export function loadWikiGenerationSpec(
  type: WikiType,
  vars: {
    fragments: string
    title: string
    date: string
    count: number
    timeline?: string
    people?: string
    existingWiki?: string
    edits?: string
    relatedWikis?: string
  },
  override?: WikiGenerationOverride,
): PromptResult {
  const validated = inputSchema.parse(vars)
  const diskSpec = loadSpec(`${type}.yaml`, 'wiki-types')

  // Resolve effective spec based on override shape. parseSpecFromBlob throws on
  // parse/schema failure — the caller (regen.ts) catches and falls back to disk.
  let effective: PromptSpec = diskSpec
  if (override) {
    if (override.kind === 'yaml') {
      effective = parseSpecFromBlob(override.blob)
    } else {
      // trimEnd guards against trailing whitespace subtly changing LLM behavior.
      effective = {
        ...diskSpec,
        system_message: override.text.trimEnd(),
      }
    }
  }

  const user = renderTemplate(effective.template, validated)
  return {
    system: effective.system_message,
    user,
    meta: {
      temperature: effective.temperature,
      outputSchema: schemaMap[type],
    },
  }
}
