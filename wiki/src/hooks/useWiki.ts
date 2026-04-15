'use client'

import { useQuery } from '@tanstack/react-query'
import { getWiki } from '@/lib/api'

export function useWiki(id: string | undefined) {
  return useQuery({
    queryKey: ['wiki', id],
    queryFn: async () => {
      const { data } = await getWiki({ path: { id: id! } })
      return data
    },
    enabled: !!id,
  })
}
