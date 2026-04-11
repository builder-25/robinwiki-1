// TODO(M3): re-enable midnight regen batch scheduler. Dormant in M2 — the
// extraction/link path no longer touches regen, so there is nothing to schedule.

import type { Queue } from '@robin/queue'
import { logger } from '../lib/logger.js'

const log = logger.child({ component: 'scheduler' })

export async function setupRegenScheduler(_queue: Queue): Promise<void> {
  log.info('regen scheduler dormant in M2 — skipping setup')
}
