import { basename } from 'node:path'
import type { SyncJob, JobResult } from '@robin/queue'
import { parseFilename } from '@robin/shared'
import {
  upsertObject,
  getObjectByKey,
  syncEdgesFromFrontmatter,
  cascadeDirtyDownstream,
  softDeleteObject,
} from '../db/sync.js'
import { emitPipelineEvent } from '../db/pipeline-events.js'
import { db } from '../db/client.js'
import { parseFrontmatter as parseFm } from '../lib/frontmatter.js'

/** Valid directories for sync processing */
const VALID_DIRS = new Set(['entries', 'fragments', 'wikis', 'people'])

export async function processSyncJob(job: SyncJob): Promise<JobResult> {
  let processedCount = 0
  let skippedCount = 0
  let errorCount = 0

  for (const file of job.files) {
    try {
      // Check directory is valid
      const dir = file.path.split('/')[0]
      if (!VALID_DIRS.has(dir)) continue

      // Handle delete operation
      if (file.operation === 'delete') {
        const filename = basename(file.path)
        let lookupKey: string
        try {
          const parsed = parseFilename(filename)
          lookupKey = `${parsed.type}${parsed.ulid}`
        } catch {
          // Try to extract key from path for deletions even with unusual filenames
          await emitPipelineEvent(db as any, {
            entryKey: file.path,
            jobId: job.jobId,
            stage: 'sync',
            status: 'failed',
            metadata: {
              error: `Cannot parse filename for deletion: ${filename}`,
              path: file.path,
            },
          })
          skippedCount++
          continue
        }
        await softDeleteObject(db as any, lookupKey)
        processedCount++
        continue
      }

      // Parse filename
      const filename = basename(file.path)
      let parsed: ReturnType<typeof parseFilename>
      try {
        parsed = parseFilename(filename)
      } catch {
        await emitPipelineEvent(db as any, {
          entryKey: file.path,
          jobId: job.jobId,
          stage: 'sync',
          status: 'failed',
          metadata: {
            error: `Invalid filename format: ${filename}`,
            path: file.path,
          },
        })
        skippedCount++
        continue
      }

      const lookupKey = `${parsed.type}${parsed.ulid}`

      // Check existing object for skip/change detection
      const existing = await getObjectByKey(db as any, lookupKey)

      if (existing && existing.contentHash === file.contentHash) {
        // No change — skip
        continue
      }

      // Determine if body changed (for DIRTY cascade)
      const bodyChanged = existing != null && existing.bodyHash !== file.bodyHash

      // Parse frontmatter before upsert (needed for fragment entryId FK)
      const frontmatter = parseFm(file.content).frontmatter

      // Upsert object
      await upsertObject(db as any, {
        lookupKey,
        userId: job.userId,
        type: parsed.type,
        slug: parsed.slug,
        repoPath: file.path,
        frontmatterHash: file.frontmatterHash,
        bodyHash: file.bodyHash,
        contentHash: file.contentHash,
        entryId: parsed.type === 'frag' ? (frontmatter.entryKey as string) : undefined,
      })
      await syncEdgesFromFrontmatter(db as any, {
        userId: job.userId,
        lookupKey,
        type: parsed.type,
        frontmatter,
      })

      // Cascade DIRTY if body changed on a fragment
      if (bodyChanged && parsed.type === 'frag') {
        await cascadeDirtyDownstream(db as any, lookupKey)
      }

      processedCount++
    } catch (err) {
      errorCount++
      try {
        await emitPipelineEvent(db as any, {
          entryKey: file.path,
          jobId: job.jobId,
          stage: 'sync',
          status: 'failed',
          metadata: {
            error: err instanceof Error ? err.message : String(err),
            path: file.path,
          },
        })
      } catch {
        // Logging failure shouldn't crash the job
      }
    }
  }

  return {
    jobId: job.jobId,
    success: errorCount === 0,
    processedAt: new Date().toISOString(),
  }
}
