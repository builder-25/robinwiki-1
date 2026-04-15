'use client'

import { useQuery } from '@tanstack/react-query'
import { search } from '@/lib/api'

export function useSearch(
  query: string | undefined,
  opts?: { limit?: number; minScore?: number },
) {
  return useQuery({
    queryKey: ['search', query, opts],
    queryFn: async () => {
      const { data } = await search({ query: { q: query!, ...opts } })
      return data
    },
    enabled: !!query,
    staleTime: 30_000,
  })
}
