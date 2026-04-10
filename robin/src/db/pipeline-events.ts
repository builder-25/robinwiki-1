import { lt, and, eq, or, sql } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { pipelineEvents } from './schema.js'

interface EmitEventParams {
  entryKey: string
  jobId: string
  stage: string
  status: 'started' | 'completed' | 'failed'
  fragmentKey?: string
  metadata?: Record<string, unknown>
}

export async function emitPipelineEvent(
  db: PostgresJsDatabase,
  params: EmitEventParams
): Promise<void> {
  await db.insert(pipelineEvents).values({
    id: crypto.randomUUID(),
    entryKey: params.entryKey,
    jobId: params.jobId,
    stage: params.stage,
    status: params.status,
    fragmentKey: params.fragmentKey ?? null,
    metadata: params.metadata ?? null,
  })
}

interface PruneOptions {
  successDays?: number
  failureDays?: number
}

export async function prunePipelineEvents(
  db: PostgresJsDatabase,
  options: PruneOptions = {}
): Promise<number> {
  const successDays = options.successDays ?? 30
  const failureDays = options.failureDays ?? 90

  const result = await db
    .delete(pipelineEvents)
    .where(
      or(
        and(
          eq(pipelineEvents.status, 'completed'),
          lt(pipelineEvents.createdAt, sql`NOW() - INTERVAL '${sql.raw(String(successDays))} days'`)
        ),
        and(
          eq(pipelineEvents.status, 'failed'),
          lt(pipelineEvents.createdAt, sql`NOW() - INTERVAL '${sql.raw(String(failureDays))} days'`)
        )
      )
    )
    .returning({ id: pipelineEvents.id })

  return result.length
}
