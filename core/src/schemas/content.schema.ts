import { z } from 'zod'
import { okResponseSchema } from './base.schema.js'

// Re-export write schemas from the existing content-schemas module
export {
  VALID_TYPES,
  WRITE_SCHEMAS,
  fragmentWriteSchema,
  entryWriteSchema,
  wikiWriteSchema,
  personWriteSchema,
  type ContentType,
} from '../lib/content-schemas.js'

// ── Read response schemas ───────────────────────────────────────────────────

export const contentRawResponseSchema = z.object({
  content: z.string(),
})

export const contentStructuredResponseSchema = z.object({
  frontmatter: z.record(z.unknown()),
  body: z.string(),
  raw: z.string(),
})

// ── Write response schema ───────────────────────────────────────────────────

export { okResponseSchema as contentWriteResponseSchema }
