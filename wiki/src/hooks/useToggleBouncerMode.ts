'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toggleBouncerMode } from '@/lib/api'

export function useToggleBouncerMode() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, mode }: { id: string; mode: 'auto' | 'review' }) => {
      const { data } = await toggleBouncerMode({ path: { id }, body: { mode } })
      return data
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['wiki', id] })
      queryClient.invalidateQueries({ queryKey: ['wikis'] })
    },
  })
}
