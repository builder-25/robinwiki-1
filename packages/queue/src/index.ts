import { Queue, Worker, type Job } from 'bullmq'
import { Redis } from 'ioredis'
import type { WriteJobPayload, ReindexJobPayload } from '@robin/shared'

export { Queue, Worker } from 'bullmq'

// ── Redis connection ──────────────────────────────────────────────────────────

export function createRedisConnection(): Redis {
  return new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: null, // required for BullMQ blocked commands
  })
}

// ── Queue name helpers ────────────────────────────────────────────────────────

export const QUEUE_NAMES = {
  write: (userId: string) => `write-queue-${userId}`,
  reindex: (userId: string) => `reindex-queue-${userId}`,
  provision: 'provision-queue',
  scheduler: 'regen-scheduler-queue',
  dlq: 'write-dlq',
} as const

// ── Retry config ──────────────────────────────────────────────────────────────

export const RETRY_CONFIG = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 2000, // 2s base → 2s, 4s, 8s
  },
} as const

export const LINK_RETRY_CONFIG = {
  attempts: 5,
  backoff: {
    type: 'exponential' as const,
    delay: 5000, // 5s base → 5s, 10s, 20s, 40s, 80s
  },
} as const

// ── Job types ─────────────────────────────────────────────────────────────────

export interface WriteJob {
  type: 'write'
  jobId: string
  userId: string
  enqueuedAt: string
  payload: WriteJobPayload
}

export interface ReindexJob {
  type: 'reindex'
  jobId: string
  userId: string
  enqueuedAt: string
  scope: 'full' | 'collection'
}

export interface ProvisionJob {
  type: 'provision'
  jobId: string
  userId: string
  enqueuedAt: string
}

export interface ExtractionJob {
  type: 'extraction'
  jobId: string
  userId: string
  enqueuedAt: string
  content: string
  entryKey: string
  userSelectedVaultId: string | null
  source: string
}

export interface LinkJob {
  type: 'link'
  jobId: string
  userId: string
  fragmentKey: string
  entryKey: string
  vaultId: string
  fragmentContent: string
  enqueuedAt: string
}

export interface ReclassifyJob {
  type: 'reclassify'
  jobId: string
  userId: string
  wikiKey: string
  vaultId: string
  enqueuedAt: string
}

export interface SyncJob {
  type: 'sync'
  jobId: string
  userId: string
  commitHash: string
  enqueuedAt: string
  files: Array<{
    path: string
    operation: 'add' | 'modify' | 'delete'
    content: string
    frontmatterHash?: string
    bodyHash?: string
    contentHash?: string
  }>
}

export interface RegenJob {
  type: 'regen'
  jobId: string
  userId: string
  objectKey: string
  objectType: 'wiki' | 'person'
  triggeredBy: 'scheduler' | 'manual'
  enqueuedAt: string
}

export interface RegenBatchJob {
  type: 'regen-batch'
  jobId: string
  triggeredBy: 'scheduler'
  enqueuedAt: string
}

export type RobinJob =
  | WriteJob
  | ReindexJob
  | ProvisionJob
  | ExtractionJob
  | LinkJob
  | ReclassifyJob
  | SyncJob
  | RegenJob
  | RegenBatchJob

export interface JobResult {
  jobId: string
  success: boolean
  path?: string
  commitHash?: string
  error?: string
  processedAt: string
}

// ── QueueProducer interface ───────────────────────────────────────────────────

export interface QueueProducer {
  enqueueWrite(userId: string, job: WriteJob): Promise<string>
  enqueueReindex(userId: string, job: ReindexJob): Promise<string>
  enqueueProvision(job: ProvisionJob): Promise<string>
  enqueueExtraction(userId: string, job: ExtractionJob): Promise<string>
  enqueueLinkJob(userId: string, job: LinkJob): Promise<string>
  enqueueReclassify(userId: string, job: ReclassifyJob): Promise<string>
  enqueueSyncJob(userId: string, job: SyncJob): Promise<string>
  enqueueRegenJob(userId: string, job: RegenJob): Promise<string>
  getQueue(name: string): Queue
  close(): Promise<void>
}

// ── QueueWorker interface ─────────────────────────────────────────────────────

export interface QueueWorker {
  startWriteWorker(userId: string, processor: (job: WriteJob) => Promise<JobResult>): Worker
  startReindexWorker(userId: string, processor: (job: ReindexJob) => Promise<JobResult>): Worker
  startProvisionWorker(processor: (job: ProvisionJob) => Promise<JobResult>): Worker
}

