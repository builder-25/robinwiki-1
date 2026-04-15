import { Hono } from 'hono'
import { eq, and, gte, lte, sql } from 'drizzle-orm'
import { sessionMiddleware } from '../middleware/session.js'
import { db } from '../db/client.js'
import { auditLog } from '../db/schema.js'
import { auditLogResponseSchema, auditLogQuerySchema } from '../schemas/audit.schema.js'

const auditRoutes = new Hono()
auditRoutes.use('*', sessionMiddleware)

auditRoutes.get('/', async (c) => {
  const query = auditLogQuerySchema.safeParse({
    entityType: c.req.query('entityType'),
    entityId: c.req.query('entityId'),
    eventType: c.req.query('eventType'),
    from: c.req.query('from'),
    to: c.req.query('to'),
    limit: c.req.query('limit'),
    offset: c.req.query('offset'),
  })

  const params = query.success ? query.data : { limit: 50, offset: 0 }

  const conditions = []
  if (params.entityType) conditions.push(eq(auditLog.entityType, params.entityType))
  if (params.entityId) conditions.push(eq(auditLog.entityId, params.entityId))
  if (params.eventType) conditions.push(eq(auditLog.eventType, params.eventType))
  if (params.from) conditions.push(gte(auditLog.createdAt, new Date(params.from)))
  if (params.to) conditions.push(lte(auditLog.createdAt, new Date(params.to)))

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const [events, countResult] = await Promise.all([
    db
      .select()
      .from(auditLog)
      .where(where)
      .orderBy(sql`${auditLog.createdAt} DESC`)
      .limit(params.limit)
      .offset(params.offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(auditLog)
      .where(where),
  ])

  return c.json(
    auditLogResponseSchema.parse({
      events: events.map((e) => ({
        ...e,
        createdAt: e.createdAt.toISOString(),
      })),
      total: Number(countResult[0]?.count ?? 0),
    })
  )
})

export { auditRoutes }
