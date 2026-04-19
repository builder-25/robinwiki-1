import { Hono } from 'hono'
import { logger } from '../lib/logger.js'
import { loadOpenRouterConfig } from '../lib/openrouter-config.js'
import { sessionMiddleware } from '../middleware/session.js'
import type { AiModel } from '../schemas/ai-models.schema.js'

const log = logger.child({ component: 'ai-models' })

const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

let cachedModels: AiModel[] | null = null
let cacheTimestamp = 0

interface OpenRouterModel {
  id: string
  name: string
  context_length?: number
  pricing?: { prompt?: string; completion?: string }
}

async function fetchModelsFromOpenRouter(apiKey: string): Promise<AiModel[]> {
  const res = await fetch('https://openrouter.ai/api/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  })

  if (!res.ok) {
    throw new Error(`OpenRouter responded with ${res.status}: ${res.statusText}`)
  }

  const body = (await res.json()) as { data?: OpenRouterModel[] }
  const raw = body.data ?? []

  // Curated provider list — top-tier models only, keeps the UI manageable
  // without a typeahead search component.
  const CURATED_PROVIDERS = new Set([
    'anthropic',
    'openai',
    'google',
    'meta-llama',
    'mistralai',
    'qwen',
  ])

  return raw
    .filter((m) => m.id && m.name && CURATED_PROVIDERS.has(m.id.split('/')[0] ?? ''))
    .map((m) => ({
      id: m.id,
      name: m.name,
      context_length: m.context_length ?? 0,
      pricing: {
        prompt: m.pricing?.prompt ?? '0',
        completion: m.pricing?.completion ?? '0',
      },
    }))
    .sort((a, b) => {
      const providerA = a.id.split('/')[0] ?? ''
      const providerB = b.id.split('/')[0] ?? ''
      if (providerA !== providerB) return providerA.localeCompare(providerB)
      return a.name.localeCompare(b.name)
    })
}

const aiModelsRouter = new Hono()
aiModelsRouter.use('*', sessionMiddleware)

// GET /ai/models — proxy to OpenRouter models API with 1h cache
aiModelsRouter.get('/models', async (c) => {
  const now = Date.now()
  const cacheValid = cachedModels && now - cacheTimestamp < CACHE_TTL_MS

  if (cacheValid) {
    return c.json({ models: cachedModels })
  }

  let apiKey: string
  try {
    const config = await loadOpenRouterConfig()
    apiKey = config.apiKey
  } catch {
    if (cachedModels) {
      log.warn('failed to load OpenRouter key, returning stale cache')
      return c.json({ models: cachedModels })
    }
    return c.json({ error: 'OpenRouter API key not configured' }, 502)
  }

  try {
    const models = await fetchModelsFromOpenRouter(apiKey)
    cachedModels = models
    cacheTimestamp = now
    return c.json({ models })
  } catch (err) {
    log.error({ err }, 'failed to fetch models from OpenRouter')
    if (cachedModels) {
      log.warn('returning stale cache after fetch failure')
      return c.json({ models: cachedModels })
    }
    return c.json({ error: 'Failed to fetch models from OpenRouter' }, 502)
  }
})

/** Returns the cached model list (or null if never fetched). */
export function getCachedModelIds(): Set<string> | null {
  if (!cachedModels) return null
  return new Set(cachedModels.map((m) => m.id))
}

export { aiModelsRouter as aiModelsRoutes }
