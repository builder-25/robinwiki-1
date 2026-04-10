import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createHmac } from 'node:crypto'

// Set env vars before importing the module
const TEST_SECRET = 'test-gateway-hmac-secret'
const TEST_URL = 'http://localhost:9000'

vi.stubEnv('GATEWAY_HMAC_SECRET', TEST_SECRET)
vi.stubEnv('GATEWAY_URL', TEST_URL)

// We need to test the signBody behaviour. Since gateway/client.ts uses module-level constants,
// we test the signing contract directly.

function computeExpectedSignature(body: string): string {
  return createHmac('sha256', TEST_SECRET).update(body).digest('hex')
}

describe('gateway client signing', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'ok' }),
      text: () => Promise.resolve('ok'),
    })
    vi.stubGlobal('fetch', fetchSpy)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('includes X-Signature header on every call', async () => {
    // Dynamically import to pick up stubbed env
    const { gatewayClient } = await import('../gateway/client')
    await gatewayClient.reindex('user1').catch(() => {})

    expect(fetchSpy).toHaveBeenCalled()
    const [, opts] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const headers = opts.headers as Record<string, string>
    expect(headers['X-Signature']).toBeTruthy()
  })

  it('signature is correct HMAC-SHA256 of body', async () => {
    const { gatewayClient } = await import('../gateway/client')
    await gatewayClient.reindex('user1').catch(() => {})

    const [, opts] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const headers = opts.headers as Record<string, string>
    const body = opts.body as string
    const expectedSig = computeExpectedSignature(body)
    expect(headers['X-Signature']).toBe(expectedSig)
  })

  it('throws Error on 4xx response', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: () => Promise.resolve('not found'),
    })

    const { gatewayClient } = await import('../gateway/client')
    await expect(gatewayClient.reindex('user1')).rejects.toThrow()
  })

  it('write returns expected shape on success', async () => {
    const mockResp = {
      path: 'var/raw/test.md',
      commitHash: 'abc123',
      timestamp: '2026-01-01T00:00:00Z',
    }
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResp),
      text: () => Promise.resolve(''),
    })

    const { gatewayClient } = await import('../gateway/client')
    const result = await gatewayClient.write({
      userId: 'user1',
      path: 'var/raw/test.md',
      content: '# Test',
      message: 'add test',
      branch: 'main',
    })

    expect(result.path).toBe('var/raw/test.md')
    expect(result.commitHash).toBe('abc123')
    expect(result.timestamp).toBeTruthy()
  })
})
