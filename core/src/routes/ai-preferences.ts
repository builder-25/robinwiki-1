import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { sessionMiddleware } from '../middleware/session.js'
import { getConfig, setConfig } from '../lib/config.js'
import { validationHook } from '../lib/validation.js'
import { okResponseSchema } from '../schemas/base.schema.js'
import {
  saveAiPreferencesBodySchema,
  aiPreferencesResponseSchema,
  savePromptsBodySchema,
  promptsResponseSchema,
} from '../schemas/ai-preferences.schema.js'

const aiPreferencesRouter = new Hono()
aiPreferencesRouter.use('*', sessionMiddleware)

// POST /preferences/ai -- save OpenRouter API key (encrypted)
aiPreferencesRouter.post(
  '/preferences/ai',
  zValidator('json', saveAiPreferencesBodySchema, validationHook),
  async (c) => {
    const userId = c.get('userId') as string
    const body = c.req.valid('json')

    await setConfig({
      scope: 'user',
      userId,
      kind: 'llm_key',
      key: 'openrouter',
      value: body.openRouterKey,
      encrypted: true,
    })

    return c.json(okResponseSchema.parse({ ok: true }))
  },
)

// GET /preferences/ai -- return key-exists status and model preference
aiPreferencesRouter.get('/preferences/ai', async (c) => {
  const userId = c.get('userId') as string

  const [rawKey, modelPref] = await Promise.all([
    getConfig({ scope: 'user', userId, kind: 'llm_key', key: 'openrouter' }),
    getConfig({ scope: 'user', userId, kind: 'model_preference', key: 'default' }),
  ])

  return c.json(
    aiPreferencesResponseSchema.parse({
      hasOpenRouterKey: rawKey != null,
      modelPreference: typeof modelPref === 'string' ? modelPref : null,
    }),
  )
})

// PUT /prompts -- save custom prompt overrides
aiPreferencesRouter.put(
  '/prompts',
  zValidator('json', savePromptsBodySchema, validationHook),
  async (c) => {
    const userId = c.get('userId') as string
    const body = c.req.valid('json')

    await setConfig({
      scope: 'user',
      userId,
      kind: 'user_prompts',
      key: 'overrides',
      value: body,
      encrypted: false,
    })

    return c.json(okResponseSchema.parse({ ok: true }))
  },
)

// GET /prompts -- retrieve custom prompt overrides
aiPreferencesRouter.get('/prompts', async (c) => {
  const userId = c.get('userId') as string

  const stored = await getConfig({
    scope: 'user',
    userId,
    kind: 'user_prompts',
    key: 'overrides',
  })

  if (!stored || typeof stored !== 'object') {
    return c.json(
      promptsResponseSchema.parse({
        extraction: null,
        wikiClassify: null,
        wikiGeneration: null,
      }),
    )
  }

  const obj = stored as Record<string, unknown>
  return c.json(
    promptsResponseSchema.parse({
      extraction: typeof obj.extraction === 'string' ? obj.extraction : null,
      wikiClassify: typeof obj.wikiClassify === 'string' ? obj.wikiClassify : null,
      wikiGeneration: typeof obj.wikiGeneration === 'string' ? obj.wikiGeneration : null,
    }),
  )
})

export { aiPreferencesRouter as aiPreferencesRoutes }
