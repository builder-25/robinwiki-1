import { client } from './generated/client.gen'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// Configure client — rewrites handle the base URL, so use relative paths
client.setConfig({
  baseUrl: '/api',
  credentials: 'include',
})

// Response interceptor: throw ApiError on non-OK responses
client.interceptors.response.use(async (response) => {
  if (!response.ok) {
    const body = await response.clone().text().catch(() => '')
    let message = body || `${response.status} ${response.statusText}`
    try {
      const json = JSON.parse(body)
      if (json.message || json.error) message = json.message || json.error
    } catch {
      // body wasn't JSON, use as-is
    }
    throw new ApiError(response.status, message)
  }
  return response
})

export * from './generated/index'
