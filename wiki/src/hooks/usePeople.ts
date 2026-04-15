'use client'

import { useQuery } from '@tanstack/react-query'
import { listPeople } from '@/lib/api'

export function usePeople(opts?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ['people', opts],
    queryFn: async () => {
      const { data } = await listPeople({ query: opts })
      return data
    },
  })
}
