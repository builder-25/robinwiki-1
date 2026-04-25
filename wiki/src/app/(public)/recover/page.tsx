'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { T, FONT } from '@/lib/typography'

export default function RecoverPage() {
  const router = useRouter()
  const [secretKey, setSecretKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/auth/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secretKey }),
      })

      if (res.ok) {
        setSuccess(true)
        setTimeout(() => router.push('/login'), 2000)
      } else if (res.status === 403) {
        setError('Invalid server secret key')
      } else if (res.status === 429) {
        setError('Too many attempts. Try again in 1 minute.')
      } else {
        setError('Something went wrong. Please try again.')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'var(--bg)',
        fontFamily: FONT.SANS,
      }}
    >
      <div style={{ width: '100%', maxWidth: 360 }}>
        <h1
          style={{
            ...T.h1,
            fontFamily: FONT.SERIF,
            textAlign: 'center',
            marginBottom: 8,
            color: 'var(--heading-color)',
          }}
        >
          Reset password
        </h1>
        <p
          style={{
            ...T.bodySmall,
            textAlign: 'center',
            color: 'var(--heading-secondary)',
            marginBottom: 32,
          }}
        >
          Enter the server secret key to reset your password.
        </p>

        {success ? (
          <p
            style={{
              ...T.bodySmall,
              color: 'var(--profile-connected)',
              textAlign: 'center',
            }}
          >
            Password has been reset. Redirecting to login...
          </p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label
                htmlFor="secretKey"
                style={{
                  ...T.label,
                  color: 'var(--input-label)',
                }}
              >
                Server Secret Key
              </label>
              <input
                id="secretKey"
                type="password"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                required
                style={{
                  ...T.input,
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid var(--input-border)',
                  borderRadius: 2,
                  background: 'transparent',
                  color: 'var(--heading-color)',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
            </div>

            {error && (
              <p style={{ ...T.bodySmall, color: 'var(--destructive)', margin: 0 }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                ...T.button,
                width: '100%',
                padding: '10px 0',
                background: 'var(--btn-primary-bg)',
                color: 'var(--btn-primary-text)',
                border: 'none',
                borderRadius: 2,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1,
              }}
            >
              {loading ? 'Resetting...' : 'Reset password'}
            </button>
          </form>
        )}

        <p style={{ ...T.bodySmall, textAlign: 'center', marginTop: 16 }}>
          <Link
            href="/login"
            style={{ color: 'var(--wiki-link)', textDecoration: 'none' }}
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
