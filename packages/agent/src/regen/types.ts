/**
 * Dependency interface for regen processing.
 * The server injects concrete implementations (DB, gateway, locking).
 */
export interface RegenDeps {
  loadThread: (key: string) => Promise<{
    lookupKey: string
    name: string
    type: string
    slug: string
    repoPath: string
    prompt: string
    vaultId: string | null
  } | null>

  loadFragmentContents: (
    wikiKey: string
  ) => Promise<Array<{ lookupKey: string; content: string }>>

  loadPersonWithFragments: (personKey: string) => Promise<{
    person: {
      lookupKey: string
      name: string
      slug: string
      repoPath: string
      sections: Record<string, unknown>
    }
    fragments: Array<{ lookupKey: string; content: string }>
  } | null>

  acquireLock: (table: string, key: string, jobId: string, fromState: string) => Promise<boolean>

  releaseLock: (table: string, key: string, toState: string) => Promise<void>

  canRebuildThread: (wikiKey: string) => Promise<boolean>

  batchWrite: (req: {
    userId: string
    files: Array<{ path: string; content: string }>
    message: string
    branch: string
  }) => Promise<void>

  updateAfterRegen: (table: string, key: string, repoPath: string) => Promise<void>
}
