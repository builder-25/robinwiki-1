'use client'

import { useRouter } from 'next/navigation'
import { useProfile } from '@/hooks/useProfile'
import { useStats } from '@/hooks/useStats'
import { authClient } from '@/lib/auth-client'
import { exportUserData, deleteUserData, deleteUserAccount } from '@/lib/api'

export default function ProfilePage() {
  const router = useRouter()
  const { data: profile, isLoading: profileLoading } = useProfile()
  const { data: stats, isLoading: statsLoading } = useStats()

  const handleLogout = async () => {
    await authClient.signOut()
    router.push('/login')
  }

  const handleExport = async () => {
    const { data } = await exportUserData()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `robin-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDeleteData = async () => {
    if (!confirm('This will delete all your data but keep your account. Continue?')) return
    await deleteUserData()
    router.refresh()
  }

  const handleDeleteAccount = async () => {
    if (!confirm('This will permanently delete your account and all data. This cannot be undone.')) return
    await deleteUserAccount()
    router.push('/login')
  }

  if (profileLoading) return <div style={{ padding: 24 }}>Loading profile...</div>

  const label = { fontSize: 14, color: '#666' } as const
  const value = { fontSize: 14 } as const
  const btn = {
    display: 'block' as const,
    width: '100%',
    textAlign: 'left' as const,
    padding: '10px 16px',
    border: '1px solid #e5e5e5',
    borderRadius: 6,
    background: 'none',
    cursor: 'pointer' as const,
    fontSize: 14,
  }

  return (
    <div style={{ padding: 24, maxWidth: 600, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Profile</h1>

      {profile && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Account</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <span style={label}>Name</span>
            <span style={value}>{profile.name}</span>
            <span style={label}>Email</span>
            <span style={value}>{profile.email}</span>
            <span style={label}>MCP Endpoint</span>
            <span style={{ ...value, fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>
              {profile.mcpEndpointUrl}
            </span>
          </div>
        </section>
      )}

      {!statsLoading && stats && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Stats</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <span style={label}>Total Notes</span>
            <span style={value}>{stats.totalNotes}</span>
            <span style={label}>Threads</span>
            <span style={value}>{stats.totalThreads}</span>
            <span style={label}>People</span>
            <span style={value}>{stats.peopleCount}</span>
            <span style={label}>Unthreaded</span>
            <span style={value}>{stats.unthreadedCount}</span>
            <span style={label}>Last Sync</span>
            <span style={value}>{stats.lastSync ? new Date(stats.lastSync).toLocaleString() : 'Never'}</span>
          </div>
        </section>
      )}

      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Actions</h2>
        <button onClick={handleExport} style={btn}>Export Data</button>
        <button onClick={handleLogout} style={btn}>Sign Out</button>
        <button onClick={handleDeleteData} style={{ ...btn, borderColor: '#fb923c', color: '#ea580c' }}>
          Delete All Data
        </button>
        <button onClick={handleDeleteAccount} style={{ ...btn, borderColor: '#fca5a5', color: '#dc2626' }}>
          Delete Account
        </button>
      </section>
    </div>
  )
}
