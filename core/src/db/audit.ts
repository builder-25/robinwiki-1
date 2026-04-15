import type { DB } from './client.js'
import { auditLog } from './schema.js'
import { nanoid } from '../lib/id.js'
import { logger } from '../lib/logger.js'

const log = logger.child({ component: 'audit' })

export interface AuditEventParams {
  entityType: string
  entityId: string
  eventType: string
  source?: string
  summary: string
  detail?: Record<string, unknown>
}

export async function emitAuditEvent(
  db: DB,
  params: AuditEventParams
): Promise<void> {
  try {
    await db.insert(auditLog).values({
      id: nanoid(),
      entityType: params.entityType,
      entityId: params.entityId,
      eventType: params.eventType,
      source: params.source ?? null,
      summary: params.summary,
      detail: params.detail ?? null,
    })
  } catch (err) {
    log.warn({ err, ...params }, 'audit event emit failed')
  }
}
