import { createHmac } from 'node:crypto'
import { Hono } from 'hono'
import type { SyncJob } from '@robin/queue'
import { producer } from '../queue/producer.js'
import { syncNotifyPayloadSchema, syncAcceptedResponseSchema } from '../schemas/internal.schema.js'

export const internalRoutes = new Hono()

internalRoutes.post('/sync-notify', async (c) => {
  const secret = process.env.GATEWAY_HMAC_SECRET
  if (!secret) {
    return c.json({ error: 'server misconfigured' }, 500)
  }

  // Read raw body for HMAC verification
  const rawBody = await c.req.text()

  // Verify HMAC signature
  const signature = c.req.header('X-Signature')
  if (!signature) {
    return c.json({ error: 'missing signature' }, 401)
  }

  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  if (signature !== expected) {
    return c.json({ error: 'invalid signature' }, 401)
  }

  // Parse and validate payload
  let rawJson: unknown
  try {
    rawJson = JSON.parse(rawBody)
  } catch {
    return c.json({ error: 'invalid JSON' }, 400)
  }

  const parsed = syncNotifyPayloadSchema.safeParse(rawJson)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', fields: parsed.error.flatten() }, 400)
  }

  const payload = parsed.data

  // Enqueue sync job
  const syncJob: SyncJob = {
    type: 'sync',
    jobId: crypto.randomUUID(),
    userId: payload.userId,
    commitHash: payload.commitHash,
    files: payload.files as SyncJob['files'],
    enqueuedAt: new Date().toISOString(),
  }

  await producer.enqueueSyncJob(payload.userId, syncJob)

  return c.json(syncAcceptedResponseSchema.parse({ status: 'accepted' }), 202)
})
