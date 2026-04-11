/**
 * Regen processor: thread wiki regeneration + person body synthesis.
 * Runs in the agent package with injected deps from the server.
 * All LLM calls go through Mastra agents.
 */

import { parseLookupKey, composeFilename, TYPE_TO_DIR } from '@robin/shared'
import type { RegenDeps } from './types.js'
import { wikiGenerateCall } from '../agents/wiki-generator.js'
import { personSynthesizeCall } from '../agents/person-synthesizer.js'
import { regenerateWiki } from '../wiki.js'
import { assembleThreadFrontmatter, assemblePersonFrontmatter } from '../frontmatter.js'
import { synthesizePersonBody } from '../person-body.js'

interface RegenJob {
  type: 'regen'
  jobId: string
  userId: string
  objectKey: string
  objectType: 'wiki' | 'person'
  triggeredBy: string
  enqueuedAt: string
}

interface JobResult {
  jobId: string
  success: boolean
  error?: string
  processedAt: string
}

// ── Thread Regen ────────────────────────────────────────────────────────────

async function regenWiki(deps: RegenDeps, job: RegenJob): Promise<JobResult> {
  const { objectKey, userId, jobId } = job

  const locked = await deps.acquireLock('wikis', objectKey, jobId, 'DIRTY')
  if (!locked) {
    return {
      jobId,
      success: true,
      error: 'skipped: could not acquire lock',
      processedAt: new Date().toISOString(),
    }
  }

  try {
    // Skip the pending-fragment guard for manual triggers — user wants regen now
    if (job.triggeredBy !== 'manual') {
      const canRegen = await deps.canRebuildThread(objectKey)
      if (!canRegen) {
        await deps.releaseLock('wikis', objectKey, 'DIRTY')
        return {
          jobId,
          success: true,
          error: 'skipped: blocked by pending/linking fragments',
          processedAt: new Date().toISOString(),
        }
      }
    }

    const thread = await deps.loadThread(objectKey)
    if (!thread) {
      await deps.releaseLock('wikis', objectKey, 'DIRTY')
      return {
        jobId,
        success: false,
        error: 'thread not found',
        processedAt: new Date().toISOString(),
      }
    }

    const fragRows = await deps.loadFragmentContents(objectKey)
    const fragmentContents = fragRows.map((r) => r.content).filter(Boolean)
    const fragmentKeys = fragRows.map((r) => r.lookupKey)

    const body = await regenerateWiki(
      thread.lookupKey,
      thread.type ?? 'log',
      fragmentContents,
      '', // model param unused — model is baked into the Mastra agent
      wikiGenerateCall,
      thread.prompt ?? ''
    )

    const frontmatter = assembleThreadFrontmatter({
      type: thread.type ?? 'log',
      state: 'RESOLVED',
      ...(thread.vaultId && { vaultId: thread.vaultId }),
      name: thread.name,
      prompt: thread.prompt ?? '',
      fragmentKeys,
      fragmentCount: fragmentKeys.length,
      lastRebuiltAt: new Date().toISOString(),
      wikiLinks: [],
      brokenLinks: [],
    })

    const repoPath =
      thread.repoPath ||
      (() => {
        const { type, ulid } = parseLookupKey(objectKey)
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
        const filename = composeFilename({ date: today, slug: thread.slug, type, ulid })
        return `${TYPE_TO_DIR[type]}/${filename}`
      })()
    await deps.batchWrite({
      userId,
      files: [{ path: repoPath, content: `${frontmatter}\n${body}` }],
      message: `regen: rebuild thread ${thread.name}`,
      branch: 'main',
    })

    await deps.updateAfterRegen('wikis', objectKey, repoPath)

    return { jobId, success: true, processedAt: new Date().toISOString() }
  } catch (err) {
    await deps.releaseLock('wikis', objectKey, 'DIRTY')
    throw err
  }
}

// ── Person Regen ────────────────────────────────────────────────────────────

async function regenPerson(deps: RegenDeps, job: RegenJob): Promise<JobResult> {
  const { objectKey, userId, jobId } = job

  const locked = await deps.acquireLock('people', objectKey, jobId, 'DIRTY')
  if (!locked) {
    return {
      jobId,
      success: true,
      error: 'skipped: could not acquire lock',
      processedAt: new Date().toISOString(),
    }
  }

  try {
    const result = await deps.loadPersonWithFragments(objectKey)
    if (!result) {
      await deps.releaseLock('people', objectKey, 'DIRTY')
      return {
        jobId,
        success: false,
        error: 'person not found',
        processedAt: new Date().toISOString(),
      }
    }

    const { person, fragments: fragRows } = result
    const fragmentContents = fragRows.map((r) => r.content).filter(Boolean)
    const fragmentKeys = fragRows.map((r) => r.lookupKey)

    const sections = person.sections ?? {}
    const aliases: string[] = (sections.aliases as string[]) ?? []
    const body = await synthesizePersonBody({
      canonicalName: person.name,
      aliases,
      existingBody: '',
      fragmentContents,
      llm: personSynthesizeCall,
    })

    const frontmatter = assemblePersonFrontmatter({
      type: 'person',
      state: 'RESOLVED',
      verified: false,
      canonicalName: person.name,
      aliases,
      fragmentKeys,
      lastRebuiltAt: new Date().toISOString(),
      wikiLinks: [],
      brokenLinks: [],
    })

    const repoPath =
      person.repoPath ||
      (() => {
        const { type, ulid } = parseLookupKey(objectKey)
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
        const filename = composeFilename({ date: today, slug: person.slug, type, ulid })
        return `${TYPE_TO_DIR[type]}/${filename}`
      })()
    await deps.batchWrite({
      userId,
      files: [{ path: repoPath, content: `${frontmatter}\n${body}` }],
      message: `regen: rebuild person ${person.name}`,
      branch: 'main',
    })

    await deps.updateAfterRegen('people', objectKey, repoPath)

    return { jobId, success: true, processedAt: new Date().toISOString() }
  } catch (err) {
    await deps.releaseLock('people', objectKey, 'DIRTY')
    throw err
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function processRegenJob(deps: RegenDeps, job: RegenJob): Promise<JobResult> {
  return job.objectType === 'wiki' ? regenWiki(deps, job) : regenPerson(deps, job)
}
