import { createAuthClient } from 'better-auth/react'

const baseURL =
  typeof window !== 'undefined'
    ? '/api'
    : (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000') + '/api'

export const authClient = createAuthClient({ baseURL })
