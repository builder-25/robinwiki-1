'use client'

import { useQuery } from '@tanstack/react-query'
import { listFragments } from '@/lib/api'

export function useFragments(opts?: { limit?: number }) {
  return useQuery({
    queryKey: ['fragments', opts],
    queryFn: async () => {
      const { data } = await listFragments({ query: opts })
      return data
    },
  })
}
