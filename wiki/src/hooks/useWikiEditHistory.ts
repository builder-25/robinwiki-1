'use client'

import { useQuery } from '@tanstack/react-query'
import { getWikiEditHistory } from '@/lib/api'

export function useWikiEditHistory(id: string | undefined) {
  return useQuery({
    queryKey: ['wiki-edit-history', id],
    queryFn: async () => {
      const { data } = await getWikiEditHistory({ path: { id: id! } })
      return data
    },
    enabled: !!id,
  })
}
