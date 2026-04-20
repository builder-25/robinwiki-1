'use client'

import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import { useState } from 'react'

import { ApiError } from '@/lib/api'
import { authClient } from '@/lib/auth-client'

let isRedirecting = false

function handleAuthError() {
  if (isRedirecting) return
  isRedirecting = true
  authClient.signOut().finally(() => {
    window.location.href = '/login'
  })
}

function isUnauthorized(error: Error): boolean {
  return error instanceof ApiError && error.status === 401
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error) => {
            if (isUnauthorized(error)) handleAuthError()
          },
        }),
        mutationCache: new MutationCache({
          onError: (error) => {
            if (isUnauthorized(error)) handleAuthError()
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            retry: (failureCount, error) => {
              if (isUnauthorized(error)) return false
              return failureCount < 1
            },
          },
          mutations: {
            retry: false,
          },
        },
      }),
  )
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
