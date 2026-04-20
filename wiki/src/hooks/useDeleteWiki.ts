'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { client } from '@/lib/generated/client.gen'

export function useDeleteWiki() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await client.delete({
        url: '/wikis/{id}',
        path: { id },
      })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wikis'] })
    },
  })
}
