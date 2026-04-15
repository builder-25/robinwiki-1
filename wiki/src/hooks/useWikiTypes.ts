'use client'

import { useQuery } from '@tanstack/react-query'
import { listWikiTypes } from '@/lib/api'

export function useWikiTypes() {
  return useQuery({
    queryKey: ['wikiTypes'],
    queryFn: async () => {
      const { data } = await listWikiTypes()
      return data
    },
  })
}
