'use client'

import { useQuery } from '@tanstack/react-query'

export interface Group {
  id: string
  name: string
  slug: string
  icon: string
  color: string
  description: string
  wikiCount: number
}

export function useGroups() {
  return useQuery({
    queryKey: ['groups'],
    queryFn: async () => {
      const res = await fetch('/api/groups', { credentials: 'include' })
      if (!res.ok) throw new Error(`Groups fetch failed: ${res.status}`)
      const data = await res.json()
      return data.groups as Group[]
    },
    staleTime: 60_000,
  })
}
