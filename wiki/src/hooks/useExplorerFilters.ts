'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useCallback, useMemo } from 'react'

export const EXPLORER_TYPES = ['fragment', 'wiki', 'person', 'entry'] as const
export type ExplorerType = (typeof EXPLORER_TYPES)[number]

export interface ExplorerFilters {
  types: string[]
  collection: string | null
  sort: 'recent' | 'oldest' | 'alpha'
}

const VALID_SORTS = new Set<ExplorerFilters['sort']>(['recent', 'oldest', 'alpha'])

function parseSort(raw: string | null): ExplorerFilters['sort'] {
  if (raw && VALID_SORTS.has(raw as ExplorerFilters['sort'])) {
    return raw as ExplorerFilters['sort']
  }
  return 'recent'
}

export function useExplorerFilters() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const filters = useMemo<ExplorerFilters>(() => {
    const rawType = searchParams.get('type')
    const types = rawType ? rawType.split(',').filter(Boolean) : []
    const collection = searchParams.get('collection') ?? null
    const sort = parseSort(searchParams.get('sort'))
    return { types, collection, sort }
  }, [searchParams])

  const setFilter = useCallback(
    (key: keyof ExplorerFilters, value: string[] | string | null) => {
      const next = new URLSearchParams(searchParams.toString())

      if (key === 'types') {
        const arr = value as string[]
        if (arr.length === 0) {
          next.delete('type')
        } else {
          next.set('type', arr.join(','))
        }
      } else if (key === 'collection') {
        if (value === null || value === '') {
          next.delete('collection')
        } else {
          next.set('collection', value as string)
        }
      } else if (key === 'sort') {
        if (value === 'recent' || value === null) {
          next.delete('sort')
        } else {
          next.set('sort', value as string)
        }
      }

      const qs = next.toString()
      router.replace(qs ? `?${qs}` : '?', { scroll: false })
    },
    [searchParams, router],
  )

  const clearFilters = useCallback(() => {
    router.replace('?', { scroll: false })
  }, [router])

  const hasActiveFilters = useMemo(() => {
    return filters.types.length > 0 || filters.collection !== null || filters.sort !== 'recent'
  }, [filters])

  return { filters, setFilter, clearFilters, hasActiveFilters }
}
