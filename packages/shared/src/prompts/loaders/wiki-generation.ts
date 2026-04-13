import { z } from 'zod'
import { loadSpec, renderTemplate } from '../loader.js'
import type { PromptResult } from '../types.js'
import type { WikiType } from '../../types/wiki.js'
import { logWikiSchema } from '../specs/wiki-types/log.schema.js'
import { collectionWikiSchema } from '../specs/wiki-types/collection.schema.js'
import { beliefWikiSchema } from '../specs/wiki-types/belief.schema.js'
import { decisionWikiSchema } from '../specs/wiki-types/decision.schema.js'
import { projectWikiSchema } from '../specs/wiki-types/project.schema.js'
import { goalWikiSchema } from '../specs/wiki-types/goal.schema.js'
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
  goal: goalWikiSchema,
  skill: skillWikiSchema,
  agent: agentWikiSchema,
  voice: voiceWikiSchema,
  principles: principlesWikiSchema,
}

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
  }
): PromptResult {
  const validated = inputSchema.parse(vars)
  const spec = loadSpec(`${type}.yaml`, 'wiki-types')
  const user = renderTemplate(spec.template, validated)
  return {
    system: spec.system_message,
    user,
    meta: {
      temperature: spec.temperature,
      outputSchema: schemaMap[type],
    },
  }
}
