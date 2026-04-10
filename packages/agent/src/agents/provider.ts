/**
 * OpenRouter provider for Mastra agents.
 * Uses OPENROUTER_AGENT_KEY (not OPENROUTER_API_KEY) per key-separation policy.
 */

import { createOpenRouter } from '@openrouter/ai-sdk-provider'

export const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_AGENT_KEY,
})
