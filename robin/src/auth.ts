import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from './db/client.js'
import * as schema from './db/schema.js'
import { producer } from './queue/producer.js'
import { logger } from './lib/logger.js'

const log = logger.child({ component: 'auth' })

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),

  emailAndPassword: { enabled: true },

  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
          },
        }
      : {}),
    ...(process.env.GITHUB_CLIENT_ID
      ? {
          github: {
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
          },
        }
      : {}),
  },

  secret: (() => {
    const s = process.env.BETTER_AUTH_SECRET
    if (!s) throw new Error('BETTER_AUTH_SECRET env var is required')
    return s
  })(),
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
  basePath: '/api/auth',
  trustedOrigins: [
    'http://localhost:8080',
    'https://withrobin.lovable.app',
    'https://preview--withrobin.lovable.app',
    ...(process.env.EXTRA_TRUSTED_ORIGINS?.split(',') ?? []),
  ],
  advanced: {
    useSecureCookies: process.env.BETTER_AUTH_URL?.startsWith('https://') ?? false,
    defaultCookieAttributes: {
      sameSite: 'none' as const,
      secure: true,
    },
  },

  hooks: {
    after: async (rawCtx) => {
      const ctx = rawCtx as Record<string, unknown>
      if (ctx.path !== '/sign-up/email' && !(ctx.path as string)?.startsWith('/callback/'))
        return { response: null, headers: null }

      // Extract userId — better-auth puts the session in context.newSession (sign-up)
      // or context.session (callbacks)
      const c = ctx.context as Record<string, unknown> | undefined
      const newSession = c?.newSession as Record<string, unknown> | undefined
      const session = c?.session as Record<string, unknown> | undefined
      const userId = ((newSession?.user as Record<string, unknown>)?.id ??
        (session?.user as Record<string, unknown>)?.id) as string | undefined
      log.debug({ path: ctx.path, userId }, 'after hook')
      if (!userId) {
        log.error('after hook: could not find userId in context')
        return { response: null, headers: null }
      }

      producer
        .enqueueProvision({
          type: 'provision',
          jobId: `provision-${userId}`,
          userId,
          enqueuedAt: new Date().toISOString(),
        })
        .catch((err) => log.error({ userId, err }, 'failed to enqueue provision'))

      return { response: null, headers: null }
    },
  },
})
