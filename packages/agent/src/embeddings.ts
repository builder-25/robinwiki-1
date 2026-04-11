export interface EmbedConfig {
  apiKey: string
  model: string
}

/**
 * Best-effort OpenRouter embedding call.
 * Returns null on any failure (network, 4xx, 5xx, malformed response).
 * Caller should leave the `embedding` column NULL and proceed.
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
      console.warn(`[embeddings] request failed: ${res.status}`)
      return null
    }
    const body = (await res.json()) as { data?: Array<{ embedding?: number[] }> }
    const vec = body.data?.[0]?.embedding
    if (!vec || !Array.isArray(vec)) {
      console.warn('[embeddings] response malformed')
      return null
    }
    return vec
  } catch (err) {
    console.warn('[embeddings] request threw', err)
    return null
  }
}
