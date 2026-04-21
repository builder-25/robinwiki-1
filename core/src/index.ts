import 'dotenv/config'
import { assertProdEnv } from './bootstrap/env.js'
import { readFileSync } from 'node:fs'
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
import { wikisRoutes } from './routes/wikis.js'
import { groupsRoutes } from './routes/groups.js'
import { fragmentsRoutes } from './routes/fragments.js'
import { peopleRoutes } from './routes/people.js'
import { graphRoutes } from './routes/graph.js'
import { relationshipsRoutes } from './routes/relationships.js'
import { contentRoutes } from './routes/content.js'
import { wikiTypesRoutes } from './routes/wiki-types.js'
import { auditRoutes } from './routes/audit.js'
import { aiPreferencesRoutes } from './routes/ai-preferences.js'
import { aiModelsRoutes } from './routes/ai-models.js'
import { publishedRoutes } from './routes/published.js'
import { previewRouter } from './routes/preview.js'
import { startWorkers } from './queue/worker.js'
import { setupRegenScheduler } from './queue/scheduler.js'
import { producer } from './queue/producer.js'
import { QUEUE_NAMES } from '@robin/queue'
import { bullBoardApp } from './routes/bull-board.js'
import { adminRoutes } from './routes/admin.js'
import { authRecoverRoutes } from './routes/auth-recover.js'
import { checkOpenRouterKey } from './bootstrap/check-openrouter-key.js'
import { ensurePgvector } from './bootstrap/ensure-pgvector.js'
import { runMigrations } from './bootstrap/run-migrations.js'
import { seedWikiTypes } from './bootstrap/seed-wiki-types.js'
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

const openapiSpec = JSON.parse(readFileSync(new URL('../openapi.json', import.meta.url), 'utf-8'))

/***********************************************************************
 * ## Pre-auth routes
 * Health, OpenAPI, internal HMAC, admin — no session middleware.
 ***********************************************************************/

app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))
app.get('/openapi.json', (c) => c.json(openapiSpec))
// M2 dormant: git-sync webhook. See import comment above.
// app.route('/internal', internalRoutes)
app.route('/admin', adminRoutes)
app.route('/auth', authRecoverRoutes)
app.route('/published', publishedRoutes)
app.route('/preview', previewRouter)
app.use('/api/auth/*', (c) => auth.handler(c.req.raw))

// BullBoard exposes queue payloads (raw user fragments), retry controls, and
// drain actions. It has no auth in front. Only mount outside production until
// issue #73 ships a proper session gate.
if (process.env.NODE_ENV !== 'production') {
  app.route('/admin/queues', bullBoardApp)
}

/***********************************************************************
 * ## Authenticated API
 ***********************************************************************/

app.route('/entries', entries)
app.route('/search', search)
app.route('/mcp', mcp)
app.route('/users', users)
app.route('/users', aiPreferencesRoutes)
app.route('/wikis', wikisRoutes)
app.route('/groups', groupsRoutes)
app.route('/fragments', fragmentsRoutes)
app.route('/people', peopleRoutes)
app.route('/graph', graphRoutes)
app.route('/relationships', relationshipsRoutes)
app.route('/api/content', contentRoutes)
app.route('/wiki-types', wikiTypesRoutes)
app.route('/audit-log', auditRoutes)
app.route('/ai', aiModelsRoutes)

/***********************************************************************
 * ## Boot
 ***********************************************************************/

// Explicit, idempotent prod-env gate. Also runs at module load (from env.ts),
// so in practice this line is a no-op — kept here to document boot order.
assertProdEnv()

// Fail fast on missing MASTER_KEY before any crypto ops run
loadMasterKey()

// Ensure pgvector exists before migrations — some tables reference the type.
// Best-effort: logs a warning and continues if the DB role lacks CREATE EXTENSION,
// so the actual migration failure surfaces as the real error.
await ensurePgvector().catch((err) => {
  logger.warn({ err }, 'ensure-pgvector failed — continuing, migrations may fail')
})

// Apply pending migrations before any code touches the schema.
// runMigrations is idempotent and safe to call on every boot.
await runMigrations().catch((err) => {
  logger.fatal({ err }, 'run-migrations failed — refusing to start')
  process.exit(1)
})

// Warn loudly if the OpenRouter key is missing — non-fatal so non-ingest traffic still works
await checkOpenRouterKey().catch((err) => {
  logger.error({ err }, 'check-openrouter-key failed')
})

// Seed wiki types from YAML on every boot (idempotent — insert / refresh / preserve).
// Runs after migrations (needs based_on_version column) and before workers
// (workers may read wiki_types rows when regenerating wikis).
await seedWikiTypes().catch((err) => {
  logger.error({ err }, 'seed-wiki-types failed — continuing startup')
})

// Single global worker — no per-user spawning under single-user M2
startWorkers()

// Start the midnight regen batch scheduler (idempotent — safe on every boot)
const schedulerQueue = producer.getQueue(QUEUE_NAMES.scheduler)
await setupRegenScheduler(schedulerQueue).catch((err) => {
  logger.warn({ err }, 'regen scheduler setup failed — batch regen disabled')
})

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
