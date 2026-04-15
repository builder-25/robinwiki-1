'use client'

import { useQuery } from '@tanstack/react-query'
import { getPerson } from '@/lib/api'

export function usePerson(id: string | undefined) {
  return useQuery({
    queryKey: ['person', id],
    queryFn: async () => {
      const { data } = await getPerson({ path: { id: id! } })
      return data
    },
    enabled: !!id,
  })
}
