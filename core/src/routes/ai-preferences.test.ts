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

// ── Import under test (after mocks) ────────────────────────────────────────

const { aiPreferencesRoutes } = await import('./ai-preferences.js')

const app = new Hono()
app.route('/users', aiPreferencesRoutes)

// ── Helpers ─────────────────────────────────────────────────────────────────

async function postJson(path: string, body: unknown) {
  return app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function putJson(path: string, body: unknown) {
  return app.request(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('POST /users/preferences/ai', () => {
  beforeEach(() => vi.clearAllMocks())

  it('saves an OpenRouter key encrypted and returns ok', async () => {
    const res = await postJson('/users/preferences/ai', { openRouterKey: 'sk-or-test-abc123' })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(mockSetConfig).toHaveBeenCalledOnce()
    expect(mockSetConfig).toHaveBeenCalledWith({
      scope: 'user',
      userId: 'test-user-1',
      kind: 'llm_key',
      key: 'openrouter',
      value: 'sk-or-test-abc123',
      encrypted: true,
    })
  })

  it('returns 400 when openRouterKey is missing', async () => {
    const res = await postJson('/users/preferences/ai', {})

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Validation failed')
    expect(mockSetConfig).not.toHaveBeenCalled()
  })

  it('returns 400 when openRouterKey is empty', async () => {
    const res = await postJson('/users/preferences/ai', { openRouterKey: '' })

    expect(res.status).toBe(400)
    expect(mockSetConfig).not.toHaveBeenCalled()
  })
})

describe('GET /users/preferences/ai', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns hasOpenRouterKey:true when key exists', async () => {
    mockGetConfig.mockImplementation(async (opts: any) => {
      if (opts.kind === 'llm_key') return 'sk-or-decrypted'
      if (opts.kind === 'model_preference') return null
      return null
    })

    const res = await app.request('/users/preferences/ai')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      hasOpenRouterKey: true,
      modelPreference: null,
    })
  })

  it('returns hasOpenRouterKey:false when no key exists', async () => {
    mockGetConfig.mockResolvedValue(null)

    const res = await app.request('/users/preferences/ai')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      hasOpenRouterKey: false,
      modelPreference: null,
    })
  })

  it('returns the model preference when set', async () => {
    mockGetConfig.mockImplementation(async (opts: any) => {
      if (opts.kind === 'llm_key') return 'sk-or-key'
      if (opts.kind === 'model_preference') return 'anthropic/claude-3.5-sonnet'
      return null
    })

    const res = await app.request('/users/preferences/ai')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      hasOpenRouterKey: true,
      modelPreference: 'anthropic/claude-3.5-sonnet',
    })
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
