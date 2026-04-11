import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { sessionMiddleware } from '../middleware/session.js'
import { db } from '../db/client.js'
import { people } from '../db/schema.js'
import { logger } from '../lib/logger.js'
import {
  personWithBacklinksResponseSchema,
  personListResponseSchema,
} from '../schemas/people.schema.js'

const log = logger.child({ component: 'people' })

const peopleRouter = new Hono()
peopleRouter.use('*', sessionMiddleware)

// GET /people — list all people
peopleRouter.get('/', async (c) => {
  const rows = await db.select().from(people).orderBy(people.name)

  return c.json(
    personListResponseSchema.parse({ people: rows.map((r) => ({ ...r, id: r.lookupKey })) })
  )
})

// GET /people/:id — get person with backlinks
// TODO(phase-6): query backlinks via edges table (FRAGMENT_MENTIONS_PERSON)
peopleRouter.get('/:id', async (c) => {
  const id = c.req.param('id')

  const [person] = await db.select().from(people).where(eq(people.lookupKey, id))
  if (!person) return c.json({ error: 'Not found' }, 404)

  // TODO(phase-6): query via edges table
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

// POST /people/:id/regenerate — manual person body regen
// TODO(M3): regen worker is dormant in M2. Restore when regen pipeline lands.
peopleRouter.post('/:id/regenerate', async (c) => {
  log.warn('person regen requested but disabled in M2')
  return c.json({ error: 'Person regen disabled in M2 — will be restored in M3' }, 503)
})

export { peopleRouter as peopleRoutes }
