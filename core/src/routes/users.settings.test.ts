import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks (must come before dynamic import) ────────────────────────────────

const mockGetConfig = vi.fn()
const mockSetConfig = vi.fn().mockResolvedValue(undefined)
const mockEmitAuditEvent = vi.fn().mockResolvedValue(undefined)

vi.mock('../db/client.js', () => ({ db: {} }))

vi.mock('../db/audit.js', () => ({
  emitAuditEvent: (...args: unknown[]) => mockEmitAuditEvent(...args),
}))

vi.mock('../lib/config.js', () => ({
  getConfig: (...args: unknown[]) => mockGetConfig(...args),
  setConfig: (...args: unknown[]) => mockSetConfig(...args),
}))

vi.mock('../middleware/session.js', () => ({
  sessionMiddleware: vi.fn().mockImplementation(async (c: any, next: any) => {
    c.set('userId', 'test-user')
    await next()
  }),
}))

vi.mock('../keypair.js', () => ({ decryptPrivateKey: vi.fn() }))
vi.mock('../mcp/jwt.js', () => ({ signMcpToken: vi.fn().mockResolvedValue('mock-token') }))

// ── Import under test ──────────────────────────────────────────────────────

const { users } = await import('./users.js')

// ── Helpers ────────────────────────────────────────────────────────────────

function get(path: string) {
  return users.request(path, { method: 'GET' })
}

function put(path: string, body: unknown) {
  return users.request(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const VALID_SETTINGS = {
  notifications: { email: false, push: true },
  privacy: { publicProfile: true },
  theme: 'dark' as const,
}

const DEFAULTS = {
  notifications: { email: true, push: true },
  privacy: { publicProfile: false },
  theme: 'system',
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('GET /settings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns defaults when no config row exists', async () => {
    mockGetConfig.mockResolvedValue(null)
    const res = await get('/settings')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(DEFAULTS)
  })

  it('returns persisted settings after a PUT', async () => {
    mockGetConfig.mockResolvedValue(VALID_SETTINGS)
    const res = await get('/settings')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(VALID_SETTINGS)
  })
})

describe('PUT /settings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('persists valid settings and returns ok', async () => {
    const res = await put('/settings', VALID_SETTINGS)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(mockSetConfig).toHaveBeenCalledWith({
      scope: 'user',
      userId: 'test-user',
      kind: 'user_settings',
      key: 'default',
      value: VALID_SETTINGS,
    })
  })

  it('rejects invalid theme with 400', async () => {
    const res = await put('/settings', {
      notifications: { email: true, push: true },
      privacy: { publicProfile: false },
      theme: 'purple',
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Validation failed')
  })

  it('emits audit event with correct params', async () => {
    await put('/settings', VALID_SETTINGS)
    expect(mockEmitAuditEvent).toHaveBeenCalledOnce()
    expect(mockEmitAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        entityType: 'user_settings',
        entityId: 'test-user',
        eventType: 'updated',
        source: 'api',
      }),
    )
  })
})
