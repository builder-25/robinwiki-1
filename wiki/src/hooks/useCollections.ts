'use client'

import { useQuery } from '@tanstack/react-query'

export interface Collection {
  id: string
  name: string
  slug: string
  icon: string
  color: string
  description: string
  wikiCount: number
}

export function useCollections() {
  return useQuery({
    queryKey: ['collections'],
    queryFn: async () => {
      const res = await fetch('/api/groups', { credentials: 'include' })
      if (!res.ok) throw new Error(`Collections fetch failed: ${res.status}`)
      const data = await res.json()
      return data.groups as Collection[]
    },
    staleTime: 60_000,
  })
}
