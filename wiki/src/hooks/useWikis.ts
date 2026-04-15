'use client'

import { useQuery } from '@tanstack/react-query'
import { listWikis } from '@/lib/api'

export function useWikis(opts?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ['wikis', opts],
    queryFn: async () => {
      const { data } = await listWikis({ query: opts })
      return data
    },
  })
}
