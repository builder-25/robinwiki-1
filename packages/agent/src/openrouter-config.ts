export interface OpenRouterConfig {
  apiKey: string
  chatModel: string
  embeddingModel: string
}

export class NoOpenRouterKeyError extends Error {
  constructor() {
    super('no_openrouter_key')
    this.name = 'NoOpenRouterKeyError'
  }
}
