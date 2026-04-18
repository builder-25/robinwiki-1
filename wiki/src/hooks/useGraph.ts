'use client'

import { useQuery } from '@tanstack/react-query'
import { getGraph } from '@/lib/api'

export function useGraph() {
  return useQuery({
    queryKey: ['graph'],
    queryFn: async () => {
      const { data } = await getGraph()
      return data
    },
  })
}
