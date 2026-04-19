import { eq, sql } from 'drizzle-orm'
import { auth } from '../auth.js'
import { db } from '../db/client.js'
import { users } from '../db/schema.js'
import { generateDek, loadMasterKey, wrapDek } from '../lib/crypto.js'
import { logger } from '../lib/logger.js'
import { producer } from '../queue/producer.js'
import { runMigrations } from './run-migrations.js'

const log = logger.child({ component: 'jit-provision' })

// null = unchecked, true = user exists (skip all future queries)
let provisioned: boolean | null = null

/**
 * Ensure the single-user app has its one user, provisioning on first login
 * attempt if the users table is empty. After the first check confirms a user
 * exists, all subsequent calls are free (in-memory flag, zero DB queries).
 */
export async function ensureFirstUser(): Promise<void> {
  if (provisioned === true) return

  // Run any pending DB migrations before touching the users table
  await runMigrations()

  const [row] = await db.execute<{ count: number }>(sql`SELECT count(*)::int AS count FROM users`)
  const userCount = row?.count ?? 0

  if (userCount > 0) {
    provisioned = true
    log.debug('user already exists — skipping provisioning')
    return
  }

  const email = process.env.INITIAL_USERNAME
  const password = process.env.INITIAL_PASSWORD

  if (!email || !password) {
    throw new Error(
      'Users table is empty and INITIAL_USERNAME / INITIAL_PASSWORD env vars are not set — cannot provision'
    )
  }

  log.info({ email }, 'provisioning first user (JIT)')

  const masterKey = loadMasterKey()

  const response = await auth.api.signUpEmail({
    body: {
      email,
      password,
      name: email.split('@')[0] ?? 'admin',
    },
  })

  const signedUpUser = (response as { user?: { id: string } } | null)?.user
  if (!signedUpUser) {
    throw new Error('sign-up did not return a user object')
  }

  const userId = signedUpUser.id

  const dek = generateDek()
  const wrappedDek = wrapDek(dek, masterKey)

  await db
    .update(users)
    .set({
      encryptedDek: wrappedDek,
      passwordResetRequired: true,
    })
    .where(eq(users.id, userId))

  // Fire-and-forget provision job for keypair generation
  producer
    .enqueueProvision({
      type: 'provision',
      jobId: `provision-${userId}`,
      userId,
      enqueuedAt: new Date().toISOString(),
    })
    .then(() => log.info({ userId }, 'enqueued provision job for keypair generation'))
    .catch((err) => log.error({ userId, err }, 'failed to enqueue provision job'))

  provisioned = true
  log.info({ userId, email }, 'first user provisioned with DEK and password_reset_required=true')
}
