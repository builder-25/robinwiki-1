// TODO(M3): restore regen pipeline. Wave 2 deleted the regen agent and
// frontmatter assembly modules; this stub keeps the type surface alive so
// callers can compile while the worker is dormant.

import type { JobResult, RegenJob, RegenBatchJob } from '@robin/queue'

export async function processRegenJob(_job: RegenJob): Promise<JobResult> {
  throw new Error('regen disabled in M2 — will be restored in M3')
}

export async function processRegenBatchJob(_job: RegenBatchJob): Promise<JobResult> {
  throw new Error('regen disabled in M2 — will be restored in M3')
}
