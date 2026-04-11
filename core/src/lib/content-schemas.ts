import { z } from 'zod'

// ── Content Types ───────────────────────────────────────────────────────────

export const VALID_TYPES = ['fragment', 'entry', 'wiki', 'person'] as const
export type ContentType = (typeof VALID_TYPES)[number]

// ── Per-type Write Schemas ──────────────────────────────────────────────────

export const fragmentWriteSchema = z.object({
  frontmatter: z
    .object({
      title: z.string().min(1),
      tags: z.array(z.string()).default([]),
      vaultId: z.string().optional(),
      wikiKeys: z.array(z.string()).default([]),
      personKeys: z.array(z.string()).default([]),
      relatedFragmentKeys: z.array(z.string()).default([]),
    })
    .strip(),
  body: z.string(),
})

export const entryWriteSchema = z.object({
  frontmatter: z
    .object({
      title: z.string().min(1),
      tags: z.array(z.string()).default([]),
    })
    .strip(),
  // body is ignored for entries (read-only after ingestion)
})

export const wikiWriteSchema = z.object({
  frontmatter: z
    .object({
      name: z.string().min(1),
      type: z.string().optional(),
      prompt: z.string().optional(),
      vaultId: z.string().optional(),
    })
    .strip(),
  body: z.string(),
})

export const personWriteSchema = z.object({
  frontmatter: z
    .object({
      name: z.string().min(1),
      relationship: z.string().optional(),
      aliases: z.array(z.string()).default([]),
    })
    .strip(),
  body: z.string(),
})

// ── Schema Map ──────────────────────────────────────────────────────────────

export const WRITE_SCHEMAS: Record<ContentType, z.ZodType> = {
  fragment: fragmentWriteSchema,
  entry: entryWriteSchema,
  wiki: wikiWriteSchema,
  person: personWriteSchema,
}
