import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import { db } from '../db/client.js'
import { wikis } from '../db/schema.js'
import { publicWikiResponseSchema } from '../schemas/wikis.schema.js'

const publishedRoutes = new Hono()

publishedRoutes.get('/wiki/:nanoid', async (c) => {
  const nanoid = c.req.param('nanoid')

  const [wiki] = await db
    .select({
      name: wikis.name,
      type: wikis.type,
      publishedAt: wikis.publishedAt,
      content: wikis.content,
      published: wikis.published,
    })
    .from(wikis)
    .where(and(eq(wikis.publishedSlug, nanoid), eq(wikis.published, true)))
    .limit(1)

  if (!wiki || !wiki.content) {
    return c.json({ error: 'Not found' }, 404)
  }

  c.header('Cache-Control', 'no-store')

  if (c.req.query('raw') !== undefined) {
    return c.text(wiki.content)
  }

  return c.json(
    publicWikiResponseSchema.parse({
      name: wiki.name,
      type: wiki.type,
      publishedAt: wiki.publishedAt,
      content: wiki.content,
    })
  )
})

export { publishedRoutes }
