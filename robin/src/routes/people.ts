import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import type { RegenJob } from '@robin/queue'
import { sessionMiddleware } from '../middleware/session.js'
import { db } from '../db/client.js'
import { people } from '../db/schema.js'
import { producer } from '../queue/producer.js'
import { logger } from '../lib/logger.js'
import {
  personResponseSchema,
  personWithBacklinksResponseSchema,
  personListResponseSchema,
} from '../schemas/people.schema.js'
import { queuedResponseSchema } from '../schemas/base.schema.js'

const log = logger.child({ component: 'people' })

const peopleRouter = new Hono()
peopleRouter.use('*', sessionMiddleware)

// GET /people — list all people for the user
peopleRouter.get('/', async (c) => {
  const userId = c.get('userId') as string

  const rows = await db.select().from(people).where(eq(people.userId, userId)).orderBy(people.name)

  return c.json(
    personListResponseSchema.parse({ people: rows.map((r) => ({ ...r, id: r.lookupKey })) })
  )
})

// GET /people/:id — get person with backlinks
// TODO(phase-6): query backlinks via edges table (FRAGMENT_MENTIONS_PERSON)
peopleRouter.get('/:id', async (c) => {
  const userId = c.get('userId') as string
  const id = c.req.param('id')

  const [person] = await db.select().from(people).where(eq(people.lookupKey, id))
  if (!person || person.userId !== userId) return c.json({ error: 'Not found' }, 404)

  // TODO(phase-6): query via edges table instead of fragmentPeople junction
  const backlinkFragmentIds: string[] = []
  const backlinkThreadIds: string[] = []

  return c.json(
    personWithBacklinksResponseSchema.parse({
      ...person,
      id: person.lookupKey,
      backlinkFragmentIds,
      backlinkThreadIds,
    })
  )
})

// POST /people/:id/regenerate -- manually trigger person body regen
peopleRouter.post('/:id/regenerate', async (c) => {
  const userId = c.get('userId') as string
  const id = c.req.param('id')
  const [person] = await db.select().from(people).where(eq(people.lookupKey, id))
  if (!person || person.userId !== userId) return c.json({ error: 'Not found' }, 404)

  const jobId = crypto.randomUUID()
  const regenJob: RegenJob = {
    type: 'regen',
    jobId,
    userId,
    objectKey: person.lookupKey,
    objectType: 'person',
    triggeredBy: 'manual',
    enqueuedAt: new Date().toISOString(),
  }
  await producer.enqueueRegenJob(userId, regenJob)
  log.info({ personKey: person.lookupKey }, 'enqueued regen job')

  return c.json(queuedResponseSchema.parse({ status: 'queued', jobId }), 202)
})

export { peopleRouter as peopleRoutes }
