import { eq, sql } from 'drizzle-orm'
import { auth } from '../auth.js'
import { db } from '../db/client.js'
import { users } from '../db/schema.js'
import { generateDek, loadMasterKey, wrapDek } from '../lib/crypto.js'
import { logger } from '../lib/logger.js'

const log = logger.child({ component: 'seed-first-user' })

/**
 * On boot, ensure the single-user app has its one user.
 *
 * If `users` is empty AND `INITIAL_USERNAME` + `INITIAL_PASSWORD` env vars are
 * set, creates the user via better-auth's sign-up flow, then:
 *   1. Generates a fresh 32-byte DEK
 *   2. Wraps it with MASTER_KEY
 *   3. Stores the wrapped DEK on the user row
 *   4. Sets `password_reset_required = true` so the user must change password
 *      on first login
 *
 * If the users table is non-empty, this is a no-op.
 *
 * Throws on misconfiguration (missing MASTER_KEY, bad env vars) so the server
 * fails fast at boot rather than silently running unconfigured.
 */
export async function seedFirstUser(): Promise<void> {
  // Fail fast if MASTER_KEY is missing — surfaces misconfig at boot
  const masterKey = loadMasterKey()

  const [row] = await db.execute<{ count: number }>(sql`SELECT count(*)::int AS count FROM users`)
  const userCount = row?.count ?? 0

  if (userCount > 0) {
    log.debug({ userCount }, 'users already exist — skipping first-user seed')
    return
  }

  const email = process.env.INITIAL_USERNAME
  const password = process.env.INITIAL_PASSWORD

  if (!email || !password) {
    log.warn(
      'users table is empty and INITIAL_USERNAME / INITIAL_PASSWORD env vars are not set — the app has no users and no sign-ups are allowed'
    )
    return
  }

  log.info({ email }, 'seeding first user from env vars')

  // Use better-auth's sign-up API so password hashing and session creation
  // follow the same path as normal sign-up.
  const response = await auth.api.signUpEmail({
    body: {
      email,
      password,
      name: email.split('@')[0] ?? 'admin',
    },
  })

  // better-auth returns { user, token } on success
  const signedUpUser = (response as { user?: { id: string } } | null)?.user
  if (!signedUpUser) {
    throw new Error('sign-up did not return a user object')
  }

  const userId = signedUpUser.id

  // Generate and wrap the per-user DEK
  const dek = generateDek()
  const wrappedDek = wrapDek(dek, masterKey)

  await db
    .update(users)
    .set({
      encryptedDek: wrappedDek,
      passwordResetRequired: true,
    })
    .where(eq(users.id, userId))

  log.info({ userId, email }, 'first user seeded with DEK and password_reset_required=true')
}
