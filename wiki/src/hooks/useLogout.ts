'use client'

import { useQueryClient } from '@tanstack/react-query'
import { authClient } from '@/lib/auth-client'

export function useLogout() {
  const queryClient = useQueryClient()

  return async () => {
    await authClient.signOut()
    queryClient.clear()
    window.location.href = '/login'
  }
}
