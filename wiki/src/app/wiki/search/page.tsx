'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSearch } from '@/hooks/useSearch'
import Link from 'next/link'

function SearchResults() {
  const sp = useSearchParams()
  const q = sp.get('q') ?? ''
  const { data, isLoading, error } = useSearch(q || undefined)

  if (!q) {
    return <p style={{ color: '#666' }}>Enter a query to search your knowledge base.</p>
  }

  if (isLoading) return <p style={{ color: '#666' }}>Searching...</p>

  if (error) {
    return (
      <p style={{ color: '#dc2626' }}>
        Search failed: {error instanceof Error ? error.message : 'Unknown error'}
      </p>
    )
  }

  if (!data?.results || data.results.length === 0) {
    return <p style={{ color: '#666' }}>No results found for &ldquo;{q}&rdquo;.</p>
  }

  return (
    <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {data.results.map((result) => (
        <li key={result.fragmentId} style={{ border: '1px solid #e5e5e5', borderRadius: 8, padding: 16 }}>
          <Link href={`/wiki/fragment/${result.fragmentId}`} style={{ fontSize: 16, fontWeight: 500 }}>
            {result.title}
          </Link>
          <p style={{ fontSize: 14, color: '#666', marginTop: 4 }}>{result.fragment}</p>
          {result.tags.length > 0 && (
            <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
              {result.tags.map((tag) => (
                <span key={tag} style={{ fontSize: 12, background: '#f3f4f6', padding: '2px 8px', borderRadius: 4 }}>
                  {tag}
                </span>
              ))}
            </div>
          )}
          <span style={{ fontSize: 11, color: '#999', display: 'block', marginTop: 4 }}>
            Score: {result.score.toFixed(2)}
          </span>
        </li>
      ))}
    </ul>
  )
}

export default function SearchPage() {
  const [draft, setDraft] = useState('')

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Search</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          const t = draft.trim()
          if (!t) return
          window.history.pushState(null, '', `/wiki/search?q=${encodeURIComponent(t)}`)
          window.dispatchEvent(new PopStateEvent('popstate'))
        }}
        style={{ marginBottom: 24 }}
      >
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Search your knowledge base..."
          autoFocus
          style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
        />
      </form>

      <Suspense fallback={<p style={{ color: '#666' }}>Loading...</p>}>
        <SearchResults />
      </Suspense>
    </div>
  )
}
