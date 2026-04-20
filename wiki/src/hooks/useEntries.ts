'use client'

import { useQuery } from '@tanstack/react-query'
import { listEntries } from '@/lib/api'

export function useEntries(opts?: { limit?: number }) {
  return useQuery({
    queryKey: ['entries', opts],
    queryFn: async () => {
      const { data } = await listEntries({ query: opts })
      return data
    },
    staleTime: 60_000,
  })
}
