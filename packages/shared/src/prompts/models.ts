/** Default model for wiki regeneration and general LLM calls (OpenRouter format) */
export const DEFAULT_MODEL = 'anthropic/claude-sonnet-4.6'

/** Model for fragmentation — needs strong extraction without meta-commentary */
export const FRAGMENT_MODEL = 'google/gemini-2.5-pro'

/** Fast model for lightweight confirmations (classifier) (OpenRouter format) */
export const FAST_MODEL = 'anthropic/claude-haiku-4.5'

/** Mastra-prefixed model identifier for agent pipelines */
export const MASTRA_MODEL = 'anthropic/claude-sonnet-4.6'
