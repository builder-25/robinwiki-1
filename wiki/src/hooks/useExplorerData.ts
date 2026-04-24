'use client'

import { useMemo } from 'react'
import { useWikis } from '@/hooks/useWikis'
import { useFragments } from '@/hooks/useFragments'
import { usePeople } from '@/hooks/usePeople'
import { useEntries } from '@/hooks/useEntries'
import { useGroups, type Group } from '@/hooks/useGroups'
import type { ExplorerFilters } from '@/hooks/useExplorerFilters'
import { ROUTES } from '@/lib/routes'

export interface ExplorerItem {
  id: string
  lookupKey: string
  type: 'fragment' | 'wiki' | 'person' | 'entry'
  subtype: string | null
  title: string
  groupId: string | null
  groupName: string | null
  groupColor: string | null
  date: string
  href: string
}

function capitalize(s: string | null | undefined): string {
  if (!s) return ''
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

export function useExplorerData(filters: ExplorerFilters) {
  const wikisQuery = useWikis()
  const fragmentsQuery = useFragments({ limit: 500 })
  const peopleQuery = usePeople({ limit: 500 })
  const entriesQuery = useEntries({ limit: 500 })
  const groupsQuery = useGroups()

  const isLoading =
    wikisQuery.isLoading || fragmentsQuery.isLoading || peopleQuery.isLoading || entriesQuery.isLoading || groupsQuery.isLoading
  const isError =
    wikisQuery.isError || fragmentsQuery.isError || peopleQuery.isError || entriesQuery.isError || groupsQuery.isError

  const items = useMemo(() => {
    const result: ExplorerItem[] = []

    // Wikis (threads)
    for (const wiki of wikisQuery.data?.wikis ?? []) {
      // TODO: resolve group membership when API supports it
      result.push({
        id: wiki.id,
        lookupKey: wiki.lookupKey,
        type: 'wiki',
        subtype: capitalize(wiki.type),
        title: wiki.name,
        groupId: null,
        groupName: null,
        groupColor: null,
        date: wiki.updatedAt,
        href: `/wiki/${wiki.lookupKey}`,
      })
    }

    // Fragments
    for (const frag of fragmentsQuery.data?.fragments ?? []) {
      result.push({
        id: frag.id,
        lookupKey: frag.lookupKey,
        type: 'fragment',
        subtype: capitalize(frag.type),
        title: frag.title,
        groupId: null,
        groupName: null,
        groupColor: null,
        date: frag.updatedAt,
        href: ROUTES.fragment(frag.lookupKey),
      })
    }

    // People
    for (const person of peopleQuery.data?.people ?? []) {
      result.push({
        id: person.id,
        lookupKey: person.lookupKey,
        type: 'person',
        subtype: null,
        title: person.name,
        groupId: null,
        groupName: null,
        groupColor: null,
        date: person.updatedAt,
        href: ROUTES.person(person.lookupKey),
      })
    }

    // Entries
    for (const entry of entriesQuery.data?.entries ?? []) {
      result.push({
        id: entry.id,
        lookupKey: entry.lookupKey,
        type: 'entry',
        subtype: null,
        title: entry.title,
        groupId: null,
        groupName: null,
        groupColor: null,
        date: entry.createdAt,
        href: ROUTES.entry(entry.lookupKey),
      })
    }

    // Apply type filter
    let filtered = result
    if (filters.types.length > 0) {
      filtered = filtered.filter((item) => filters.types.includes(item.type))
    }

    // Apply group filter
    if (filters.group) {
      filtered = filtered.filter((item) => item.groupId === filters.group)
    }

    // Apply sort
    if (filters.sort === 'recent') {
      filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    } else if (filters.sort === 'oldest') {
      filtered.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    } else {
      filtered.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
    }

    return filtered
  }, [
    wikisQuery.data,
    fragmentsQuery.data,
    peopleQuery.data,
    entriesQuery.data,
    filters.types,
    filters.group,
    filters.sort,
  ])

  const groups: Group[] = groupsQuery.data ?? []

  return { items, isLoading, isError, groups }
}
