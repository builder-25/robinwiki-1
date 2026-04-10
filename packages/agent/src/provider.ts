/**
 * OpenRouter provider configuration for the agent package.
 * All LLM calls flow through OpenRouter using OPENROUTER_AGENT_KEY.
 */

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'

/**
 * Returns an OpenAICompatibleConfig-shaped object for use with Mastra or direct API calls.
 * Uses OPENROUTER_AGENT_KEY (not OPENROUTER_API_KEY) per key-separation policy.
 */
export function openRouterModel(modelId?: string): {
  id: `${string}/${string}`
  url: string
  apiKey: string | undefined
} {
  const id = (modelId ??
    process.env.ROBIN_MODEL ??
    'anthropic/claude-sonnet-4-6') as `${string}/${string}`
  return { id, url: OPENROUTER_BASE, apiKey: process.env.OPENROUTER_AGENT_KEY }
}

/**
 * Simple LLM call via OpenRouter chat completions API.
 * Available for direct LLM calls outside the Mastra agent pipeline.
 */
export async function openRouterCall(
  model: string,
  system: string,
  user: string,
  maxTokens = 4096
): Promise<string> {
  const apiKey = process.env.OPENROUTER_AGENT_KEY
  if (!apiKey) throw new Error('OPENROUTER_AGENT_KEY is not set')

  const messages: Array<{ role: string; content: string }> = []
  if (system) messages.push({ role: 'system', content: system })
  messages.push({ role: 'user', content: user })

  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model.includes('/') ? model : `anthropic/${model}`,
      messages,
      max_tokens: maxTokens,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`OpenRouter API error ${res.status}: ${body}`)
  }

  const json = (await res.json()) as { choices: Array<{ message: { content: string } }> }
  return json.choices[0]?.message?.content ?? ''
}
