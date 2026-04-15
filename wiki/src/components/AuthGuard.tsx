'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { useSession } from '@/hooks/useSession'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { isAuthenticated, isLoading } = useSession()

  useEffect(() => {
    if (!isLoading && !isAuthenticated && pathname !== '/login') {
      router.push('/login')
    }
  }, [isLoading, isAuthenticated, pathname, router])

  if (isLoading) return null
  if (!isAuthenticated && pathname !== '/login') return null

  return <>{children}</>
}
