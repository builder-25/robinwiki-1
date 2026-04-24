import type { NextConfig } from 'next'

const ROBIN_SERVER = process.env.NEXT_PUBLIC_ROBIN_API ?? 'http://localhost:3000'

const nextConfig: NextConfig = {
  allowedDevOrigins: ['app.tensorkit.net'],
  transpilePackages: ['@robin/shared'],
  async redirects() {
    return [
      { source: '/wiki/fragments/:path*', destination: '/fragments/:path*', permanent: true },
      { source: '/wiki/people/:path*', destination: '/people/:path*', permanent: true },
      { source: '/wiki/entries/:path*', destination: '/entries/:path*', permanent: true },
      { source: '/wiki/explorer', destination: '/explorer', permanent: true },
      { source: '/wiki/graph', destination: '/graph', permanent: true },
      { source: '/wiki/search', destination: '/search', permanent: true },
    ]
  },
  async rewrites() {
    return [
      // Password recovery route (core: /auth/recover)
      {
        source: '/auth/recover',
        destination: `${ROBIN_SERVER}/auth/recover`,
      },
      // BetterAuth endpoints live at /api/auth/* on the core server
      {
        source: '/api/auth/:path*',
        destination: `${ROBIN_SERVER}/api/auth/:path*`,
      },
      // All other API calls: strip /api prefix (core routes are at root level)
      {
        source: '/api/:path*',
        destination: `${ROBIN_SERVER}/:path*`,
      },
    ]
  },
}

export default nextConfig
