'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { rejectFragment } from '@/lib/api'

export function useRejectFragment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, wikiId }: { id: string; wikiId: string }) => {
      const { data } = await rejectFragment({ path: { id }, body: { wikiId } })
      return data
    },
    onSuccess: (_data, { id, wikiId }) => {
      queryClient.invalidateQueries({ queryKey: ['fragment', id] })
      queryClient.invalidateQueries({ queryKey: ['fragments'] })
      queryClient.invalidateQueries({ queryKey: ['wiki', wikiId] })
    },
  })
}
