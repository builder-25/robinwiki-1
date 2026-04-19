import type { NextConfig } from 'next'

const ROBIN_SERVER = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

const nextConfig: NextConfig = {
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
