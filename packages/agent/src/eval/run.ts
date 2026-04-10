import { runExtraction } from '../stages/index'
import type { ExtractionOrchestratorDeps } from '../stages/index'
import { makeLookupKey } from '@robin/shared'
import { sampleEntries } from './fixtures/sample-entries'

// Mock deps matching the ExtractionOrchestratorDeps shape
const mockDeps: ExtractionOrchestratorDeps = {
  acquireLock: async () => ({}),
  releaseLock: async () => {},
  emitEvent: async () => {},
  db: null,
  vaultClassifyDeps: {
    listUserVaults: async () => [{ id: 'eval-vault', name: 'Eval', slug: 'eval' }],
    llmCall: async (prompt: string) => JSON.stringify({ vaultId: 'eval-vault', confidence: 1.0 }),
    confidenceThreshold: 0.5,
    fallbackVaultId: 'eval-default',
  },
  fragmentDeps: {
    llmCall: async (prompt: string) => {
      console.log(`      → fragment LLM call (${prompt.length} chars)`)
      return JSON.stringify({
        fragments: [
          {
            title: 'eval-fragment',
            slug: 'eval-fragment',
            content: prompt.slice(0, 200),
            tags: [],
            type: 'fact',
          },
        ],
        primaryTopic: 'eval',
      })
    },
    emitEvent: async () => {},
  },
  entityExtractDeps: {
    loadUserPeople: async () => [],
    llmCall: async () => JSON.stringify({ people: [] }),
    parseOutput: (raw: string) => ({ people: [] }) as any,
    emitEvent: async () => {},
    config: { aliasMatchThreshold: 0.8, nameMatchThreshold: 0.9 },
    makePeopleKey: () => makeLookupKey('person'),
  },
  persistDeps: {
    batchWrite: async (req) => {
      for (const f of (req as any).files ?? []) {
        console.log(`      → write(${f.path})`)
        console.log(`\n${'─'.repeat(60)}`)
        console.log(f.content.slice(0, 300))
        console.log('─'.repeat(60))
      }
      return { commitHash: 'eval-no-commit' }
    },
    insertEntry: async () => {},
    insertFragment: async () => {},
    insertEdge: async () => {},
    insertPerson: async () => {},
    loadPersonByKey: async () => null,
    emitEvent: async () => {},
  },
  enqueueLinkJob: async () => {},
}

console.log('Robin.OS — Agent Eval (stage pipeline)')
console.log(`Entries: ${sampleEntries.length}`)

for (const entry of sampleEntries) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`Input: "${entry.content.slice(0, 80)}..."`)
  console.log('='.repeat(60))

  const entryKey = makeLookupKey('entry')
  try {
    const result = await runExtraction(mockDeps, {
      userId: 'eval-user',
      content: entry.content,
      entryKey,
      source: entry.source,
      jobId: `eval-${Date.now()}`,
    })

    console.log(`\n✓ done — ${result.fragmentKeys.length} fragments, vault=${result.vaultId}`)
  } catch (err) {
    console.log(`\n✗ failed — ${err instanceof Error ? err.message : err}`)
  }
}
