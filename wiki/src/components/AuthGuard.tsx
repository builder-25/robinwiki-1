'use client'

// AuthGuard checks session and redirects to login if not authenticated.
// When auth hooks land, this will use useSession() + useRouter() to redirect.
export function AuthGuard({ children }: { children: React.ReactNode }) {
  // TODO: wire to useSession() when hooks PR merges
  // For now, render children (allows pages to load during development)
  return <>{children}</>
}
