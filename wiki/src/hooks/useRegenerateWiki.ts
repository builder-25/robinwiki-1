'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { regenerateWiki } from '@/lib/api'

export function useRegenerateWiki() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await regenerateWiki({ path: { id } })
      return data
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['wiki', id] })
      queryClient.invalidateQueries({ queryKey: ['wikis'] })
    },
  })
}
