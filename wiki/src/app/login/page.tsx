'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (isSignUp) {
        const { error: signUpError } = await authClient.signUp.email({
          email,
          password,
          name,
        })
        if (signUpError) {
          setError(signUpError.message ?? 'Sign up failed')
          return
        }
      } else {
        const { error: signInError } = await authClient.signIn.email({
          email,
          password,
        })
        if (signInError) {
          setError(signInError.message ?? 'Sign in failed')
          return
        }
      }
      router.push('/wiki')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    fontSize: 14,
    boxSizing: 'border-box' as const,
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, textAlign: 'center' }}>
          {isSignUp ? 'Create Account' : 'Sign In'}
        </h1>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {isSignUp && (
            <div>
              <label htmlFor="name" style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Name</label>
              <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required={isSignUp} style={inputStyle} />
            </div>
          )}

          <div>
            <label htmlFor="email" style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={inputStyle} />
          </div>

          <div>
            <label htmlFor="password" style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Password</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={inputStyle} />
          </div>

          {error && <p style={{ color: '#dc2626', fontSize: 14, margin: 0 }}>{error}</p>}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '10px 0',
              background: '#111',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1,
            }}
          >
            {loading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <p style={{ fontSize: 14, textAlign: 'center', marginTop: 16, color: '#666' }}>
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            onClick={() => { setIsSignUp(!isSignUp); setError(null) }}
            style={{ background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', color: '#111', fontSize: 14 }}
          >
            {isSignUp ? 'Sign in' : 'Sign up'}
          </button>
        </p>
      </div>
    </div>
  )
}
