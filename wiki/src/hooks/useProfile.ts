'use client'

import { useQuery } from '@tanstack/react-query'
import { getUserProfile } from '@/lib/api'

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data } = await getUserProfile()
      return data
    },
  })
}
