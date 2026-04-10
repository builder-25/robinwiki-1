import { createHmac } from 'node:crypto'
import type { SearchResult } from '@robin/shared'
import { logger } from '../lib/logger.js'

const log = logger.child({ component: 'gateway' })

const GATEWAY_URL = process.env.GATEWAY_URL ?? 'http://localhost:9000'
const HMAC_SECRET = (() => {
  const s = process.env.GATEWAY_HMAC_SECRET
  if (!s) throw new Error('GATEWAY_HMAC_SECRET env var is required')
  return s
})()

function signBody(body: string): string {
  return createHmac('sha256', HMAC_SECRET).update(body).digest('hex')
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const bodyStr = JSON.stringify(body)
  log.debug({ path, body }, 'POST')

  const res = await fetch(`${GATEWAY_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Signature': signBody(bodyStr),
    },
    body: bodyStr,
  })

  if (!res.ok) {
    const text = await res.text()
    log.debug({ path, status: res.status, text }, 'POST failed')
    throw new Error(`Gateway ${path} failed (${res.status}): ${text}`)
  }

  const data = (await res.json()) as T
  log.debug({ path, status: res.status }, 'POST ok')
  return data
}

export const gatewayClient = {
  provision: (userId: string, publicKey: string) =>
    post<{ status: string; userId: string }>('/provision', {
      userId,
      publicKey,
    }),

  write: (req: {
    userId: string
    path: string
    content: string
    message: string
    branch: string
    batch?: boolean
  }) => post<{ path: string; commitHash: string; timestamp: string }>('/write', req),

  search: (userId: string, query: string, limit = 10, minScore?: number, repoPaths?: string[]) =>
    post<{ results: SearchResult[]; count: number }>('/search', {
      userId,
      query,
      limit,
      ...(minScore != null && minScore > 0 ? { minScore } : {}),
      ...(repoPaths && repoPaths.length > 0 ? { repoPaths } : {}),
    }),

  read: (userId: string, path: string) =>
    post<{ path: string; content: string; commitHash: string }>('/read', {
      userId,
      path,
    }),

  reindex: (userId: string) => post<{ status: string }>('/reindex', { userId }),

  batchWrite: (req: {
    userId: string
    files: Array<{ path: string; content: string }>
    message: string
    branch: string
  }) => post<{ commitHash: string; fileCount: number; timestamp: string }>('/batch-write', req),
}
