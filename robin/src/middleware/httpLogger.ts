import { createMiddleware } from 'hono/factory'
import { logger } from '../lib/logger.js'

const log = logger.child({ component: 'http' })

export function httpLogger() {
  return createMiddleware(async (c, next) => {
    const start = performance.now()
    const method = c.req.method
    const path = c.req.path

    await next()

    const status = c.res.status
    const ms = (performance.now() - start).toFixed(0)
    const logFn = status >= 500 ? log.error : status >= 400 ? log.warn : log.info
    logFn.call(log, { method, path, status, ms: Number(ms) }, `${method} ${path} ${status}`)
  })
}
