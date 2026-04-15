import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { load as loadYaml } from 'js-yaml'
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { cors } from 'hono/cors'
import { httpLogger } from './middleware/http-logger.js'
import { logger } from './lib/logger.js'
import { auth } from './auth.js'
import { entries } from './routes/entries.js'
import { search } from './routes/search.js'
import { mcp } from './routes/mcp.js'
import { users } from './routes/users.js'
import { vaultsRoutes } from './routes/vaults.js'
import { wikisRoutes } from './routes/wikis.js'
import { fragmentsRoutes } from './routes/fragments.js'
import { peopleRoutes } from './routes/people.js'
import { graphRoutes } from './routes/graph.js'
import { relationshipsRoutes } from './routes/relationships.js'
import { contentRoutes } from './routes/content.js'
import { wikiTypesRoutes } from './routes/wiki-types.js'
import { auditRoutes } from './routes/audit.js'
import { publishedRoutes } from './routes/published.js'
// M2 dormant: internalRoutes is the git-sync webhook, preserved verbatim in
// src/routes/internal.ts for M3/M4 refinement. Gateway is gone in M2 so the
// route is not mounted. Restore when sync-back lands.
// import { internalRoutes } from './routes/internal.js'
import { startWorkers } from './queue/worker.js'
import { bullBoardApp } from './routes/bull-board.js'
import { adminRoutes } from './routes/admin.js'
import { seedFirstUser } from './bootstrap/seed-first-user.js'
import { checkOpenRouterKey } from './bootstrap/check-openrouter-key.js'
import { loadMasterKey } from './lib/crypto.js'

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
// M2 dormant: git-sync webhook. See import comment above.
// app.route('/internal', internalRoutes)
app.route('/admin', adminRoutes)
app.route('/published', publishedRoutes)
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
app.route('/wikis', wikisRoutes)
app.route('/fragments', fragmentsRoutes)
app.route('/people', peopleRoutes)
app.route('/graph', graphRoutes)
app.route('/relationships', relationshipsRoutes)
app.route('/api/content', contentRoutes)
app.route('/wiki-types', wikiTypesRoutes)
app.route('/audit-log', auditRoutes)

/***********************************************************************
 * ## Boot
 ***********************************************************************/

// Fail fast on missing MASTER_KEY before any crypto ops run
loadMasterKey()

// Seed the single user from INITIAL_USERNAME/INITIAL_PASSWORD if users table is empty
await seedFirstUser().catch((err) => {
  logger.fatal({ err }, 'seed-first-user failed')
  process.exit(1)
})

// Warn loudly if the OpenRouter key is missing — non-fatal so non-ingest traffic still works
await checkOpenRouterKey().catch((err) => {
  logger.error({ err }, 'check-openrouter-key failed')
})

// Single global worker — no per-user spawning under single-user M2
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
