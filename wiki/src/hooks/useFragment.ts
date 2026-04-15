'use client'

import { useQuery } from '@tanstack/react-query'
import { getFragment } from '@/lib/api'

export function useFragment(id: string | undefined) {
  return useQuery({
    queryKey: ['fragment', id],
    queryFn: async () => {
      const { data } = await getFragment({ path: { id: id! } })
      return data
    },
    enabled: !!id,
  })
}
