import { z } from 'zod'

export const EdgeType = z.enum([
  'ENTRY_HAS_FRAGMENT',
  'FRAGMENT_IN_THREAD',
  'FRAGMENT_MENTIONS_PERSON',
  'FRAGMENT_RELATED_TO_FRAGMENT',
  'ENTRY_IN_VAULT',
])

export type EdgeType = z.infer<typeof EdgeType>
