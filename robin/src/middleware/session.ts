import type { MiddlewareHandler } from 'hono'
import { auth } from '../auth.js'

// Attach better-auth session to Hono context
export const sessionMiddleware: MiddlewareHandler = async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) return c.json({ error: 'Unauthorized' }, 401)
  c.set('userId', session.user.id)
  c.set('user', session.user)
  await next()
}
