import { createAuthClient } from 'better-auth/react'

const baseURL =
  typeof window !== 'undefined'
    ? `${window.location.origin}/api/auth`
    : (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000') + '/api/auth'

export const authClient = createAuthClient({ baseURL })
