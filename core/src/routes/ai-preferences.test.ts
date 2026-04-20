import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockGetConfig = vi.fn()
const mockSetConfig = vi.fn().mockResolvedValue(undefined)

vi.mock('../lib/config.js', () => ({
  getConfig: (...args: unknown[]) => mockGetConfig(...args),
  setConfig: (...args: unknown[]) => mockSetConfig(...args),
}))

vi.mock('../middleware/session.js', () => ({
  sessionMiddleware: vi.fn(async (c: any, next: any) => {
    c.set('userId', 'test-user-1')
    await next()
  }),
}))

// Mock DB for configs table queries used by GET/PUT /preferences/models
const mockDbSelect = vi.fn()
const mockDbFrom = vi.fn()
const mockDbWhere = vi.fn()

vi.mock('../db/client.js', () => ({
  db: {
    select: (...args: unknown[]) => {
      mockDbSelect(...args)
      return {
        from: (...fArgs: unknown[]) => {
          mockDbFrom(...fArgs)
          return {
            where: (...wArgs: unknown[]) => {
              return mockDbWhere(...wArgs)
            },
          }
        },
      }
    },
  },
}))

vi.mock('../db/schema.js', () => ({
  configs: {
    scope: 'scope',
    kind: 'kind',
    key: 'key',
    value: 'value',
  },
}))

// Mock openrouter-config exports
vi.mock('../lib/openrouter-config.js', () => ({
  SAFE_EMBEDDING_MODELS: ['openai/text-embedding-3-small', 'qwen/qwen3-embedding-8b'],
  MODEL_DEFAULTS: {
    extraction: 'anthropic/claude-sonnet-4.6',
    classification: 'anthropic/claude-sonnet-4.6',
    wiki_generation: 'anthropic/claude-sonnet-4.6',
    embedding: 'openai/text-embedding-3-small',
  },
}))

// Mock getCachedModelIds
const mockGetCachedModelIds = vi.fn().mockReturnValue(null)
vi.mock('./ai-models.js', () => ({
  getCachedModelIds: (...args: unknown[]) => mockGetCachedModelIds(...args),
}))

// ── Import under test (after mocks) ────────────────────────────────────────

const { aiPreferencesRoutes } = await import('./ai-preferences.js')

const app = new Hono()
app.route('/users', aiPreferencesRoutes)

// ── Helpers ─────────────────────────────────────────────────────────────────

async function putJson(path: string, body: unknown) {
  return app.request(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('GET /users/preferences/ai', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns hasOpenRouterKey:true when env key exists', async () => {
    const orig = process.env.OPENROUTER_API_KEY
    process.env.OPENROUTER_API_KEY = 'sk-or-test'
    mockGetConfig.mockResolvedValue(null)

    const res = await app.request('/users/preferences/ai')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      hasOpenRouterKey: true,
      modelPreference: null,
    })
    process.env.OPENROUTER_API_KEY = orig
  })

  it('returns the model preference when set', async () => {
    mockGetConfig.mockImplementation(async (opts: any) => {
      if (opts.kind === 'model_preference') return 'anthropic/claude-3.5-sonnet'
      return null
    })

    const res = await app.request('/users/preferences/ai')

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.modelPreference).toBe('anthropic/claude-3.5-sonnet')
  })
})

describe('GET /users/preferences/models', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns defaults when no DB rows exist', async () => {
    mockDbWhere.mockResolvedValue([])

    const res = await app.request('/users/preferences/models')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      extraction: 'anthropic/claude-sonnet-4.6',
      classification: 'anthropic/claude-sonnet-4.6',
      wikiGeneration: 'anthropic/claude-sonnet-4.6',
      embedding: 'openai/text-embedding-3-small',
    })
  })

  it('returns DB values merged with defaults', async () => {
    mockDbWhere.mockResolvedValue([
      { key: 'extraction', value: 'google/gemini-2.5-pro' },
    ])

    const res = await app.request('/users/preferences/models')

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.extraction).toBe('google/gemini-2.5-pro')
    expect(json.classification).toBe('anthropic/claude-sonnet-4.6')
  })
})

describe('PUT /users/preferences/models', () => {
  beforeEach(() => vi.clearAllMocks())

  it('saves a valid model preference and returns ok', async () => {
    const res = await putJson('/users/preferences/models', {
      extraction: 'google/gemini-2.5-pro',
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(mockSetConfig).toHaveBeenCalledWith({
      scope: 'system',
      kind: 'model_preference',
      key: 'extraction',
      value: 'google/gemini-2.5-pro',
      encrypted: false,
    })
  })

  it('rejects unsafe embedding models with 400', async () => {
    const res = await putJson('/users/preferences/models', {
      embedding: 'openai/text-embedding-3-large',
    })

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Invalid embedding model')
    expect(mockSetConfig).not.toHaveBeenCalled()
  })

  it('accepts safe embedding models', async () => {
    const res = await putJson('/users/preferences/models', {
      embedding: 'openai/text-embedding-3-small',
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(mockSetConfig).toHaveBeenCalledWith({
      scope: 'system',
      kind: 'model_preference',
      key: 'embedding',
      value: 'openai/text-embedding-3-small',
      encrypted: false,
    })
  })

  it('rejects unknown chat models when cache is available', async () => {
    mockGetCachedModelIds.mockReturnValue(new Set(['anthropic/claude-sonnet-4.6', 'google/gemini-2.5-pro']))

    const res = await putJson('/users/preferences/models', {
      extraction: 'fake/nonexistent-model',
    })

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Unknown model')
    expect(mockSetConfig).not.toHaveBeenCalled()
  })

  it('accepts any non-empty chat model when cache is not available', async () => {
    mockGetCachedModelIds.mockReturnValue(null)

    const res = await putJson('/users/preferences/models', {
      classification: 'some-provider/some-model',
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('returns 400 for empty string values', async () => {
    const res = await putJson('/users/preferences/models', {
      extraction: '',
    })

    expect(res.status).toBe(400)
    expect(mockSetConfig).not.toHaveBeenCalled()
  })
})

describe('PUT /users/prompts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('saves prompt overrides and returns ok', async () => {
    const body = { extraction: 'custom extraction prompt', wikiClassify: 'custom classify' }
    const res = await putJson('/users/prompts', body)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(mockSetConfig).toHaveBeenCalledOnce()
    expect(mockSetConfig).toHaveBeenCalledWith({
      scope: 'user',
      userId: 'test-user-1',
      kind: 'user_prompts',
      key: 'overrides',
      value: body,
      encrypted: false,
    })
  })

  it('accepts empty object (all fields optional)', async () => {
    const res = await putJson('/users/prompts', {})

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(mockSetConfig).toHaveBeenCalledOnce()
  })
})

describe('GET /users/prompts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns stored prompts when overrides exist', async () => {
    mockGetConfig.mockResolvedValue({
      extraction: 'my extraction',
      wikiClassify: 'my classify',
      wikiGeneration: 'my generation',
    })

    const res = await app.request('/users/prompts')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      extraction: 'my extraction',
      wikiClassify: 'my classify',
      wikiGeneration: 'my generation',
    })
  })

  it('returns all-null defaults when no overrides exist', async () => {
    mockGetConfig.mockResolvedValue(null)

    const res = await app.request('/users/prompts')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      extraction: null,
      wikiClassify: null,
      wikiGeneration: null,
    })
  })
})
