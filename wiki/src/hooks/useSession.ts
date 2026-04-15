'use client'

import { authClient } from '@/lib/auth-client'

export function useSession() {
  const { data, isPending, error } = authClient.useSession()
  return {
    session: data,
    isLoading: isPending,
    isAuthenticated: !!data?.user,
    error,
  }
}
