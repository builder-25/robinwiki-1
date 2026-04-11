import type { MiddlewareHandler } from 'hono'
import { auth } from '../auth.js'

// Attach better-auth session to Hono context.
// Note: post-M2 single-user collapse, route handlers no longer use `userId`
// for filtering domain queries — it remains on context only for auth checks
// (e.g. mutating the user row, signing MCP tokens, crypto envelope reads).
export const sessionMiddleware: MiddlewareHandler = async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) return c.json({ error: 'Unauthorized' }, 401)
  c.set('userId', session.user.id)
  c.set('user', session.user)
  await next()
}
