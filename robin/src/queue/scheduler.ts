/**
 * Batch regen scheduler: midnight cron job that scans for DIRTY objects.
 * Disabled when ENABLE_BATCH_REGEN=false.
 */

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
