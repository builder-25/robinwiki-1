'use client'

import { useQuery } from '@tanstack/react-query'
import { getUserStats } from '@/lib/api'

export function useStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: async () => {
      const { data } = await getUserStats()
      return data
    },
  })
}