// ── BullMQ implementation ─────────────────────────────────────────────────────

export class BullMQProducer implements QueueProducer {
  private readonly connection: Redis
  private readonly queues = new Map<string, Queue>()

  constructor(connection?: Redis) {
    this.connection = connection ?? createRedisConnection()
  }

  getQueue(name: string): Queue {
    let q = this.queues.get(name)
    if (!q) {
      q = new Queue(name, {
        connection: this.connection,
        defaultJobOptions: {
          ...RETRY_CONFIG,
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 500 },
        },
      })
      this.queues.set(name, q)
    }
    return q
  }

  async enqueueWrite(userId: string, job: WriteJob): Promise<string> {
    const queue = this.getQueue(QUEUE_NAMES.write(userId))
    const bullJob = await queue.add('write', job, { jobId: job.jobId })
    return bullJob.id ?? job.jobId
  }

  async enqueueReindex(userId: string, job: ReindexJob): Promise<string> {
    const queue = this.getQueue(QUEUE_NAMES.reindex(userId))
    const bullJob = await queue.add('reindex', job, {
      jobId: job.jobId,
      ...RETRY_CONFIG,
    })
    return bullJob.id ?? job.jobId
  }

  async enqueueProvision(job: ProvisionJob): Promise<string> {
    const queue = this.getQueue(QUEUE_NAMES.provision)
    const bullJob = await queue.add('provision', job, { jobId: job.jobId })
    return bullJob.id ?? job.jobId
  }

  async enqueueExtraction(userId: string, job: ExtractionJob): Promise<string> {
    const queue = this.getQueue(QUEUE_NAMES.write(userId))
    const bullJob = await queue.add('extraction', job, { jobId: job.jobId })
    return bullJob.id ?? job.jobId
  }

  async enqueueLinkJob(userId: string, job: LinkJob): Promise<string> {
    const queue = this.getQueue(QUEUE_NAMES.write(userId))
    const bullJob = await queue.add('link', job, {
      jobId: job.jobId,
      ...LINK_RETRY_CONFIG,
    })
    return bullJob.id ?? job.jobId
  }

  async enqueueReclassify(userId: string, job: ReclassifyJob): Promise<string> {
    const queue = this.getQueue(QUEUE_NAMES.write(userId))
    const bullJob = await queue.add('reclassify', job, { jobId: job.jobId })
    return bullJob.id ?? job.jobId
  }

  async enqueueSyncJob(userId: string, job: SyncJob): Promise<string> {
    const queue = this.getQueue(QUEUE_NAMES.write(userId))
    const bullJob = await queue.add('sync', job, { jobId: job.jobId })
    return bullJob.id ?? job.jobId
  }

  async enqueueRegenJob(userId: string, job: RegenJob): Promise<string> {
    const queue = this.getQueue(QUEUE_NAMES.write(userId))
    const bullJob = await queue.add('regen', job, { jobId: job.jobId })
    return bullJob.id ?? job.jobId
  }

  async close(): Promise<void> {
    await Promise.all([...this.queues.values()].map((q) => q.close()))
    await this.connection.quit()
  }
}

export class BullMQWorker implements QueueWorker {
  private readonly connection: Redis

  constructor(connection?: Redis) {
    this.connection = connection ?? createRedisConnection()
  }

  startWriteWorker(userId: string, processor: (job: WriteJob) => Promise<JobResult>): Worker {
    return new Worker(
      QUEUE_NAMES.write(userId),
      async (job: Job<WriteJob>) => {
        return processor(job.data)
      },
      {
        connection: this.connection,
        concurrency: 1, // FIFO per user
        autorun: true,
      }
    )
  }

  startReindexWorker(userId: string, processor: (job: ReindexJob) => Promise<JobResult>): Worker {
    return new Worker(
      QUEUE_NAMES.reindex(userId),
      async (job: Job<ReindexJob>) => {
        return processor(job.data)
      },
      {
        connection: this.connection,
        concurrency: 1, // heavy op, one at a time
        autorun: true,
      }
    )
  }

  startProvisionWorker(processor: (job: ProvisionJob) => Promise<JobResult>): Worker {
    return new Worker(
      QUEUE_NAMES.provision,
      async (job: Job<ProvisionJob>) => {
        return processor(job.data)
      },
      {
        connection: this.connection,
        concurrency: 1,
        autorun: true,
      }
    )
  }
}
