'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { acceptFragment } from '@/lib/api'

export function useAcceptFragment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, wikiId }: { id: string; wikiId: string }) => {
      const { data } = await acceptFragment({ path: { id }, body: { wikiId } })
      return data
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['fragment', id] })
      queryClient.invalidateQueries({ queryKey: ['fragments'] })
    },
  })
}
