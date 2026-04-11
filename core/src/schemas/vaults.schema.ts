import { z } from 'zod'

// ── Response schemas ────────────────────────────────────────────────────────

export const vaultResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  icon: z.string(),
  description: z.string(),
  profile: z.string().nullable(),
  color: z.string(),
  type: z.enum(['user', 'system', 'inbox']),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  threadCount: z.number().default(0),
  noteCount: z.number().default(0),
})

export const vaultListResponseSchema = z.object({
  vaults: z.array(vaultResponseSchema),
})

// ── Request schemas ─────────────────────────────────────────────────────────

export const createVaultBodySchema = z.object({
  name: z.string().min(1, 'name is required'),
  icon: z.string().optional(),
  description: z.string().optional(),
  color: z.string().optional(),
})

export const updateVaultBodySchema = z.object({
  name: z.string().optional(),
  icon: z.string().optional(),
  description: z.string().optional(),
  profile: z.string().optional(),
  color: z.string().optional(),
})

export const updateVaultProfileBodySchema = z.object({
  profile: z.string(),
})
