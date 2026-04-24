import type { Queue } from '@robin/queue'
import { logger } from '../lib/logger.js'

const log = logger.child({ component: 'scheduler' })

/**
 * Set up the midnight regen batch scheduler using BullMQ's upsertJobScheduler.
 * If ENABLE_BATCH_REGEN is explicitly 'false', this is a no-op.
 */
export async function setupRegenScheduler(queue: Queue): Promise<void> {
  if (process.env.ENABLE_BATCH_REGEN === 'false') {
    log.info('ENABLE_BATCH_REGEN=false, skipping scheduler setup')
    return
  }

  await queue.upsertJobScheduler(
    'midnight-regen',
    { pattern: '0 0 * * *' },
    {
      name: 'regen-batch',
      data: {
        type: 'regen-batch',
        jobId: 'midnight-regen-scheduled',
        triggeredBy: 'scheduler',
        enqueuedAt: new Date().toISOString(),
      },
    }
  )

  log.info('midnight regen batch scheduler registered')
}

/**
 * Register the embedding-retry scheduler. Runs every 15 minutes, retries a
 * bounded batch of fragments whose embedding column is still NULL. Rides on
 * the same BullMQ queue as the regen scheduler — the scheduler worker
 * dispatches by job.type.
 */
export async function setupEmbeddingRetryScheduler(queue: Queue): Promise<void> {
  if (process.env.ENABLE_EMBEDDING_RETRY === 'false') {
    log.info('ENABLE_EMBEDDING_RETRY=false, skipping scheduler setup')
    return
  }

  await queue.upsertJobScheduler(
    'embedding-retry',
    { pattern: '*/15 * * * *' },
    {
      name: 'embedding-retry',
      data: {
        type: 'embedding-retry',
        jobId: 'embedding-retry-scheduled',
        triggeredBy: 'scheduler',
        enqueuedAt: new Date().toISOString(),
      },
    }
  )

  log.info('embedding retry scheduler registered')
}
