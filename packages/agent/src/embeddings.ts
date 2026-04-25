export interface EmbedConfig {
  apiKey: string
  model: string
}

/**
 * Structured failure description emitted by `embedText` on the `null`
 * return path. Consumers that want observable failure (logging,
 * boot-time reachability probing) read this via the `lastEmbedFailure`
 * accessor below. Kept separate so `embedText` can stay logger-free
 * and dependency-free — core (which owns pino) wraps observability on
 * top.
 */
export type EmbedFailure =
  | { kind: 'http'; status: number; body: string }
  | { kind: 'malformed'; body: string }
  | { kind: 'threw'; message: string }

let _lastEmbedFailure: EmbedFailure | null = null

/** Read-then-clear the most recent embedText failure, if any. */
export function takeLastEmbedFailure(): EmbedFailure | null {
  const v = _lastEmbedFailure
  _lastEmbedFailure = null
  return v
}

/**
 * Best-effort OpenRouter embedding call.
 * Returns null on any failure (network, 4xx, 5xx, malformed response).
 * Caller should leave the `embedding` column NULL and proceed; call
 * `takeLastEmbedFailure()` immediately after to capture structured
 * failure context (status, body, message) for logging or bootstrap
 * reachability checks.
 */
export async function embedText(
  text: string,
  config: EmbedConfig
): Promise<number[] | null> {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: config.model, input: text }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      _lastEmbedFailure = { kind: 'http', status: res.status, body: body.slice(0, 500) }
      console.error(
        `[embeddings] request failed status=${res.status} body=${body.slice(0, 200)}`
      )
      return null
    }
    const parsed = (await res.json()) as { data?: Array<{ embedding?: number[] }> }
    const vec = parsed.data?.[0]?.embedding
    if (!vec || !Array.isArray(vec)) {
      _lastEmbedFailure = { kind: 'malformed', body: JSON.stringify(parsed).slice(0, 500) }
      console.error('[embeddings] response malformed', parsed)
      return null
    }
    return vec
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    _lastEmbedFailure = { kind: 'threw', message }
    console.error('[embeddings] request threw', err)
    return null
  }
}

/**
 * Boot-time reachability probe. Issues a tiny embedding request and
 * reports whether it succeeded; caller decides what to do (refuse to
 * start workers, log loudly, etc). Returns structured failure context
 * rather than throwing so the boot path stays deterministic.
 */
export async function probeEmbeddingReachable(
  config: EmbedConfig
): Promise<{ ok: true } | { ok: false; failure: EmbedFailure }> {
  const vec = await embedText('ping', config)
  if (vec && vec.length > 0) return { ok: true }
  const failure = takeLastEmbedFailure() ?? {
    kind: 'malformed',
    body: 'no failure context',
  }
  return { ok: false, failure }
}
