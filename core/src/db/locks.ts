import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { CasLock } from '@robin/caslock'
import { db } from './client.js'
import { entries, fragments } from './schema.js'
import { logger } from '../lib/logger.js'

const lockLog = logger.child({ component: 'caslock' })

// CasLock types against node-postgres; we run postgres-js. Both support
// `.execute(sql)` with identical row shapes, so a structural cast is safe.
const lockDb = db as unknown as NodePgDatabase<any>

export const entryLock = new CasLock({
  db: lockDb,
  table: entries,
  keyColumn: 'lookup_key',
  stateColumn: 'state',
  lockedByColumn: 'locked_by',
  lockedAtColumn: 'locked_at',
  lockTtlMs: 60_000,
})

export const fragmentLock = new CasLock({
  db: lockDb,
  table: fragments,
  keyColumn: 'lookup_key',
  stateColumn: 'state',
  lockedByColumn: 'locked_by',
  lockedAtColumn: 'locked_at',
  lockTtlMs: 60_000,
})

for (const lock of [entryLock, fragmentLock]) {
  lock.on('acquired', (e) => lockLog.debug(e, 'lock acquired'))
  lock.on('stolen', (e) => lockLog.warn(e, 'stole expired lock'))
  lock.on('contended', (e) => lockLog.debug(e, 'lock contended'))
  lock.on('released', (e) => lockLog.debug(e, 'lock released'))
  lock.on('renewed', (e) => lockLog.debug(e, 'lock renewed'))
  lock.on('renewFailed', (e) => lockLog.warn(e, 'lock renew failed'))
  lock.on('error', (err) => lockLog.error({ err }, 'lock error'))
}
