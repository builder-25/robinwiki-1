import { Hono } from 'hono'
import { eq, and, isNull, sql } from 'drizzle-orm'
import { sessionMiddleware } from '../middleware/session.js'
import { db } from '../db/client.js'
import {
  users,
  apiKeys,
  fragments,
  threads,
  people,
  vaults,
  auditLog,
  entries,
  edges,
  configNotes,
} from '../db/schema.js'
import { decryptPrivateKey } from '../keypair.js'
import { signMcpToken } from '../mcp/jwt.js'
import {
  userProfileResponseSchema,
  userStatsResponseSchema,
  userActivityResponseSchema,
  keypairResponseSchema,
  mcpEndpointResponseSchema,
  exportDataResponseSchema,
} from '../schemas/users.schema.js'
import { okResponseSchema } from '../schemas/base.schema.js'

const usersRouter = new Hono()
usersRouter.use('*', sessionMiddleware)

// GET /users/profile
usersRouter.get('/profile', async (c) => {
  const userId = c.get('userId') as string
  const [user] = await db.select().from(users).where(eq(users.id, userId))

  if (!user) return c.json({ error: 'User not found' }, 404)

  // Get API key hint if any
  const [key] = await db.select().from(apiKeys).where(eq(apiKeys.userId, userId))

  const mcpToken = await signMcpToken(user.id).catch(() => null)
  const appUrl = process.env.APP_URL ?? 'http://localhost:3000'

  return c.json(
    userProfileResponseSchema.parse({
      id: user.id,
      email: user.email,
      name: user.name,
      mcpEndpointUrl: mcpToken ? `${appUrl}/mcp?token=${mcpToken}` : '',
      apiKeyHint: key?.hint ?? '',
      onboardedAt: user.onboardedAt?.toISOString() ?? null,
    })
  )
})

// PATCH /users/onboard — mark onboarding complete (skip button)
usersRouter.patch('/onboard', async (c) => {
  const userId = c.get('userId') as string
  await db
    .update(users)
    .set({ onboardedAt: new Date() })
    .where(and(eq(users.id, userId), isNull(users.onboardedAt)))
  return c.json(okResponseSchema.parse({ ok: true }))
})

// GET /users/keypair
usersRouter.get('/keypair', async (c) => {
  const userId = c.get('userId') as string
  const [user] = await db
    .select({
      publicKey: users.publicKey,
      encryptedPrivateKey: users.encryptedPrivateKey,
    })
    .from(users)
    .where(eq(users.id, userId))

  if (!user || !user.publicKey || !user.encryptedPrivateKey) {
    return c.json({ error: 'No keypair found' }, 404)
  }

  const encryptionSecret = process.env.KEY_ENCRYPTION_SECRET ?? ''
  const privateKeyDer = decryptPrivateKey(user.encryptedPrivateKey, encryptionSecret)

  return c.json(
    keypairResponseSchema.parse({
      algorithm: 'Ed25519',
      publicKey: user.publicKey,
      privateKey: privateKeyDer.toString('hex'),
    })
  )
})

// GET /users/stats
// TODO(phase-5): update stats to use edges for vault scoping (unthreadedCount now computed)
usersRouter.get('/stats', async (c) => {
  const userId = c.get('userId') as string

  const [[noteCount], [threadCount], [personCount], [unthreadedCountResult]] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(fragments).where(eq(fragments.userId, userId)),
    db.select({ count: sql<number>`count(*)` }).from(threads).where(eq(threads.userId, userId)),
    db.select({ count: sql<number>`count(*)` }).from(people).where(eq(people.userId, userId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(fragments)
      .where(
        and(
          eq(fragments.userId, userId),
          sql`${fragments.lookupKey} NOT IN (
            SELECT src_id FROM edges
            WHERE user_id = ${userId}
            AND edge_type = 'FRAGMENT_IN_THREAD'
            AND deleted_at IS NULL
          )`
        )
      ),
  ])

  return c.json(
    userStatsResponseSchema.parse({
      totalNotes: Number(noteCount?.count ?? 0),
      totalThreads: Number(threadCount?.count ?? 0),
      peopleCount: Number(personCount?.count ?? 0),
      unthreadedCount: Number(unthreadedCountResult?.count ?? 0),
      lastSync: new Date().toISOString(),
    })
  )
})

// GET /users/activity
usersRouter.get('/activity', async (c) => {
  const userId = c.get('userId') as string

  const rows = await db
    .select()
    .from(auditLog)
    .where(eq(auditLog.userId, userId))
    .orderBy(sql`${auditLog.createdAt} DESC`)
    .limit(20)

  return c.json(
    userActivityResponseSchema.parse({
      activity: rows.map((r) => ({
        action: r.operation,
        time: r.createdAt?.toISOString() ?? '',
      })),
    })
  )
})

// POST /users/export — export all user data as JSON
usersRouter.post('/export', async (c) => {
  const userId = c.get('userId') as string

  const [userVaults, userThreads, userFragments, userPeople] = await Promise.all([
    db.select().from(vaults).where(eq(vaults.userId, userId)),
    db.select().from(threads).where(eq(threads.userId, userId)),
    db.select().from(fragments).where(eq(fragments.userId, userId)),
    db.select().from(people).where(eq(people.userId, userId)),
  ])

  return c.json(
    exportDataResponseSchema.parse({
      exportedAt: new Date().toISOString(),
      vaults: userVaults,
      threads: userThreads,
      fragments: userFragments,
      people: userPeople,
    })
  )
})

// DELETE /users/data — delete all user content (keeps account intact)
usersRouter.delete('/data', async (c) => {
  const userId = c.get('userId') as string

  await Promise.all([
    db.delete(edges).where(eq(edges.userId, userId)),
    db.delete(entries).where(eq(entries.userId, userId)),
    db.delete(threads).where(eq(threads.userId, userId)),
    db.delete(people).where(eq(people.userId, userId)),
    db.delete(vaults).where(eq(vaults.userId, userId)),
    db.delete(configNotes).where(eq(configNotes.userId, userId)),
    db.delete(auditLog).where(eq(auditLog.userId, userId)),
  ])

  return c.json(okResponseSchema.parse({ ok: true }))
})

// POST /users/regenerate-mcp — bump token version, return new MCP URL
usersRouter.post('/regenerate-mcp', async (c) => {
  const userId = c.get('userId') as string
  await db
    .update(users)
    .set({ mcpTokenVersion: sql`${users.mcpTokenVersion} + 1` })
    .where(eq(users.id, userId))
  const mcpToken = await signMcpToken(userId)
  if (!mcpToken) return c.json({ error: 'No keypair — sign out and back in to generate one' }, 400)
  const appUrl = process.env.APP_URL ?? 'http://localhost:3000'
  return c.json(
    mcpEndpointResponseSchema.parse({ mcpEndpointUrl: `${appUrl}/mcp?token=${mcpToken}` })
  )
})

// DELETE /users/account — delete user entirely
usersRouter.delete('/account', async (c) => {
  const userId = c.get('userId') as string
  await db.delete(users).where(eq(users.id, userId))
  return c.json(okResponseSchema.parse({ ok: true }))
})

export { usersRouter as users }
