'use client'

import { useState } from 'react'
import { authClient } from '@/lib/auth-client'

export function useChangePassword() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)

  const mutate = async ({
    currentPassword,
    newPassword,
  }: {
    currentPassword: string
    newPassword: string
  }) => {
    setIsLoading(true)
    setError(null)
    setIsSuccess(false)
    try {
      await authClient.changePassword({ currentPassword, newPassword })
      setIsSuccess(true)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to change password'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  return { mutate, isLoading, error, isSuccess }
}
