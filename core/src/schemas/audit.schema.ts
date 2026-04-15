import { z } from 'zod'

export const auditEventSchema = z.object({
  id: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  eventType: z.string(),
  source: z.string().nullable(),
  summary: z.string(),
  detail: z.any().nullable(),
  createdAt: z.string(),
})

export const auditLogResponseSchema = z.object({
  events: z.array(auditEventSchema),
  total: z.number(),
})

export const auditLogQuerySchema = z.object({
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  eventType: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export const timelineQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})
