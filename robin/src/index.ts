import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { load as loadYaml } from 'js-yaml'
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { cors } from 'hono/cors'
import { httpLogger } from './middleware/httpLogger.js'
import { logger } from './lib/logger.js'
import { auth } from './auth.js'
import { entries } from './routes/entries.js'
import { search } from './routes/search.js'
import { mcp } from './routes/mcp.js'
import { users } from './routes/users.js'
import { vaultsRoutes } from './routes/vaults.js'
import { threadsRoutes } from './routes/threads.js'
import { fragmentsRoutes } from './routes/fragments.js'
import { peopleRoutes } from './routes/people.js'
import { graphRoutes } from './routes/graph.js'
import { relationshipsRoutes } from './routes/relationships.js'
import { robinRoutes } from './routes/robin.js'
import { contentRoutes } from './routes/content.js'
import { internalRoutes } from './routes/internal.js'
import { startWorkers } from './queue/worker.js'
import { bullBoardApp } from './routes/bull-board.js'
import { adminRoutes } from './routes/admin.js'

declare module 'hono' {
  interface ContextVariableMap {
    userId: string
    user: unknown
  }
}

/***********************************************************************
 * ## Process guards
 * Registered first so nothing escapes, even during startup.
 ***********************************************************************/

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'unhandledRejection')
  process.exit(1)
})

process.on('uncaughtException', (err) => {
  logger.error({ err }, 'uncaughtException')
  process.exit(1)
})

process.once('SIGINT', () => process.exit(0))
process.once('SIGTERM', () => process.exit(0))

/***********************************************************************
 * ## Hono app
 ***********************************************************************/

const app = new Hono()

app.use('*', httpLogger())
app.use(
  '*',
  cors({
    origin: (origin) => origin,
    credentials: true,
  })
)

/** @step — Global error handler: catch JSON parse failures and return 400 */
app.onError((err, c) => {
  if (err instanceof SyntaxError && err.message.includes('JSON')) {
    return c.json({ error: 'Invalid JSON' }, 400)
  }
  // @hono/zod-validator wraps malformed JSON as HTTPException, not SyntaxError
  if (err.message === 'Malformed JSON in request body') {
    return c.json({ error: 'Invalid JSON' }, 400)
  }
  logger.error({ err }, 'unhandled route error')
  return c.json({ error: 'Internal server error' }, 500)
})

const openapiSpec = loadYaml(readFileSync(new URL('../openapi.yaml', import.meta.url), 'utf-8'))

/***********************************************************************
 * ## Pre-auth routes
 * Health, OpenAPI, internal HMAC, admin — no session middleware.
 ***********************************************************************/

app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))
app.get('/openapi.json', (c) => c.json(openapiSpec))
app.route('/internal', internalRoutes)
app.route('/admin', adminRoutes)
app.use('/api/auth/*', (c) => auth.handler(c.req.raw))
app.route('/admin/queues', bullBoardApp)

/***********************************************************************
 * ## Authenticated API
 ***********************************************************************/

app.route('/entries', entries)
app.route('/search', search)
app.route('/mcp', mcp)
app.route('/users', users)
app.route('/vaults', vaultsRoutes)
app.route('/threads', threadsRoutes)
app.route('/fragments', fragmentsRoutes)
app.route('/people', peopleRoutes)
app.route('/graph', graphRoutes)
app.route('/relationships', relationshipsRoutes)
app.route('/robin', robinRoutes)
app.route('/api/content', contentRoutes)

/***********************************************************************
 * ## Boot
 ***********************************************************************/

startWorkers()

const port = Number.parseInt(process.env.PORT ?? '3000', 10)
const server = serve({ fetch: app.fetch, port }, () => {
  logger.info({ port }, 'server started')
})

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    logger.fatal(
      { port },
      `port ${port} already in use — kill the stale process or pick another port`
    )
  } else {
    logger.fatal({ err }, 'server failed to start')
  }
  process.exit(1)
})
