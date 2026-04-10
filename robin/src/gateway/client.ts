import type { SearchResult } from '@robin/shared'
import { logger } from '../lib/logger.js'

const log = logger.child({ component: 'gateway' })

export const gatewayClient = {
  provision: async (_userId: string, _publicKey: string) => {
    log.debug('gateway facade: provision (no-op)')
    return { status: 'stub', userId: _userId }
  },

  write: async (_req: {
    userId: string
    path: string
    content: string
    message: string
    branch: string
    batch?: boolean
  }) => {
    log.debug('gateway facade: write (no-op)')
    return { path: _req.path, commitHash: 'stub', timestamp: new Date().toISOString() }
  },

  search: async (
    _userId: string,
    _query: string,
    _limit = 10,
    _minScore?: number,
    _repoPaths?: string[],
  ) => {
    log.debug('gateway facade: search (no-op)')
    return { results: [] as SearchResult[], count: 0 }
  },

  read: async (_userId: string, _path: string) => {
    log.debug('gateway facade: read (no-op)')
    return { path: _path, content: '', commitHash: 'stub' }
  },

  reindex: async (_userId: string) => {
    log.debug('gateway facade: reindex (no-op)')
    return { status: 'stub' }
  },

  batchWrite: async (_req: {
    userId: string
    files: Array<{ path: string; content: string }>
    message: string
    branch: string
  }) => {
    log.debug('gateway facade: batchWrite (no-op)')
    return {
      commitHash: 'stub',
      fileCount: _req.files.length,
      timestamp: new Date().toISOString(),
    }
  },
}
