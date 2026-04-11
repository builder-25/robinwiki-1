/**
 * Embedding model registry.
 *
 * Robin supports exactly two embedding models, both served via OpenRouter,
 * both pinned to 1536 dimensions to match the `vector(1536)` schema on
 * `wikis.embedding`, `fragments.embedding`, and `people.embedding`.
 *
 * | Model | Native dim | How it reaches 1536 | Role |
 * |---|---|---|---|
 * | `qwen/qwen3-embedding-8b` | 4096 | MRL truncation via `dimensions: 1536` | Default — top MTEB, cheapest |
 * | `openai/text-embedding-3-small` | 1536 | native, no truncation | Alternative — OpenAI ecosystem fit |
 *
 * The `dimensions: 1536` request parameter is always sent on embedding
 * calls, regardless of model. For Qwen3 this triggers MRL truncation. For
 * text-embedding-3-small it is a no-op that makes the contract explicit.
 */

/** The single embedding dimension Robin's schema commits to. */
export const EMBEDDING_DIMENSIONS = 1536 as const

/**
 * Allow-list of embedding model IDs Robin supports. Values are OpenRouter
 * model slugs. Any other model ID must be rejected by the config layer.
 */
export const SUPPORTED_EMBEDDING_MODELS = [
  'qwen/qwen3-embedding-8b',
  'openai/text-embedding-3-small',
] as const

export type EmbeddingModelId = (typeof SUPPORTED_EMBEDDING_MODELS)[number]

/** The embedding model used when a user has not completed onboarding. */
export const DEFAULT_EMBEDDING_MODEL: EmbeddingModelId = 'qwen/qwen3-embedding-8b'

/** Type guard for validating config values against the allow-list. */
export function isSupportedEmbeddingModel(value: unknown): value is EmbeddingModelId {
  return (
    typeof value === 'string' &&
    (SUPPORTED_EMBEDDING_MODELS as readonly string[]).includes(value)
  )
}
