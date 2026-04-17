import { z } from 'zod'

// ── Response schemas ────────────────────────────────────────────────────────

/** @remarks DB edges store "frag" as src/dst type; graph route normalizes to "fragment" at the API boundary. */
export const graphNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum(['wiki', 'fragment', 'person', 'entry']),
  size: z.number(),
  snippet: z.string().default(''),
})

export const graphEdgeSchema = z.object({
  source: z.string(),
  target: z.string(),
  edgeType: z.enum(['filing', 'wikilink', 'mention']),
})

export const graphResponseSchema = z.object({
  nodes: z.array(graphNodeSchema),
  edges: z.array(graphEdgeSchema),
})
